#!/usr/bin/env node
/**
 * Render `roadmap.md` as the offline roadmap page (ADR 0004).
 *
 *   node render-roadmap.mjs <roadmap.md> <out.html>
 *   node render-roadmap.mjs <out.html>            # defaults to the Alex Moreau fixture
 *
 * Both views are rendered server-side, so the page is complete before a line of
 * script runs; roadmap.client.js only adds the toggle, the localStorage ticks, the meter
 * and the Map's click-to-select highlighting. Output is one self-contained file:
 * no network, no fonts, no libraries.
 *
 * Zero dependencies. Parsing goes through scripts/parse.mjs, the single source of
 * schema truth (ADR 0002) — this file never reads markdown structure itself.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRoadmap, gapClasses } from "./parse.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../../..");
const ASSETS = resolve(HERE, "../assets");
const DEFAULT_INPUT = resolve(REPO, "fixtures/alex-moreau/roadmap.md");

const WHERE_VALUES = ["At work", "Own time"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

/* ---------------------------------------------------------------- formatting */

/** Dates are formatted here rather than via toLocaleDateString so output is
 *  byte-identical whatever locale or ICU build the renderer runs under. */
const parseISO = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year: Number(y), month, day };
};

const fmtDate = (iso) => {
  const p = parseISO(iso);
  return p ? `${p.day} ${MONTHS[p.month - 1].slice(0, 3)} ${p.year}` : String(iso ?? "");
};
const fmtDayMonth = (iso) => {
  const p = parseISO(iso);
  return p ? `${p.day} ${MONTHS[p.month - 1].slice(0, 3)}` : String(iso ?? "");
};
const fmtMonth = (iso) => {
  const p = parseISO(iso);
  return p ? `${MONTHS[p.month - 1]} ${p.year}` : String(iso ?? "");
};

const esc = (text) =>
  String(text ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const SAFE_HREF = /^(https?:\/\/|mailto:)/i;

/**
 * The tiny slice of inline markdown the schema's free-text fields actually use:
 * `code`, [label](url), **bold**, *em*. Escaping happens first, so nothing here
 * can introduce markup. Links with an unrecognised scheme degrade to plain text.
 */
const inline = (text) =>
  esc(text)
    .replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label, href) =>
      SAFE_HREF.test(href) ? `<a href="${href}">${label}</a>` : whole)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*]+)\*/g, "$1<em>$2</em>");

