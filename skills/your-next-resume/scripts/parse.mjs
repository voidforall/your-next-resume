/**
 * Readers for the ADR 0002 source files. Zero dependencies.
 *
 *   import { parseRoadmap, parseProjection } from "./parse.mjs";
 *
 * These are the single source of parsing truth: the renderers and tools/validate.mjs
 * all read through here, so the schema is interpreted exactly one way.
 */

/** Split `---\n...\n---\n` frontmatter from the body. Returns { meta, body }. */
export const splitFrontmatter = (text) => {
  if (!text.startsWith("---\n")) return { meta: {}, body: text };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { meta: {}, body: text };
  return { meta: readFields(text.slice(4, end)), body: text.slice(end + 4) };
};

/** Flat `key: value` reader. Enough for our frontmatter; not a YAML parser. */
export const readFields = (raw) =>
  Object.fromEntries(
    raw
      .split("\n")
      .filter((l) => /^[a-z_-]+:/.test(l))
      .map((l) => {
        const i = l.indexOf(":");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );

const GAP_CLASSES = ["Closeable in this window", "Needs longer", "Needs a different job first"];

/**
 * Near-miss headings map to the class they obviously mean. Without this, an unrecognised
 * heading sorts last — which silently renders "needs a different job first" FIRST and drops
 * the stray class into the green card. Getting it wrong must never invert the meaning.
 * `check-output.mjs` still reports the non-canonical spelling.
 */
export const canonicalGap = (heading) => {
  const h = heading.trim().toLowerCase();
  if (h.startsWith("closeable") || h.startsWith("closable")) return GAP_CLASSES[0];
  if (h.startsWith("needs longer") || h === "longer" || h.startsWith("longer")) return GAP_CLASSES[1];
  if (h.startsWith("needs a different job") || h.startsWith("different job")) return GAP_CLASSES[2];
  return heading.trim();
};

/**
 * The optional `## Reachability` block (ADR 0011): `###` headings are gap classes,
 * their bullets are the target's requirements. Returns [] when the section is absent,
 * which is the normal case — a reachable target carries no block at all.
 */
export const parseReachability = (body) => {
  const section = body.split(/\n(?=## )/).find((s) => /^## Reachability\s*$/m.test(s));
  if (!section) return [];
  return section
    .split(/\n(?=### )/)
    .filter((g) => g.startsWith("### "))
    .map((g) => ({
      gap: canonicalGap(g.match(/^### (.+)$/m)[1]),
      gapWritten: g.match(/^### (.+)$/m)[1].trim(),
      requirements: [...g.matchAll(/^- (.+)$/gm)].map((m) => m[1].trim()),
    }))
    .filter((g) => g.requirements.length > 0);
};

/** The gap classes ADR 0011 defines, in the order they should be shown. */
export const gapClasses = () => [...GAP_CLASSES];

/**
 * roadmap.md → { meta, milestones: [{ id, title, done, fields, earns, steps, hasStepsHeading }], reachability }
 * `fields` keys are the labelled lines verbatim: Start, Due, Where, Deliverable,
 * Evidence, "Depends on", Learning, Completed.
 * `earns` entries are { id, kind: "projected"|"reframed"|"carried", section, text }.
 * `steps` entries are { done, text, tasks, hasTaskIndentIssue }, taken from the block between an
 * optional `**Steps**` heading and the next `**Earns**` heading (or end of section) — ADR 0013.
 * `hasStepsHeading` is true whenever that heading exists, even if it parsed to zero steps — that
 * distinction is what lets check-output.mjs catch a malformed block. `tasks` are { done, text }
 * entries indented exactly two spaces under their Step — ADR 0015. A step's `done` is DERIVED
 * from its tasks when it has any (100% done ⇒ done); its own bracket is only authoritative when
 * it has zero tasks. `hasTaskIndentIssue` is true when a checkbox-looking line exists at some
 * OTHER indent under the step — a near-miss that would otherwise silently fail to parse.
 */
export const parseRoadmap = (text) => {
  const { meta, body } = splitFrontmatter(text);
  const milestones = body
    .split(/\n(?=## )/)
    .filter((s) => /^## M\d+/.test(s))
    .map((section) => {
      const [, id, title] = section.match(/^## (M\d+)\s+—\s+(.+)$/m) ?? [, "?", ""];
      const fields = Object.fromEntries(
        [...section.matchAll(/^- \*\*([A-Za-z ]+):\*\*\s*(.*)$/gm)].map((m) => [
          m[1].trim(),
          m[2].trim(),
        ])
      );
      const earns = [...section.matchAll(/^- `([CRP]\d+)` · \*([^*]+)\* — (.+)$/gm)].map((m) => ({
        id: m[1],
        kind: kindOf(m[1]),
        section: m[2].trim(),
        text: m[3].trim(),
      }));
      const stepsSection = section.match(/\n\*\*Steps\*\*\s*\n([\s\S]*?)(?=\n\*\*Earns\*\*|\n## |$)/);
      const stepMatches = stepsSection ? [...stepsSection[1].matchAll(/^- \[([ x])\] (.+)$/gm)] : [];
      const steps = stepMatches.map((m, i) => {
        const start = m.index + m[0].length;
        const end = i + 1 < stepMatches.length ? stepMatches[i + 1].index : stepsSection[1].length;
        const chunk = stepsSection[1].slice(start, end);
        // ADR 0015: exact grammar is precisely two leading spaces.
        const tasks = [...chunk.matchAll(/^ {2}- \[([ x])\] (.+)$/gm)].map((t) => ({
          done: t[1] === "x",
          text: t[2].trim(),
        }));
        // Diagnostic only: any checkbox-looking line at ANY indent. If this count differs
        // from tasks.length, something was attempted at the wrong indent and silently
        // failed to parse — check-output.mjs turns this into a loud failure.
        const looseTaskLines = [...chunk.matchAll(/^[ \t]+- \[[ x]\] .+$/gm)].length;
        return {
          done: tasks.length > 0 ? tasks.every((t) => t.done) : m[1] === "x",
          text: m[2].trim(),
          tasks,
          hasTaskIndentIssue: looseTaskLines !== tasks.length,
        };
      });
      const hasStepsHeading = /\n\*\*Steps\*\*\s*\n/.test(section);
      return {
        id,
        title: title.trim(),
        done: /^- \[x\] done$/m.test(section),
        dependsOn: parseDeps(fields["Depends on"]),
        fields,
        earns,
        steps,
        hasStepsHeading,
      };
    });
  const note = body.split(/\n(?=## )/).find((sec) => /^## Note\s*$/m.test(sec));
  return {
    meta,
    milestones,
    reachability: parseReachability(body),
    note: note ? note.replace(/^## Note\s*\n/, "").trim() : "",
  };
};

/**
 * projection.md → { meta, sections: [{ name, bullets: [{ id, kind, text, was }] }] }
 * `was` is present only on reframed bullets and holds the original wording.
 */
export const parseProjection = (text) => {
  const { meta, body } = splitFrontmatter(text);
  const sections = body
    .split(/\n(?=## )/)
    .filter((s) => s.startsWith("## "))
    .map((section) => {
      const name = section.match(/^## (.+)$/m)?.[1].trim() ?? "";
      const bullets = [...section.matchAll(/^- `([CRP]\d+)` — (.+)$/gm)].map((m) => {
        const rest = section.slice(m.index + m[0].length);
        const was = rest.match(/^\s*\n?\s*- \*\*Was:\*\*\s*(.+)$/m);
        return {
          id: m[1],
          kind: kindOf(m[1]),
          text: m[2].trim(),
          ...(was && kindOf(m[1]) === "reframed" ? { was: was[1].trim() } : {}),
        };
      });
      return { name, bullets };
    });
  return { meta, sections };
};

const kindOf = (id) =>
  id.startsWith("P") ? "projected" : id.startsWith("R") ? "reframed" : "carried";

const parseDeps = (raw) =>
  !raw || raw.trim() === "—" ? [] : raw.split(",").map((d) => d.trim()).filter(Boolean);
