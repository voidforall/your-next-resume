#!/usr/bin/env node
/**
 * Render the diptych: Current Resume left, Projection right.
 *
 *   node render-projection.mjs <out.html> [--source <dir>]
 *                              [--projection <file>] [--roadmap <file>]
 *
 * Zero dependencies. Reads the ADR 0002 source files through scripts/parse.mjs, which is
 * the single source of parsing truth, and emits one self-contained HTML file — the CSS is
 * inlined and no font, image or script is fetched, so the page renders with no network.
 *
 * The visual language is settled in ADR 0003 and implemented here, not decided here:
 *   carried   plain paper, no gutter
 *   reframed  `~` gutter, amber row, REFRAMED tag, `Was:` line beneath in italic
 *   projected `+` gutter, green row, PROJECTED · <month year> tag, where the date is the
 *             `Due:` of the Milestone that earns the bullet — so bullets are joined to
 *             milestones by id, per ADR 0002.
 *
 * Printing emits the Projection panel alone; that print is the shipped PDF.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseProjection, parseRoadmap } from "./parse.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const STYLESHEET = join(HERE, "..", "assets", "projection.css");
const DEFAULT_SOURCE = resolve(HERE, "..", "..", "..", "fixtures", "alex-moreau");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// ---------------------------------------------------------------- arguments

const parseArgs = (argv) => {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith("--")) flags[argv[i].slice(2)] = argv[++i];
    else positional.push(argv[i]);
  }
  const source = flags.source ? resolve(flags.source) : DEFAULT_SOURCE;
  return {
    out: positional[0],
    projection: resolve(flags.projection ?? join(source, "projection.md")),
    roadmap: resolve(flags.roadmap ?? join(source, "roadmap.md")),
  };
};

// ---------------------------------------------------------------- dates

/** "2027-02-28" → "28 Feb 2027". Throws rather than emitting an undated Stamp. */
const longDate = (iso, where) => {
  const m = ISO_DATE.exec(iso ?? "");
  if (!m) throw new Error(`${where}: expected an ISO date (YYYY-MM-DD), got "${iso ?? ""}"`);
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
};

/** "2026-10-15" → "Oct 2026", the granularity ADR 0003 puts on a projected tag. */
const monthYear = (iso, where) => {
  const m = ISO_DATE.exec(iso ?? "");
  if (!m) throw new Error(`${where}: expected an ISO date (YYYY-MM-DD), got "${iso ?? ""}"`);
  return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
};

// ---------------------------------------------------------------- model

/**
 * Join projected bullets to the Milestone that earns them, keyed by bullet id.
 * A bullet earned by several Milestones is dated by the last of them: it becomes
 * claimable only once every earning Milestone is done.
 */
const earningMilestones = (milestones) => {
  const byBullet = new Map();
  for (const m of milestones) {
    for (const e of m.earns) {
      const held = byBullet.get(e.id);
      const due = m.fields.Due ?? "";
      if (!held || due > (held.milestone.fields.Due ?? "")) byBullet.set(e.id, { earn: e, milestone: m });
    }
  }
  return byBullet;
};

/**
 * Resolve the section a projected bullet names to a section of projection.md.
 * Exact match wins; otherwise a section whose name starts with it, which is how a
 * milestone says "Experience — Northwind Logistics" about a section that also carries
 * the role and the dates. Same rule as tools/validate.mjs, deliberately.
 */
const resolveSection = (named, sections) =>
  sections.find((s) => s.name === named) ?? sections.find((s) => s.name.startsWith(named));

/**
 * projection.md's sections, each with its Projected Bullets appended in roadmap order.
 * Returns [{ name, bullets: [{ id, kind, text, was?, due? }] }].
 */
const assemble = (projection, roadmap) => {
  const byBullet = earningMilestones(roadmap.milestones);
  const bullets = new Map(projection.sections.map((s) => [s.name, [...s.bullets]]));

  for (const [id, { earn, milestone }] of byBullet) {
    if (earn.kind !== "projected" || earn.section === "Header") continue;
    const target = resolveSection(earn.section, projection.sections);
    if (!target)
      throw new Error(
        `${milestone.id} earns ${id} into section "${earn.section}", which projection.md does not define`
      );
    bullets.get(target.name).push({
      id,
      kind: "projected",
      text: earn.text,
      due: monthYear(milestone.fields.Due, `${milestone.id} Due:`),
    });
  }

  return projection.sections.map((s) => ({ name: s.name, bullets: bullets.get(s.name) }));
};

/** The left panel: the same document with every reframe reverted and every projection dropped. */
const asToday = (sections) =>
  sections.map((s) => ({
    name: s.name,
    bullets: s.bullets
      .filter((b) => b.kind !== "projected")
      .map((b) => ({ id: b.id, kind: "carried", text: b.kind === "reframed" ? b.was : b.text })),
  }));

/**
 * "Experience — Northwind Logistics, Senior Backend Engineer, 2022 – present"
 *   → { heading: "Experience", entity: "Northwind Logistics, Senior Backend Engineer",
 *       dates: "2022 – present" }
 * A section with no ` — ` (Projects, Skills) is just a heading.
 */
const splitSectionName = (name) => {
  const at = name.indexOf(" — ");
  if (at === -1) return { heading: name, entity: null, dates: null };
  const rest = name.slice(at + 3).trim();
  const dated = /^(.*),\s*([^,]*\d{4}[^,]*)$/.exec(rest);
  return dated
    ? { heading: name.slice(0, at).trim(), entity: dated[1].trim(), dates: dated[2].trim() }
    : { heading: name.slice(0, at).trim(), entity: rest, dates: null };
};

