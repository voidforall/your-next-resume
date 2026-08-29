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
 * Exits non-zero with a list of problems. Never mutates anything.
 */
import { readFile } from "node:fs/promises";
import { basename, dirname } from "node:path";

const SKILL = "skills/your-next-resume/SKILL.md";
const ROADMAP = "fixtures/alex-moreau/roadmap.md";
const PROJECTION = "fixtures/alex-moreau/projection.md";

const problems = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);

/** Split `---\n...\n---\n` frontmatter from the body. Returns [rawFrontmatter, body]. */
const splitFrontmatter = (text) => {
  if (!text.startsWith("---\n")) return [null, text];
  const end = text.indexOf("\n---", 3);
  return end === -1 ? [null, text] : [text.slice(4, end), text.slice(end + 4)];
};

/** Flat `key: value` reader — enough for the fields we validate, no YAML dependency. */
const readFields = (raw) =>
  Object.fromEntries(
    raw
      .split("\n")
      .filter((l) => /^[a-z_-]+:/.test(l))
      .map((l) => {
        const i = l.indexOf(":");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );

async function validateSkill(path) {
  const text = await readFile(path, "utf8");
  const [raw] = splitFrontmatter(text);
  if (!raw) return fail(path, "no YAML frontmatter, or it does not start on line 1");

  const f = readFields(raw);
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

/** Parse `## M<n> — title` sections into {id, title, fields, earns}. */
const parseMilestones = (text) => {
  const sections = text.split(/\n(?=## )/).filter((s) => s.startsWith("## M"));
  return sections.map((s) => {
    const id = s.match(/^## (M\d+)/)?.[1] ?? "?";
    const fields = Object.fromEntries(
      [...s.matchAll(/^- \*\*([A-Za-z ]+):\*\*\s*(.*)$/gm)].map((m) => [m[1].trim(), m[2].trim()])
    );
    const earns = [...s.matchAll(/^- `([CRP]\d+)` · \*([^*]+)\* — (.+)$/gm)].map((m) => ({
      id: m[1], section: m[2].trim(), text: m[3].trim(),
    }));
    return { id, fields, earns, hasCheckbox: /^- \[[ x]\] done$/m.test(s) };
  });
};

async function validateFixture(roadmapPath, projectionPath) {
  const roadmap = await readFile(roadmapPath, "utf8");
  const projection = await readFile(projectionPath, "utf8");
  const [rawFm] = splitFrontmatter(roadmap);
  if (!rawFm) return fail(roadmapPath, "no frontmatter");

  const meta = readFields(rawFm);
  const { window_start: start, window_end: end } = meta;
  if (!start || !end) fail(roadmapPath, "frontmatter needs window_start and window_end");

  const milestones = parseMilestones(roadmap);
  if (milestones.length === 0) return fail(roadmapPath, "no milestones parsed");

  const ids = new Set(milestones.map((m) => m.id));
  const bulletIds = new Set();
  const sections = new Set(
    [...projection.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim())
  );

  for (const m of milestones) {
    const at = `${roadmapPath} ${m.id}`;
    if (!m.hasCheckbox) fail(at, "missing `- [ ] done` checkbox");
    for (const req of ["Start", "Due", "Where", "Deliverable", "Evidence", "Depends on", "Completed"])
      if (!(req in m.fields)) fail(at, `missing **${req}:**`);

    // ADR 0008: every milestone declares where the work happens.
    if (m.fields.Where && !["At work", "Own time"].includes(m.fields.Where))
      fail(at, `Where must be "At work" or "Own time", got "${m.fields.Where}"`);

    for (const dateField of ["Start", "Due"]) {
      const d = m.fields[dateField];
      if (d && (d < start || d > end)) fail(at, `${dateField} ${d} falls outside the window`);
    }

    const deps = (m.fields["Depends on"] ?? "—").trim();
    if (deps !== "—")
      for (const dep of deps.split(",").map((d) => d.trim()))
        if (!ids.has(dep)) fail(at, `Depends on unknown milestone ${dep}`);

    if (m.earns.length === 0) fail(at, "earns no bullets");
    for (const e of m.earns) {
      if (bulletIds.has(e.id)) fail(at, `duplicate bullet id ${e.id}`);
      bulletIds.add(e.id);
      if (e.id.startsWith("P")) {
        const section = e.section.replace(/^Experience — /, "Experience — ");
        const known = [...sections].some((s) => s === section || s.startsWith(section));
        if (!known && section !== "Header")
          fail(at, `bullet ${e.id} targets section "${e.section}", which projection.md does not define`);
      }
    }
  }

  // Every reframed bullet in projection.md must carry its original wording.
  for (const m of projection.matchAll(/^- `(R\d+)` — (.+)$/gm)) {
    const after = projection.slice(m.index + m[0].length, m.index + m[0].length + 400);
    if (!/^\s*\n?\s*- \*\*Was:\*\*/.test(after))
      fail(`${projectionPath} ${m[1]}`, "reframed bullet has no **Was:** line");
  }
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
