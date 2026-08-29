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
import { splitFrontmatter } from "../skills/your-next-resume/scripts/parse.mjs";
// One implementation of the schema rules: the same checker the skill ships and runs.
import { checkOutput } from "../skills/your-next-resume/scripts/check-output.mjs";

const SKILL = "skills/your-next-resume/SKILL.md";
const FIXTURES = ["fixtures/alex-moreau", "fixtures/out-of-reach"];
// The DOCX fixture mirrors the Alex Moreau resume, so it is checked against that projection.
const PROJECTION = "fixtures/alex-moreau/projection.md";
const EXTRACTOR = "skills/your-next-resume/scripts/docx-to-text.mjs";
const DOCX = "fixtures/docx/sample-resume.docx";

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
for (const dir of FIXTURES) for (const p of checkOutput(dir)) problems.push(p);
validateDocx(DOCX, PROJECTION);

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error("");
  process.exit(1);
}
console.log("✓ SKILL.md frontmatter, fixture schema and DOCX extraction are valid");