// ---------------------------------------------------------------- html

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const GUTTER = { carried: "&nbsp;", reframed: "~", projected: "+" };

const tagFor = (bullet) => {
  if (bullet.kind === "reframed") return "Reframed";
  if (bullet.kind === "projected") return `Projected · ${bullet.due}`;
  return null;
};

const renderBullet = (bullet) => {
  const tag = tagFor(bullet);
  return [
    `        <li data-kind="${bullet.kind}">`,
    `<span class="gutter">${GUTTER[bullet.kind]}</span>`,
    tag ? `<span class="meta"><span class="tag">${esc(tag)}</span></span>` : "",
    esc(bullet.text),
    bullet.kind === "reframed" && bullet.was
      ? `<span class="was"><b>Was:</b> ${esc(bullet.was)}</span>`
      : "",
    "</li>",
  ].join("");
};

/** Consecutive sections sharing a heading ("Experience") print it once, then a role line each. */
const renderSections = (sections) => {
  const out = [];
  let heading = null;
  for (const section of sections) {
    if (section.bullets.length === 0) continue;
    const part = splitSectionName(section.name);
    if (part.heading !== heading) {
      out.push(`        <h2>${esc(part.heading)}</h2>`);
      heading = part.heading;
    }
    if (part.entity)
      out.push(
        `        <div class="role"><b>${esc(part.entity)}</b>` +
          (part.dates ? `<span>${esc(part.dates)}</span>` : "") +
          `</div>`
      );
    out.push("        <ul>", ...section.bullets.map(renderBullet), "        </ul>");
  }
  return out.join("\n");
};

const renderHeader = (meta) =>
  [
    `        <div class="hdr">`,
    `          <div>`,
    `            <h1 class="name">${esc(meta.name)}</h1>`,
    meta.headline ? `            <p class="headline">${esc(meta.headline)}</p>` : "",
    `          </div>`,
    meta.contact ? `          <p class="contact">${esc(meta.contact)}</p>` : "",
    `        </div>`,
  ]
    .filter(Boolean)
    .join("\n");

/** ADR 0003's Stamp band, worded exactly as the ADR words it. */
const renderStamp = (targetDate) =>
  [
    `        <div class="stamp">`,
    `          <span>Projected state · ${esc(targetDate)} — earned only if the roadmap is completed</span>`,
    `          <em>Not a record of experience</em>`,
    `        </div>`,
  ].join("\n");

const renderPage = ({ meta, sections, stamp }) =>
  [
    renderHeader(meta),
    stamp ? renderStamp(stamp) : "",
    renderSections(sections),
  ]
    .filter(Boolean)
    .join("\n");

const renderDocument = ({ meta, today, projected, targetDate, css }) => `<!doctype html>
<!--
  Generated by skills/your-next-resume/scripts/render-projection.mjs — do not hand-edit.
  Left: the Current Resume. Right: the Projection, per ADR 0003.
  Printing emits the right panel alone; that print is the shipped PDF.
-->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PROJECTION — ${esc(meta.name)} — target state ${esc(targetDate)} — not a record of experience</title>
<style>
${css}</style>
</head>
<body>
<div class="shell">
  <div class="diptych">
    <section class="today-panel">
      <p class="panel-label">Current resume — today</p>
      <article class="page">
${renderPage({ meta, sections: today, stamp: null })}
      </article>
    </section>
    <section class="projection-panel">
      <p class="panel-label">Projection — ${esc(targetDate)}</p>
      <article class="page projection">
${renderPage({ meta, sections: projected, stamp: targetDate })}
      </article>
    </section>
  </div>
</div>
</body>
</html>
`;

// ---------------------------------------------------------------- input checks

/** Fail loudly at the boundary rather than emitting a document that lies by omission. */
const check = (projection, roadmap, paths) => {
  if (!projection.meta.name) throw new Error(`${paths.projection}: frontmatter has no \`name\``);
  if (!roadmap.meta.window_end)
    throw new Error(`${paths.roadmap}: frontmatter has no \`window_end\`, so the Stamp has no date`);
  if (roadmap.milestones.length === 0)
    throw new Error(`${paths.roadmap}: no milestones parsed — projected bullets would have nothing to earn them`);
  if (projection.sections.length === 0) throw new Error(`${paths.projection}: no sections parsed`);
  for (const s of projection.sections)
    for (const b of s.bullets)
      if (b.kind === "reframed" && !b.was)
        throw new Error(
          `${paths.projection} ${b.id}: reframed bullet has no **Was:** line, so the diptych cannot show the reframe honestly`
        );
};

// ---------------------------------------------------------------- main

const main = async (argv) => {
  const paths = parseArgs(argv);
  if (!paths.out) {
    console.error("usage: render-projection.mjs <out.html> [--source <dir>] [--projection <file>] [--roadmap <file>]");
    process.exit(2);
  }

  const [projectionText, roadmapText, css] = await Promise.all([
    readFile(paths.projection, "utf8"),
    readFile(paths.roadmap, "utf8"),
    readFile(STYLESHEET, "utf8"),
  ]);

  const projection = parseProjection(projectionText);
  const roadmap = parseRoadmap(roadmapText);
  check(projection, roadmap, paths);

  const projected = assemble(projection, roadmap);
  const html = renderDocument({
    meta: projection.meta,
    today: asToday(projected),
    projected,
    targetDate: longDate(roadmap.meta.window_end, `${paths.roadmap} window_end`),
    css,
  });

  await writeFile(resolve(paths.out), html, "utf8");
  console.log(`✓ wrote ${resolve(paths.out)}`);
};

main(process.argv.slice(2)).catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
