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
      gap: g.match(/^### (.+)$/m)[1].trim(),
      requirements: [...g.matchAll(/^- (.+)$/gm)].map((m) => m[1].trim()),
    }))
    .filter((g) => g.requirements.length > 0);
};

/** The gap classes ADR 0011 defines, in the order they should be shown. */
export const gapClasses = () => [...GAP_CLASSES];

/**
 * roadmap.md → { meta, milestones: [{ id, title, done, fields, earns }], reachability }
 * `fields` keys are the labelled lines verbatim: Start, Due, Where, Deliverable,
 * Evidence, "Depends on", Learning, Completed.
 * `earns` entries are { id, kind: "projected"|"reframed"|"carried", section, text }.
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
      return {
        id,
        title: title.trim(),
        done: /^- \[x\] done$/m.test(section),
        dependsOn: parseDeps(fields["Depends on"]),
        fields,
        earns,
      };
    });
  return { meta, milestones, reachability: parseReachability(body) };
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
