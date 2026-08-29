#!/usr/bin/env node
/**
 * Zero-dependency validation for the repo's invariants.
 *
 *   node tools/validate.mjs
 *
 * 1. SKILL.md frontmatter — a malformed one is silently skipped by the installer,
 *    so a broken release would look like an empty repo rather than an error.
 * 2. The fixture roadmap.md / projection.md against the ADR 0002 schema.
 * 3. The ADR 0009 DOCX extractor against its fixture — that it recovers the text,
 *    including the experience laid out in a table, and that it fails loudly on a
 *    file that is not a DOCX so the intake ladder can fall through.
 *
 * Parsing lives in the skill's scripts/parse.mjs so the schema is read exactly one way.
 */
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { basename, dirname } from "node:path";
import {
  splitFrontmatter,
  parseRoadmap,
  parseProjection,
} from "../skills/your-next-resume/scripts/parse.mjs";

const SKILL = "skills/your-next-resume/SKILL.md";
const ROADMAP = "fixtures/alex-moreau/roadmap.md";
const PROJECTION = "fixtures/alex-moreau/projection.md";
const EXTRACTOR = "skills/your-next-resume/scripts/docx-to-text.mjs";
const DOCX = "fixtures/docx/sample-resume.docx";
const REQUIRED = ["Start", "Due", "Where", "Deliverable", "Evidence", "Depends on", "Completed"];

// Each line proves one thing the extractor must not drop: a plain paragraph, the
// <w:tab/> separator, named and numeric entities, the <w:br/> break, and — the one
// a naive extractor loses — the experience laid out inside <w:tbl>.
const DOCX_EXPECTED = [
  "Alex Moreau",
  "Senior Backend Engineer\talex@example.com\tBerlin",
  "Platform & Reliability \u2014 ten years shipping",
  "Open to lead roles.",
  "2022 \u2013 present",
  "Northwind Logistics \u2014 Senior Backend Engineer",
  "Own the order-routing service handling 40M requests a day across three regions.",
  "Mentor three engineers; run the team's on-call review.",
  "Kestrel Systems \u2014 Backend Engineer",
  "Python \u00b7 Go \u00b7 Postgres",
];

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
  const { meta: projectionMeta, sections } = parseProjection(await readFile(projectionPath, "utf8"));

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

  // ADR 0001: a headline reframe must keep the wording it replaced too, and its
  // `Was:` has nowhere to live except frontmatter (ADR 0002).
  const headerReframe = milestones
    .flatMap((m) => m.earns)
    .find((e) => e.kind === "reframed" && e.section === "Header");
  if (headerReframe && !projectionMeta.headline_was)
    fail(
      projectionPath,
      `${headerReframe.id} reframes the headline, so frontmatter needs \`headline_was:\``
    );

  // ADR 0001: a reframed bullet must keep the wording it replaced.
  for (const s of sections)
    for (const b of s.bullets)
      if (b.kind === "reframed" && !b.was)
        fail(`${projectionPath} ${b.id}`, "reframed bullet has no **Was:** line");
}

function runExtractor(file) {
  return execFileSync(process.execPath, [EXTRACTOR, file], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function validateDocx(docxPath, notDocxPath) {
  let text;
  try {
    text = runExtractor(docxPath);
  } catch (err) {
    return fail(docxPath, `extractor exited non-zero: ${(err.stderr || err.message).trim()}`);
  }
  for (const line of DOCX_EXPECTED)
    if (!text.includes(line)) fail(docxPath, `extracted text is missing ${JSON.stringify(line)}`);

  // ADR 0009: the ladder only falls through to textutil or paste if this fails loudly,
  // so silence on a non-DOCX is the bug worth a CI check of its own.
  try {
    runExtractor(notDocxPath);
    fail(EXTRACTOR, `exited 0 on ${notDocxPath}, which is not a DOCX`);
  } catch (err) {
    if (err.status === undefined) throw err;
    if (!/not a DOCX/.test(err.stderr || ""))
      fail(EXTRACTOR, `rejected ${notDocxPath} without saying it is not a DOCX: ${(err.stderr || "").trim()}`);
  }
}

await validateSkill(SKILL);
await validateFixture(ROADMAP, PROJECTION);
validateDocx(DOCX, PROJECTION);

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error("");
  process.exit(1);
}
console.log("✓ SKILL.md frontmatter, fixture schema and DOCX extraction are valid");