const slug = (text) =>
  String(text ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "roadmap";

const isBlank = (value) => !String(value ?? "").trim() || String(value).trim() === "—";

/* ---------------------------------------------------------------- validation */

/** Fail loudly and specifically: a half-rendered roadmap is worse than no page. */
const validate = (milestones, source) => {
  const problems = [];
  const seenIds = new Set();
  const known = new Set(milestones.map((m) => m.id));

  if (milestones.length === 0) problems.push("no milestones found — is this a roadmap.md?");

  for (const m of milestones) {
    const at = m.id || "<unidentified milestone>";
    if (!m.id || m.id === "?") problems.push(`${at}: milestone heading is not \`## M<n> — <title>\``);
    if (seenIds.has(m.id)) problems.push(`${at}: duplicate milestone id`);
    seenIds.add(m.id);
    if (!m.title) problems.push(`${at}: missing title`);

    for (const field of ["Start", "Due"]) {
      if (!parseISO(m.fields[field])) problems.push(`${at}: ${field} is not an ISO date (got "${m.fields[field] ?? ""}")`);
    }
    if (!WHERE_VALUES.includes(m.fields.Where)) {
      problems.push(`${at}: Where must be "At work" or "Own time" (got "${m.fields.Where ?? ""}") — ADR 0008`);
    }
    for (const field of ["Deliverable", "Evidence"]) {
      if (isBlank(m.fields[field])) problems.push(`${at}: ${field} is required and must not be "—"`);
    }
    if (m.earns.length === 0) problems.push(`${at}: no **Earns** bullets — every milestone must earn a line`);
    for (const dep of m.dependsOn) {
      if (!known.has(dep)) problems.push(`${at}: Depends on "${dep}", which is not a milestone in this file`);
    }
  }

  // ADR 0014: a dependency cycle can't be laid out as a tech tree — and it can't be
  // worked either, since nothing in it ever becomes "available". Same "fail loud" gate.
  const { cyclic } = computeTiers(milestones);
  for (const id of cyclic) {
    problems.push(`${id}: "Depends on" participates in a dependency cycle`);
  }

  if (problems.length > 0) {
    throw new Error(`${source} does not satisfy the ADR 0002 schema:\n  - ${problems.join("\n  - ")}`);
  }
};

/**
 * ADR 0014: tier = dependency depth. 0 for no `Depends on`, else 1 + the max tier of
 * everything it depends on. Layered (Kahn-style BFS), not recursive, so a stack blowup is
 * never possible regardless of graph size. A milestone that cannot be resolved — a direct
 * or indirect cycle — degrades to tier 0 instead of hanging; this makes computeTiers itself
 * provably non-hanging. validate() is the actual gate that stops a cyclic file from
 * shipping at all, by reporting `cyclic` as a schema problem before render ever runs.
 */
const computeTiers = (milestones) => {
  const byId = new Map(milestones.map((m) => [m.id, m]));
  const tier = new Map();
  const remaining = new Set(milestones.map((m) => m.id));
  let frontier = milestones.filter((m) => m.dependsOn.length === 0).map((m) => m.id);
  let level = 0;
  while (frontier.length > 0) {
    for (const id of frontier) {
      tier.set(id, level);
      remaining.delete(id);
    }
    frontier = [...remaining].filter((id) => byId.get(id).dependsOn.every((d) => tier.has(d)));
    level += 1;
  }
  const cyclic = new Set(remaining);
  for (const id of remaining) tier.set(id, 0); // last-resort degrade; validate() is the real gate
  return { tier, cyclic };
};

/* ---------------------------------------------------------------- components */

const byDue = (a, b) => String(a.fields.Due).localeCompare(String(b.fields.Due)) || a.id.localeCompare(b.id);

const whereChip = (where) => {
  const own = where === "Own time";
  return `<span class="where ${own ? "w-own" : "w-work"}">${esc(where)}</span>`;
};

/**
 * ADR 0003: green when the milestone earns Projected Bullets, amber when Reframed.
 * A milestone earning both gets one block of each, so a bullet keeps the same
 * colour here that it carries on the projection.
 */
const earnsBlocks = (earns) => {
  const kinds = [
    ["projected", "", "Earns"],
    ["reframed", " is-refr", "Reframes"],
    ["carried", " is-refr", "Carries"],
  ];
  return kinds
    .map(([kind, cls, label]) => {
      const rows = earns.filter((e) => e.kind === kind);
      if (rows.length === 0) return "";
      const heading = `${label} ${rows.length === 1 ? "this line" : "these lines"}`;
      const items = rows
        .map((e) => `<li><span class="bid">${esc(e.id)}</span><span>${inline(e.text)} <span class="sect">· ${esc(e.section)}</span></span></li>`)
        .join("");
      return `<div class="earns${cls}"><p>${heading}</p><ul>${items}</ul></div>`;
    })
    .join("");
};

const rows = (milestone) => {
  const f = milestone.fields;
  const parts = [
    `<dt>Deliverable</dt><dd>${inline(f.Deliverable)}</dd>`,
    `<dt>Evidence</dt><dd>${inline(f.Evidence)}</dd>`,
  ];
  if (milestone.dependsOn.length > 0) {
    parts.push(`<dt>After</dt><dd>${milestone.dependsOn.map(esc).join(", ")}</dd>`);
  }
  if (!isBlank(f.Learning)) parts.push(`<dt>Learning</dt><dd>${inline(f.Learning)}</dd>`);
  if (!isBlank(f.Completed)) parts.push(`<dt>Completed</dt><dd>${esc(fmtDate(f.Completed))}</dd>`);
  return `<dl>${parts.join("")}</dl>`;
};

/**
 * ADR 0015: a Step's Tasks count individually when present; a zero-task Step counts as
 * one item itself — preserves ADR 0013's flat semantics exactly when nothing is nested.
 * Shared by the milestone card's supplementary progress bar, the Map node's fill
 * strip, and the header's roadmap-wide meter, so all three levels always agree.
 */
const actionItems = (milestone) => milestone.steps.flatMap((s) => (s.tasks.length > 0 ? s.tasks : [s]));
const actionTally = (milestone) => {
  const items = actionItems(milestone);
  return { done: items.filter((i) => i.done).length, total: items.length };
};

/**
 * ADR 0013/0015: the optional per-milestone action-item checklist. A milestone with no
 * Steps block renders nothing here — additive by construction, no layout shift either way.
 * `data-s` is the step's index within THIS milestone only, `data-t` a task's index within
 * ITS step only; scoping is via the card's own `data-m` (and the step's `data-s`), so the
 * client never needs a globally unique id for either.
 */
const stepItem = (milestone, s, i) => {
  const label = `Step ${i + 1} of ${esc(milestone.id)}`;
  if (s.tasks.length === 0) {
    // Byte-identical to ADR 0013 — the zero-task path is untouched.
    return `<li data-s="${i}" data-file-done="${s.done}">
    <input type="checkbox"${s.done ? " checked" : ""} aria-label="${label}">
    <span>${inline(s.text)}</span>
  </li>`;
  }
  const tdone = s.tasks.filter((t) => t.done).length;
  const taskItems = s.tasks
    .map(
      (t, j) => `<li data-t="${j}" data-file-done="${t.done}">
      <input type="checkbox"${t.done ? " checked" : ""} aria-label="Task ${j + 1} of ${label}">
      <span>${inline(t.text)}</span>
    </li>`
    )
    .join("");
  // A Step with Tasks is derived, not independently settable — disabled, not just checked,
  // so the single source of truth is enforced structurally (ADR 0015).
  return `<li data-s="${i}" data-file-done="${s.done}">
    <input type="checkbox"${s.done ? " checked" : ""} disabled aria-label="${label} (derived from its ${s.tasks.length} tasks)">
    <div class="step-main">
      <span class="step-text">${inline(s.text)}</span>
      <details class="tasks">
        <summary><span class="tasks-tally">${tdone} of ${s.tasks.length} tasks</span></summary>
        <ul>${taskItems}</ul>
      </details>
    </div>
  </li>`;
};

const stepsBlock = (milestone) => {
  const steps = milestone.steps;
  if (steps.length === 0) return "";
  const done = steps.filter((s) => s.done).length;
  const items = steps.map((s, i) => stepItem(milestone, s, i)).join("");
  const { done: adone, total: atotal } = actionTally(milestone);
  return `<details class="steps" open>
  <summary><span class="steps-tally">${done} of ${steps.length} steps</span></summary>
  <ul>${items}</ul>
</details>
<div class="steps-progress">
  <div class="sp-bar"><i style="width:${atotal ? (adone / atotal) * 100 : 0}%"></i></div>
  <span class="sp-label">${adone} of ${atotal} action items done</span>
</div>`;
};

const card = (milestone, { withDue, extraClass = "" }) => {
  const done = milestone.done;
  return `<article class="card${done ? " done" : ""}${extraClass}" data-m="${esc(milestone.id)}" data-file-done="${done}">
  <div class="card-top">
    <input type="checkbox"${done ? " checked" : ""} aria-label="Mark ${esc(milestone.id)} done">
    <span class="mid">${esc(milestone.id)}</span>
    <h3>${inline(milestone.title)}</h3>
    ${whereChip(milestone.fields.Where)}
    ${withDue ? `<span class="due">due ${esc(fmtDate(milestone.fields.Due))}</span>` : ""}
  </div>
  ${rows(milestone)}
  ${stepsBlock(milestone)}
  ${earnsBlocks(milestone.earns)}
</article>`;
};

/* ------------------------------------------------------------- view: timeline */

const timelineView = (milestones) => {
  const ordered = [...milestones].sort(byDue);
  const { html } = ordered.reduce(
    (acc, m) => {
      const month = fmtMonth(m.fields.Due);
      const divider = month === acc.month ? "" : `<p class="tl-month">${esc(month)}</p>`;
      const row = `<div class="tl-row${m.done ? " done" : ""}" data-m="${esc(m.id)}">
  <span class="tl-date">${esc(fmtDayMonth(m.fields.Due))}</span><span class="tl-dot"></span>
  ${card(m, { withDue: false })}
</div>`;
      return { month, html: acc.html + divider + row };
    },
    { month: "", html: "" }
  );
  return `<section class="view-timeline"><div class="timeline">${html}</div></section>`;
};

/* ------------------------------------------------------------ view: tech tree (labelled "Map" in the UI) */

/* ADR 0014: fixed node size in a deterministic, server-computed layout — see computeTiers. */
const NODE_W = 200;
const NODE_H = 76;
const GAP_X = 72;
const GAP_Y = 22;

/** tier → { id: {x, y} } in pixels, plus the overall canvas size. Ties within a tier
 *  break by the same due-date order the Timeline view already uses. */
const treeLayout = (milestones) => {
  const { tier } = computeTiers(milestones);
  const byTier = new Map();
  for (const m of milestones) {
    const t = tier.get(m.id);
    if (!byTier.has(t)) byTier.set(t, []);
    byTier.get(t).push(m);
  }
  const tierCount = byTier.size === 0 ? 0 : Math.max(...byTier.keys()) + 1;
  const pos = new Map();
  let maxSlots = 0;
  for (let t = 0; t < tierCount; t += 1) {
    const group = [...(byTier.get(t) ?? [])].sort(byDue);
    maxSlots = Math.max(maxSlots, group.length);
    group.forEach((m, slot) => {
      pos.set(m.id, { x: t * (NODE_W + GAP_X), y: slot * (NODE_H + GAP_Y) });
    });
  }
  const width = tierCount ? tierCount * NODE_W + (tierCount - 1) * GAP_X : 0;
  const height = maxSlots ? maxSlots * NODE_H + (maxSlots - 1) * GAP_Y : 0;
  return { pos, width, height };
};

/**
 * Compact node face: id, title, status only. `data-deps` is the one client-side data
 * source for both the reverse-dependency graph and live lock/available recomputation
 * (roadmap.client.js) — no separate JSON island. Status is real, not decorative: it is
 * computed from the file's own done state, not just rendered as a static color.
 */
const treeNode = (m, pos, byId) => {
  const blocked = m.dependsOn.some((d) => !byId.get(d)?.done);
  const status = m.done ? "done" : blocked ? "locked" : "available";
  const p = pos.get(m.id);
  // ADR 0015: an additive fill strip from the same action-item tally the card's own
  // supplementary bar uses — hidden once the milestone is actually done (CSS), since the
  // real done state already has its own, more legible, is-done treatment.
  const { done: adone, total: atotal } = actionTally(m);
  const fill = atotal > 0 ? `<i class="tt-fill" style="width:${(adone / atotal) * 100}%"></i>` : "";
  return `<button type="button" class="tt-node is-${status}" data-m="${esc(m.id)}" data-file-done="${m.done}" data-deps="${m.dependsOn.map(esc).join(",")}" style="left:${p.x}px;top:${p.y}px;width:${NODE_W}px;height:${NODE_H}px" aria-pressed="false">
  <span class="tt-id">${esc(m.id)}</span>
  <span class="tt-name">${inline(m.title)}</span>
  ${fill}
</button>`;
};

/** One cubic-bezier per dependency→dependent edge, from the dependency's right-center
 *  to the dependent's left-center — computed from the exact same coordinates as the
 *  nodes, so the overlay can never drift out of sync with them. */
const treeEdges = (milestones, pos) =>
  milestones
    .flatMap((m) =>
      m.dependsOn.map((dep) => {
        const from = pos.get(dep);
        const to = pos.get(m.id);
        if (!from || !to) return "";
        const x1 = from.x + NODE_W;
        const y1 = from.y + NODE_H / 2;
        const x2 = to.x;
        const y2 = to.y + NODE_H / 2;
        const mx = (x1 + x2) / 2;
        return `<path class="tt-edge" data-from="${esc(dep)}" data-to="${esc(m.id)}" d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}"></path>`;
      })
    )
    .join("");

const treeView = (milestones) => {
  const byId = new Map(milestones.map((m) => [m.id, m]));
  const { pos, width, height } = treeLayout(milestones);
  const nodes = milestones.map((m) => treeNode(m, pos, byId)).join("");
  const edges = treeEdges(milestones, pos);
  const details = milestones.map((m) => card(m, { withDue: true, extraClass: " tt-detail" })).join("");
  return `<section class="view-tree">
  <div class="tt-graph">
    <div class="tt-grid" style="width:${width}px;height:${height}px">
      <svg class="tt-edges" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${edges}</svg>
      ${nodes}
    </div>
  </div>
  <div class="tt-detail-wrap">
    <p class="tt-hint">Click a milestone to see what it needs and what it unlocks.</p>
    ${details}
  </div>
</section>`;
};

/* ------------------------------------------------- ADR 0008: the where split */

const whereSplit = (milestones, meta) => {
  const total = milestones.length;
  const own = milestones.filter((m) => m.fields.Where === "Own time").length;
  const work = total - own;
  const pct = (n) => (total ? (n / total) * 100 : 0).toFixed(4);

  const reading =
    own === 0
      ? "Every milestone in this plan is doable inside work hours."
      : work === 0
        ? `<b>All ${total}</b> milestones fall outside work hours — the whole plan runs on evenings and weekends.`
        : `<b>${own} of ${total}</b> milestones fall outside work hours${own > work ? " — this plan leans on evenings and weekends." : "; the other " + work + " are taken at work."}`;

  const capacity = meta.own_time_capacity
    ? `<p class="split-cap">Stated capacity outside work: ${esc(meta.own_time_capacity)}.</p>`
    : "";

  return `<div class="split">
  <div class="split-head">Where the work happens
    <span class="k-work">At work ${work}</span><span class="k-own">Own time ${own}</span></div>
  <div class="split-bar"><i class="s-work" style="width:${pct(work)}%"></i><i class="s-own" style="width:${pct(own)}%"></i></div>
  <p class="split-read">${reading}</p>
  ${capacity}
</div>`;
};

/* ---------------------------------------------------------------- whole page */

/* Verbatim from ADR 0004 — this wording is the decision, not a paraphrase of it. */
const HONESTY_NOTE = `<p class="note"><b>Ticks live in this browser only.</b> They are a convenience — they are not saved to <code>roadmap.md</code> and they will not follow you to another device. The file on your machine is the record: set <code>- [x]</code> and fill <code>Completed:</code> there.</p>`;

const header = (milestones, meta) => {
  const total = milestones.length;
  const done = milestones.filter((m) => m.done).length;
  // ADR 0015: roadmap-wide action-item tally, gated on total > 0 so a roadmap with no
  // Steps at all (e.g. fixtures/out-of-reach) renders nothing extra here.
  const actionTotals = milestones.reduce(
    (acc, m) => {
      const t = actionTally(m);
      return { done: acc.done + t.done, total: acc.total + t.total };
    },
    { done: 0, total: 0 }
  );
  const tasksMeter =
    actionTotals.total > 0
      ? `<div class="meter tasks-meter"><div class="bar"><i style="width:${(actionTotals.done / actionTotals.total) * 100}%"></i></div><b class="tally">${actionTotals.done} of ${actionTotals.total} action items done</b></div>`
      : "";
  const span = meta.window_start && meta.window_end
    ? `${fmtDate(meta.window_start)} – ${fmtDate(meta.window_end)}`
    : "";
  const sub = [
    `${total} milestone${total === 1 ? "" : "s"}`,
    span,
    "every milestone earns a line on the projection",
  ].filter(Boolean).join(" · ");
  const source = meta.target_source
    ? `<p class="sub">Target read from <code>${esc(meta.target_source)}</code></p>`
    : "";

  // ADR 0011: when the real target is out of reach, the page must never imply this
  // window reaches it. Name both hops, in the masthead, before anything else.
  const hops = meta.ultimate_target
    ? `<p class="hops"><span class="hop-now">This window →
         <b>${esc(meta.target || "the next role")}</b></span>
       <span class="hop-next">Then → <b>${esc(meta.ultimate_target)}</b>${
         meta.next_hop_horizon ? `, ${esc(meta.next_hop_horizon)}` : ""
       }</span></p>`
    : "";

  return `<header>
  <p class="eyebrow">Roadmap${meta.generated ? ` · generated ${esc(fmtDate(meta.generated))}` : ""}</p>
  <h1>${esc(meta.target || "Roadmap")}</h1>
  <p class="sub">${esc(sub)}</p>
  ${source}
  ${hops}
  <div class="meter"><div class="bar"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div><b class="tally">${done} of ${total} done</b></div>
  ${tasksMeter}
  ${HONESTY_NOTE}
  ${whereSplit(milestones, meta)}
</header>`;
};

/**
 * The one place free prose survives into the page. Everything else outside the schema is
 * dropped, so this is where an explanation of the plan — what a constraint cost, what was
 * assumed — has to live if the user is to see it.
 */
const noteBlock = (note) =>
  note
    ? `<section class="plan-note">${note
        .split(/\n{2,}/)
        .map((para) => `<p>${esc(para.replace(/\n/g, " ").trim())}</p>`)
        .join("")}</section>`
    : "";

/**
 * ADR 0011's gap classification. "Needs a different job first" is the class that must not
 * be quiet — it is the reason the plan is two hops — so it is rendered last and loudest.
 */
const reachabilityBlock = (groups) => {
  if (groups.length === 0) return "";
  const order = gapClasses();
  const sorted = [...groups].sort(
    (a, b) => (order.indexOf(a.gap) + 1 || 99) - (order.indexOf(b.gap) + 1 || 99)
  );
  const cls = (gap) =>
    gap === "Needs a different job first" ? "gap-blocked" : gap === "Needs longer" ? "gap-longer" : "gap-open";
  return `<section class="reachability">
  <h2>What the target asks for</h2>
  <div class="gaps">${sorted
    .map(
      (g) => `<div class="gap ${cls(g.gap)}">
      <h3>${esc(g.gap)}</h3>
      <ul>${g.requirements.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
    </div>`
    )
    .join("")}</div>
</section>`;
};

/** Inlined assets must not be able to close their own tag. */
const inlineSafe = (text) => text.replace(/<\/(script|style)/gi, "<\\/$1");

const page = ({ milestones, meta, reachability = [], note = "" }) => {
  const css = inlineSafe(readFileSync(resolve(ASSETS, "roadmap.css"), "utf8"));
  const js = inlineSafe(readFileSync(resolve(ASSETS, "roadmap.client.js"), "utf8"));
  const title = `Roadmap — ${meta.target || "projection"}${meta.window_end ? `, by ${fmtDate(meta.window_end)}` : ""}`;

  return `<!doctype html>
<!-- Generated by skills/your-next-resume/scripts/render-roadmap.mjs. Edit roadmap.md, not this file. -->
<html lang="en" data-view="timeline" data-roadmap-key="${esc(slug(meta.target))}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
${css}
</style>
</head>
<body>
<div class="wrap">
${header(milestones, meta)}
${noteBlock(note)}
${reachabilityBlock(reachability)}
${timelineView(milestones)}
${treeView(milestones)}
</div>

<nav class="switch">
  <b>View</b>
  <button type="button" data-v="timeline" aria-pressed="true">Timeline</button>
  <button type="button" data-v="tree" aria-pressed="false">Map</button>
</nav>

<script>
${js}
</script>
</body>
</html>
`;
};

/* ---------------------------------------------------------------------- main */

const usage = "usage: node render-roadmap.mjs [roadmap.md] <out.html>";

const readArgs = (argv) => {
  if (argv.length === 1) return { input: DEFAULT_INPUT, output: resolve(argv[0]) };
  if (argv.length === 2) return { input: resolve(argv[0]), output: resolve(argv[1]) };
  throw new Error(usage);
};

const main = (argv) => {
  const { input, output } = readArgs(argv);
  if (!/\.html?$/i.test(output)) throw new Error(`output must be an .html file\n${usage}`);

  let text;
  try {
    text = readFileSync(input, "utf8");
  } catch (err) {
    throw new Error(`cannot read roadmap "${input}": ${err.message}`);
  }

  const { meta, milestones, reachability, note } = parseRoadmap(text);
  validate(milestones, input);

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, page({ milestones, meta, reachability, note }), "utf8");
  process.stdout.write(`✓ ${output} — ${milestones.length} milestones, timeline + map\n`);
};

try {
  main(process.argv.slice(2));
} catch (err) {
  process.stderr.write(`render-roadmap: ${err.message}\n`);
  process.exit(1);
}
