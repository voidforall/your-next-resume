#!/usr/bin/env node
/**
 * check-output.mjs — validate a generated roadmap.md + projection.md before rendering.
 *
 *   node check-output.mjs <directory containing both files>
 *
 * The renderers parse with exact patterns, so a plausible-looking variant produces a file
 * that parses to nothing — or, for a mis-spelled gap class, to the opposite of what was
 * meant. This catches that while it is still cheap to fix. Zero dependencies.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseRoadmap, parseProjection, gapClasses } from "./parse.mjs";

const REQUIRED_FIELDS = ["Start", "Due", "Where", "Deliverable", "Evidence", "Depends on", "Completed"];
const WHERE_VALUES = ["At work", "Own time"];

/** Returns an array of human-readable problems; empty means the files are sound. */
export function checkOutput(dir) {
  const problems = [];
  const fail = (where, msg) => problems.push(`${where}: ${msg}`);

  const roadmapPath = join(dir, "roadmap.md");
  const projectionPath = join(dir, "projection.md");

  let roadmap;
  let projection;
  try {
    roadmap = parseRoadmap(readFileSync(roadmapPath, "utf8"));
  } catch (err) {
    return [`${roadmapPath}: cannot read — ${err.message}`];
  }
  try {
    projection = parseProjection(readFileSync(projectionPath, "utf8"));
  } catch (err) {
    return [`${projectionPath}: cannot read — ${err.message}`];
  }

  const { meta, milestones, reachability } = roadmap;
  const { meta: projMeta, sections } = projection;

  if (!meta.window_start || !meta.window_end)
    fail(roadmapPath, "frontmatter needs `window_start` and `window_end`");
  if (!meta.target) fail(roadmapPath, "frontmatter needs `target`");
  if (!projMeta.name) fail(projectionPath, "frontmatter needs `name`");
  if (milestones.length === 0)
    fail(roadmapPath, "no milestones parsed — check the `## M<n> — title` heading grammar");

  const ids = new Set(milestones.map((m) => m.id));
  const projectedIds = new Set();
  const referencedReframes = new Map();
  const projectionIds = new Set();
  const sectionNames = sections.map((s) => s.name);

  for (const m of milestones) {
    const at = `${roadmapPath} ${m.id}`;
    if (!m.title) fail(at, "heading has no title after the em dash");
    for (const field of REQUIRED_FIELDS)
      if (!(field in m.fields)) fail(at, `missing **${field}:** — check the \`- **Name:** value\` grammar`);

    if (m.fields.Where && !WHERE_VALUES.includes(m.fields.Where))
      fail(at, `Where must be "At work" or "Own time", got "${m.fields.Where}"`);

    if (m.fields.Evidence && /^(learn|learned|study|studied|read|familiar)/i.test(m.fields.Evidence))
      fail(at, `Evidence describes learning, not an artifact: "${m.fields.Evidence}"`);

    for (const field of ["Start", "Due"]) {
      const d = m.fields[field];
      if (!d) continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) fail(at, `${field} "${d}" is not an ISO date`);
      else if (meta.window_start && meta.window_end && (d < meta.window_start || d > meta.window_end))
        fail(at, `${field} ${d} falls outside the window`);
    }

    for (const dep of m.dependsOn)
      if (!ids.has(dep)) fail(at, `Depends on unknown milestone ${dep}`);

    if (m.hasStepsHeading && m.steps.length === 0)
      fail(at, "has a **Steps** heading but no steps parsed — check the `- [ ] text` / `- [x] text` checkbox grammar");
    m.steps.forEach((step, si) => {
      if (step.text.trim().toLowerCase() === "done")
        fail(at, 'a Steps item\'s text must not be exactly "done" — it is indistinguishable from the milestone\'s own `- [x] done` line');
      if (step.hasTaskIndentIssue)
        fail(at, `Step ${si + 1} ("${step.text}") has a Task-like line that isn't indented by exactly two spaces — check the "  - [ ] text" / "  - [x] text" grammar`);
    });

    if (m.earns.length === 0)
      fail(at, "earns no bullets — check the `- `P1` · *Section* — text` grammar (middle dot, em dash)");

    for (const e of m.earns) {
      // A projected bullet is DEFINED here and may exist nowhere else. A reframed bullet is
      // defined in projection.md and merely REFERENCED here, by the milestone whose work
      // substantiates it — so the same R id legitimately appears in both files.
      if (e.kind === "projected") {
        if (projectedIds.has(e.id)) fail(at, `duplicate projected bullet id ${e.id}`);
        projectedIds.add(e.id);
      } else if (e.kind === "reframed") {
        // A Header reframe has no bullet to point at — its `Was:` lives in frontmatter.
        if (e.section !== "Header") referencedReframes.set(e.id, m.id);
      } else {
        fail(at, `${e.id} is a carried bullet — carried bullets belong in projection.md, not in a milestone`);
      }
      if (e.kind === "projected" && e.section !== "Header") {
        const known = sectionNames.some((s) => s === e.section || s.startsWith(e.section));
        if (!known)
          fail(at, `bullet ${e.id} targets section "${e.section}", which projection.md does not define`);
      }
    }
  }

  for (const s of sections)
    for (const b of s.bullets) {
      if (b.kind === "projected")
        fail(`${projectionPath} ${b.id}`, "projected bullets belong inside the milestone that earns them");
      if (b.kind === "reframed" && !b.was)
        fail(`${projectionPath} ${b.id}`, "reframed bullet has no **Was:** line");
      if (projectionIds.has(b.id)) fail(`${projectionPath} ${b.id}`, "duplicate bullet id");
      projectionIds.add(b.id);
      if (projectedIds.has(b.id))
        fail(`${projectionPath} ${b.id}`, "id collides with a projected bullet in roadmap.md");
    }

  // A milestone may only claim to earn a reframe that actually exists in projection.md.
  for (const [id, milestoneId] of referencedReframes)
    if (!projectionIds.has(id))
      fail(roadmapPath, `${milestoneId} earns reframed bullet ${id}, which projection.md does not define`);

  const headerReframe = milestones
    .flatMap((m) => m.earns)
    .find((e) => e.kind === "reframed" && e.section === "Header");
  if (headerReframe && !projMeta.headline_was)
    fail(projectionPath, `${headerReframe.id} reframes the headline, so frontmatter needs \`headline_was:\``);
  if (projMeta.headline_was && projMeta.headline_was === projMeta.headline)
    fail(projectionPath, "`headline_was:` is identical to `headline:` — nothing was reframed");

  // ADR 0011 — the out-of-reach fields travel together, or the page half-tells the story.
  if (meta.ultimate_target) {
    if (!meta.next_hop_horizon)
      fail(roadmapPath, "`ultimate_target` is set but `next_hop_horizon` is missing");
    if (reachability.length === 0)
      fail(roadmapPath, "`ultimate_target` is set but there is no `## Reachability` section");
  } else if (reachability.length > 0) {
    fail(roadmapPath, "a `## Reachability` section is present but `ultimate_target` is not set");
  }

  for (const group of reachability) {
    if (!gapClasses().includes(group.gap))
      fail(roadmapPath, `unknown gap class "${group.gapWritten ?? group.gap}" — expected one of: ${gapClasses().join(", ")}`);
    else if (group.gapWritten && group.gapWritten !== group.gap)
      fail(
        roadmapPath,
        `gap class written as "${group.gapWritten}"; the exact heading is "${group.gap}" — it was read correctly here, but write it exactly`
      );
  }

  return problems;
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (invokedDirectly) {
  const dir = process.argv[2];
  if (!dir) {
    console.error("usage: check-output.mjs <directory containing roadmap.md and projection.md>");
    process.exit(2);
  }
  const problems = checkOutput(dir);
  if (problems.length) {
    console.error(`\n${problems.length} problem(s):\n`);
    for (const p of problems) console.error(`  ✗ ${p}`);
    console.error("\nFix these before rendering — the renderers will not catch them.\n");
    process.exit(1);
  }
  console.log("✓ roadmap.md and projection.md are sound");
}
