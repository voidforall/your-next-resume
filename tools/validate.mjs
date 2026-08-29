#!/usr/bin/env node
/**
 * Zero-dependency validation for the repo's invariants.
 *
 *   node tools/validate.mjs
 *
 * 1. SKILL.md frontmatter — a malformed one is silently skipped by the installer,
 *    so a broken release would look like an empty repo rather than an error.
 * 2. The fixture roadmap.md / projection.md against the ADR 0002 schema.
 *
 * Parsing lives in the skill's scripts/parse.mjs so the schema is read exactly one way.
 */
import { readFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import {
  splitFrontmatter,
  parseRoadmap,
  parseProjection,
} from "../skills/your-next-resume/scripts/parse.mjs";

const SKILL = "skills/your-next-resume/SKILL.md";
const ROADMAP = "fixtures/alex-moreau/roadmap.md";
const PROJECTION = "fixtures/alex-moreau/projection.md";
const REQUIRED = ["Start", "Due", "Where", "Deliverable", "Evidence", "Depends on", "Completed"];

const problems = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);

async function validateSkill(path) {
  const text = await readFile(path, "utf8");
  if (!text.startsWith("---\n"))
    return fail(path, "no YAML frontmatter, or it does not start on line 1");

  const f = splitFrontmatter(text).meta;
  const dir = basename(dirname(path));

  if (!f.name) fail(path, "missing `name`");
  else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.name))
    fail(path, `name "${f.name}" must be lowercase alphanumeric with single hyphens, no leading/trailing hyphen`);
  else if (f.name.length > 64) fail(path, "name exceeds 64 characters");
  else if (f.name !== dir) fail(path, `name "${f.name}" must match its directory "${dir}"`);
  else if (/anthropic|claude/.test(f.name)) fail(path, 'name may not contain "anthropic" or "claude"');

  if (!f.description) fail(path, "missing `description`");
  else if (f.description.length > 1024) fail(path, "description exceeds 1024 characters");

  if (f.compatibility && f.compatibility.length > 500)
    fail(path, "compatibility exceeds 500 characters");
}

async function validateFixture(roadmapPath, projectionPath) {
  const { meta, milestones } = parseRoadmap(await readFile(roadmapPath, "utf8"));
  const { sections } = parseProjection(await readFile(projectionPath, "utf8"));

  const { window_start: start, window_end: end } = meta;
  if (!start || !end) fail(roadmapPath, "frontmatter needs window_start and window_end");
  if (milestones.length === 0) return fail(roadmapPath, "no milestones parsed");

  const ids = new Set(milestones.map((m) => m.id));
  const sectionNames = sections.map((s) => s.name);
  const seenBullets = new Set();

  for (const m of milestones) {
    const at = `${roadmapPath} ${m.id}`;
    if (!m.title) fail(at, "no title on the heading");
    for (const req of REQUIRED) if (!(req in m.fields)) fail(at, `missing **${req}:**`);

    // ADR 0008: every milestone declares where the work happens.
    if (m.fields.Where && !["At work", "Own time"].includes(m.fields.Where))
      fail(at, `Where must be "At work" or "Own time", got "${m.fields.Where}"`);

    for (const field of ["Start", "Due"]) {
      const d = m.fields[field];
      if (d && start && end && (d < start || d > end))
        fail(at, `${field} ${d} falls outside the window`);
    }

    for (const dep of m.dependsOn)
      if (!ids.has(dep)) fail(at, `Depends on unknown milestone ${dep}`);

    if (m.earns.length === 0) fail(at, "earns no bullets");
    for (const e of m.earns) {
      if (seenBullets.has(e.id)) fail(at, `duplicate bullet id ${e.id}`);
      seenBullets.add(e.id);
      if (e.kind === "projected" && e.section !== "Header") {
        const known = sectionNames.some((s) => s === e.section || s.startsWith(e.section));
        if (!known)
          fail(at, `bullet ${e.id} targets section "${e.section}", which projection.md does not define`);
      }
    }
  }

  // ADR 0001: a reframed bullet must keep the wording it replaced.
  for (const s of sections)
    for (const b of s.bullets)
      if (b.kind === "reframed" && !b.was)
        fail(`${projectionPath} ${b.id}`, "reframed bullet has no **Was:** line");
}

await validateSkill(SKILL);
await validateFixture(ROADMAP, PROJECTION);

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error("");
  process.exit(1);
}
console.log("✓ SKILL.md frontmatter and fixture schema are valid");
