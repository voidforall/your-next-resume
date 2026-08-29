#!/usr/bin/env node
/**
 * Render `roadmap.md` as the offline roadmap page (ADR 0004).
 *
 *   node render-roadmap.mjs <roadmap.md> <out.html>
 *   node render-roadmap.mjs <out.html>            # defaults to the Alex Moreau fixture
 *
 * Both views are rendered server-side, so the page is complete before a line of
 * script runs; roadmap.client.js only adds the toggle, the localStorage ticks and
 * the meter. Output is one self-contained file: no network, no fonts, no libraries.
 *
 * Zero dependencies. Parsing goes through scripts/parse.mjs, the single source of
 * schema truth (ADR 0002) — this file never reads markdown structure itself.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRoadmap, parseProjection } from "./parse.mjs";

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

  if (problems.length > 0) {
    throw new Error(`${source} does not satisfy the ADR 0002 schema:\n  - ${problems.join("\n  - ")}`);
  }
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

const card = (milestone, { withDue }) => {
  const done = milestone.done;
  return `<article class="card${done ? " done" : ""}" data-m="${esc(milestone.id)}" data-file-done="${done}">
  <div class="card-top">
    <input type="checkbox"${done ? " checked" : ""} aria-label="Mark ${esc(milestone.id)} done">
    <span class="mid">${esc(milestone.id)}</span>
    <h3>${inline(milestone.title)}</h3>
    ${whereChip(milestone.fields.Where)}
    ${withDue ? `<span class="due">due ${esc(fmtDate(milestone.fields.Due))}</span>` : ""}
  </div>
  ${rows(milestone)}
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

/* ------------------------------------------------------- view: by resume line */

/** Invert the same structure: the bullet becomes the subject, milestones the proof. */
const indexBullets = (milestones) => {
  const ordered = [...milestones].sort(byDue);
  const bullets = new Map();
  for (const m of ordered) {
    for (const e of m.earns) {
      const found = bullets.get(e.id);
      if (found) bullets.set(e.id, { ...found, milestones: [...found.milestones, m] });
      else bullets.set(e.id, { ...e, milestones: [m] });
    }
  }
  return [...bullets.values()];
};

const KIND_BLURB = {
  projected: "Projected — not true yet",
  reframed: "Reframed — true today, said in the target's language",
  carried: "Carried — true today, reproduced unchanged",
};

const bulletCard = (bullet) => {
  const refr = bullet.kind !== "projected";
  const proof = bullet.milestones
    .map((m) => `<li data-m="${esc(m.id)}">
    <input type="checkbox"${m.done ? " checked" : ""} aria-label="Mark ${esc(m.id)} done">
    <span class="ms-body"><b>${esc(m.id)}</b> ${inline(m.title)} ${whereChip(m.fields.Where)}<br><span class="sect">${inline(m.fields.Evidence)}</span></span>
    <span class="due">${esc(fmtDate(m.fields.Due))}</span>
  </li>`)
    .join("");
  return `<div class="blt${refr ? " is-refr" : ""}">
  <p class="blt-txt"><span class="bid">${esc(bullet.id)}</span>${inline(bullet.text)}</p>
  <p class="blt-meta">${esc(KIND_BLURB[bullet.kind] ?? bullet.kind)} · earned by ${bullet.milestones.map((m) => esc(m.id)).join(", ")}</p>
  <ol>${proof}</ol>
</div>`;
};

/**
 * Section order follows the resume itself when projection.md is available — the roadmap
 * should read in the order of the document it earns. `Header` leads, since that is where
 * it sits on the resume. Sections the projection does not define keep due-date order, at
 * the end. Without projection.md, everything falls back to due-date order.
 */
const orderSections = (found, resumeOrder) => {
  if (resumeOrder.length === 0) return found;
  const rank = (name) => {
    if (name === "Header") return -1;
    const i = resumeOrder.findIndex((s) => s === name || s.startsWith(name));
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...found].sort((a, b) => rank(a) - rank(b) || found.indexOf(a) - found.indexOf(b));
};

const bulletsView = (milestones, resumeOrder = []) => {
  const bullets = indexBullets(milestones);
  const sections = orderSections([...new Set(bullets.map((b) => b.section))], resumeOrder);
  const groups = sections
    .map((name) => {
      const inSection = bullets
        .filter((b) => b.section === name)
        .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
      return `<section class="grp"><h2>${esc(name)}</h2>${inSection.map(bulletCard).join("")}</section>`;
    })
    .join("");
  return `<section class="view-bullets">${groups}</section>`;
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

  return `<header>
  <p class="eyebrow">Roadmap${meta.generated ? ` · generated ${esc(fmtDate(meta.generated))}` : ""}</p>
  <h1>${esc(meta.target || "Roadmap")}</h1>
  <p class="sub">${esc(sub)}</p>
  ${source}
  <div class="meter"><div class="bar"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div><b class="tally">${done} of ${total} done</b></div>
  ${HONESTY_NOTE}
  ${whereSplit(milestones, meta)}
</header>`;
};

/** Inlined assets must not be able to close their own tag. */
const inlineSafe = (text) => text.replace(/<\/(script|style)/gi, "<\\/$1");

const page = ({ milestones, meta, resumeOrder = [] }) => {
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
${timelineView(milestones)}
${bulletsView(milestones, resumeOrder)}
</div>

<nav class="switch">
  <b>View</b>
  <button type="button" data-v="timeline" aria-pressed="true">Timeline</button>
  <button type="button" data-v="bullets" aria-pressed="false">By resume line</button>
</nav>

<script>
${js}
</script>
</body>
</html>
`;
};

/* ---------------------------------------------------------------------- main */

const usage =
  "usage: node render-roadmap.mjs [roadmap.md] <out.html> [--projection <projection.md>]";

const readArgs = (argv) => {
  const rest = [];
  let projection = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--projection") {
      projection = argv[i + 1] ? resolve(argv[i + 1]) : null;
      if (!projection) throw new Error(`--projection needs a path\n${usage}`);
      i += 1;
    } else rest.push(argv[i]);
  }
  if (rest.length === 1) return { input: DEFAULT_INPUT, output: resolve(rest[0]), projection };
  if (rest.length === 2) return { input: resolve(rest[0]), output: resolve(rest[1]), projection };
  throw new Error(usage);
};

/** Section order from projection.md — named explicitly, or found beside the roadmap. */
const readResumeOrder = (input, explicit) => {
  const path = explicit ?? resolve(dirname(input), "projection.md");
  if (!existsSync(path)) {
    if (explicit) throw new Error(`cannot read projection "${path}"`);
    return [];
  }
  return parseProjection(readFileSync(path, "utf8")).sections.map((s) => s.name);
};

const main = (argv) => {
  const { input, output, projection } = readArgs(argv);
  if (!/\.html?$/i.test(output)) throw new Error(`output must be an .html file\n${usage}`);

  let text;
  try {
    text = readFileSync(input, "utf8");
  } catch (err) {
    throw new Error(`cannot read roadmap "${input}": ${err.message}`);
  }

  const { meta, milestones } = parseRoadmap(text);
  validate(milestones, input);

  mkdirSync(dirname(output), { recursive: true });
  const resumeOrder = readResumeOrder(input, projection);
  writeFileSync(output, page({ milestones, meta, resumeOrder }), "utf8");
  process.stdout.write(`✓ ${output} — ${milestones.length} milestones, timeline + by-resume-line\n`);
};

try {
  main(process.argv.slice(2));
} catch (err) {
  process.stderr.write(`render-roadmap: ${err.message}\n`);
  process.exit(1);
}
