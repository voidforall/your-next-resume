# How agent skills are packaged and installed (Aug 2026)

Research for [#2](https://github.com/voidforall/your-next-resume/issues/2). Fact base for the repo/package-shape decision ([#11](https://github.com/voidforall/your-next-resume/issues/11)).

## Bottom line

1. **Agent Skills is a real open standard**, not a Claude Code feature — `agentskills.io`, originally from Anthropic, now implemented by Claude Code, Cursor, Codex, Gemini CLI, GitHub Copilot/VS Code, Amp, OpenCode, Goose, Junie, Kiro, Factory and ~70 more. A single portable `SKILL.md` genuinely runs everywhere.
2. **The install channel we should ride already exists.** `npx skills add <owner>/<repo>` (vercel-labs/skills, ~29.9k stars) resolves GitHub repos, installs into the right directory for **77 agents**, and handles symlink-vs-copy, update, remove and private repos. It also powers the **skills.sh leaderboard**, which ranks skills by install telemetry — a discovery surface that matters directly to the launch goal.
3. **Writing our own installer would duplicate that badly.** The realistic shapes for the promised `npx your-next-resume` are: (a) drop it and headline `npx skills add voidforall/your-next-resume`; (b) publish a thin `your-next-resume` npm package whose `bin` delegates to the same install. That trade is #11's call — this doc gives it the facts.
4. **Portability has a hard edge:** outside Claude Code only six frontmatter fields are legal. Anything richer (`disable-model-invocation`, `context: fork`, `argument-hint`, …) is a Claude Code extension. A cross-agent skill must keep its frontmatter to the standard six.
5. The plugin marketplace is cheap and additive: one `.claude-plugin/marketplace.json` + one `plugin.json` in the same repo, validated by `claude plugin validate .`.

## 1. The standard

A skill is a directory whose only required file is `SKILL.md`:

```
your-next-resume/
├── SKILL.md          # required: frontmatter + instructions
├── scripts/          # optional: executable code
├── references/       # optional: docs loaded on demand
└── assets/           # optional: templates, resources
```

### Frontmatter — the full standard surface

| Field | Required | Constraints |
| --- | --- | --- |
| `name` | Yes | 1–64 chars; lowercase `a-z`, `0-9`, hyphens only; no leading/trailing hyphen; **no consecutive hyphens**; **must match the parent directory name** |
| `description` | Yes | 1–1024 chars, non-empty; must say *what it does* **and** *when to use it* |
| `license` | No | License name or bundled file reference |
| `compatibility` | No | ≤500 chars; environment requirements (product, packages, network) |
| `metadata` | No | Map of string→string for your own tooling |
| `allowed-tools` | No | Space-separated pre-approved tools. **Experimental**, support varies |

Anthropic's own docs add one rule the spec page omits: a skill `name` **cannot contain the reserved words "anthropic" or "claude"**, and neither field may contain XML tags. `your-next-resume` is clean on every rule.

### Progressive disclosure — the budget we author against

| Level | Loaded | Cost |
| --- | --- | --- |
| Metadata (`name` + `description`) | Always, at startup | ~100 tokens per skill |
| `SKILL.md` body | When the skill triggers | recommended **<5k tokens**, keep under **500 lines** |
| `scripts/`, `references/`, `assets/` | Only when read/run | zero until accessed; script *code* never enters context, only its output |

Practical consequence for us: the resume/roadmap HTML templates, the projection rules and any long reference material belong in bundled files, not in `SKILL.md`. Reference them one level deep with relative paths.

### Validation

- `skills-ref validate ./my-skill` — reference validator from `agentskills/agentskills`.
- `npx skills init [name]` — scaffolds a conformant `SKILL.md`.

## 2. Portable fields vs Claude Code extensions

Claude Code accepts a much larger frontmatter table (`when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `disallowed-tools`, `model`, `effort`, `context: fork`, `agent`, `background`, `hooks`, `paths`, `shell`). Its own docs state the boundary explicitly:

| Distribution path | Usable fields |
| --- | --- |
| Claude Code, at any level, including plugin skills | every field |
| claude.ai uploads, the Skills API, `package_skill.py` | `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools` |

So: author the six-field portable core, and treat any Claude Code extension as an optional enhancement we can live without. (Also note Claude Code reads frontmatter **only if the opening `---` is the file's first line**.)

## 3. Where skills live

Claude Code:

| Level | Path | Scope |
| --- | --- | --- |
| Personal | `~/.claude/skills/<name>/SKILL.md` | all projects |
| Project | `.claude/skills/<name>/SKILL.md` | that project |
| Plugin | `<plugin>/skills/<name>/SKILL.md` | where the plugin is enabled |

Conflict rules: personal beats project beats bundled; plugin skills are namespaced `plugin-name:skill-name` and cannot collide; a skill beats a same-named `.claude/commands/` file. Claude Code hot-reloads `SKILL.md` text changes without a restart. The folder name `synced` is reserved.

Other runtimes differ, which is exactly why the `skills` CLI exists — a sample of its 77-agent path table:

| Agent | `--agent` | Project path | Global path |
| --- | --- | --- | --- |
| Claude Code | `claude-code` | `.claude/skills/` | `~/.claude/skills/` |
| Cursor | `cursor` | `.agents/skills/` | `~/.cursor/skills/` |
| Codex | `codex` | `.agents/skills/` | `~/.codex/skills/` |
| GitHub Copilot | `github-copilot` | `.agents/skills/` | `~/.copilot/skills/` |
| Gemini CLI | `gemini-cli` | `.agents/skills/` | `~/.gemini/skills/` |
| Amp / Replit | `amp` | `.agents/skills/` | `~/.config/agents/skills/` |
| Cline, Warp, Zed | `cline`… | `.agents/skills/` | `~/.agents/skills/` |

**Known footgun this creates:** a naive installer that writes to `~/.agents/skills/` (the emerging cross-agent default) is invisible to Claude Code, which reads only `~/.claude/skills/`. Any installer we ship must write per-agent paths, or delegate to something that does.

## 4. Channel A — `npx skills` (vercel-labs/skills)

The de-facto ecosystem CLI. `npx skills add <source>` resolves GitHub shorthand, full GitHub/GitLab/any git URL, a `tree/` URL pointing at one skill, a local path, or a direct `SKILL.md`/archive download URL.

Relevant behaviour:

- **Discovery inside a repo:** it walks the tree for any directory containing a `SKILL.md`, skipping `node_modules`, `.git`, `dist`, `build`, `__pycache__`, up to a bounded container depth, and additionally knows the per-agent skill dirs (`.claude/skills`, `.agents/skills`, `.github/skills`, …). A top-level `skills/your-next-resume/SKILL.md` is found without any manifest. It **skips** any `SKILL.md` whose frontmatter is missing `name`/`description` or where they aren't strings — silent-failure risk if we typo the frontmatter.
- It also reads Claude plugin manifests (`plugin-manifest.ts`), so a marketplace repo is understood rather than confused.
- Commands: `add`, `use` (run a skill without installing), `list`/`ls`, `find` (keyword or `--owner`), `update`, `remove`/`rm`, `init`.
- Flags: `-g/--global`, `-a/--agent <agents...>`, `-s/--skill <skills...>`, `-l/--list`, `--copy`, `-y/--yes`, `--all`.
- Default scope is **project** (`./<agent>/skills/`); `-g` installs globally (`~/<agent>/skills/`). Default install method is **symlink** to one canonical copy, with `--copy` as the fallback.
- CI-friendly form: `npx skills add voidforall/your-next-resume -g -a claude-code -y`.
- **Leaderboard:** skills.sh ranks skills by anonymous install telemetry from this CLI, and serves a per-repo badge at `https://skills.sh/b/<owner>/<repo>`. This is the closest thing the ecosystem has to a package registry chart — relevant to [#13](https://github.com/voidforall/your-next-resume/issues/13).
- Website-hosted skills can be published via a `/.well-known/` discovery index (`schemas.agentskills.io/discovery/0.2.0`). Not needed for a GitHub-hosted skill; noted for completeness.

## 5. Channel B — Claude Code plugin marketplace

Minimal repo layout for one plugin shipping one skill:

```
repo/
├── .claude-plugin/
│   └── marketplace.json
└── plugins/
    └── your-next-resume/
        ├── .claude-plugin/
        │   └── plugin.json
        └── skills/
            └── your-next-resume/
                └── SKILL.md
```

`marketplace.json` requires `name`, `owner` (object with `name`), and `plugins[]`; each entry requires `name` and `source`. Optional per-entry: `displayName`, `description`, `version`, `author`, `homepage`, `repository`, `license`, `keywords`, `category`, `tags`, `metadata`, explicit component paths (`skills`, `commands`, `agents`, `hooks`, `mcpServers`), `strict`, `defaultEnabled`. Optional top-level: `$schema`, `description`, `version`, `metadata.pluginRoot`, `renames`.

**`source` accepts an `npm` source object** as well as `github`, `url`, `git-subdir`, `archive`, `command`, or a plain local path — so the marketplace entry and an npm package are not mutually exclusive.

User flow: `/plugin marketplace add voidforall/your-next-resume` then `/plugin install your-next-resume@your-next-resume`. Validate with `claude plugin validate .` (or `/plugin validate .`).

Two shortcuts worth knowing: a skill folder containing `.claude-plugin/plugin.json` loads as a `<name>@skills-dir` plugin, and a marketplace repo can point `source` at `"./"` to publish the repo root as the plugin — the pattern `mvanhorn/last30days-skill` uses, alongside `.agents/plugins/marketplace.json`, `.codex-plugin/plugin.json` and `gemini-extension.json` for other runtimes.

## 6. What this means for `npx your-next-resume`

The promised headline is one npm-ish string. Three shapes, all viable:

| Shape | Install string | Cost | Risk |
| --- | --- | --- | --- |
| **Delegate** | `npx skills add voidforall/your-next-resume` | zero — nothing to publish or maintain | not our brand; a second tool's name in our headline |
| **Thin bin** | `npx your-next-resume` | publish a small npm package that resolves agent dirs and copies the skill (or shells to `skills`) | we own installer bugs across 77 agents; the `~/.agents` vs `~/.claude` footgun is ours |
| **Both** | either string works | thin bin + README documenting the `skills` path | small duplication; needs one release process |

Facts that bear on the choice: the npm name `your-next-resume` is unclaimed; a skill needs no build step, so "install" is a directory copy plus knowing the right path; the `skills` CLI already solves updates and uninstall, which a hand-rolled installer usually doesn't; and installs through the `skills` CLI are what feed the skills.sh leaderboard.

## 7. Left open for #11

- Whether the repo root **is** the skill (`SKILL.md` at root) or holds `skills/your-next-resume/SKILL.md` — the latter is the convention the ecosystem CLI expects and leaves room for a second skill.
- Whether to publish an npm package at all, and if so what its `bin` does.
- Whether `.claude-plugin/` sits at repo root with `source: "./"`, or under `plugins/`.
- Exact `compatibility` string (we depend on a Chrome/Chromium binary and a filesystem — worth declaring).
- Whether to carry the `.agents/plugins/`, `.codex-plugin/`, `gemini-extension.json` manifests for other runtimes, or stay standard-only.

## Sources

- [Agent Skills specification](https://agentskills.io/specification) and [overview](https://agentskills.io) — the open standard and its client showcase
- [Anthropic — Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) — name/description constraints, reserved words, progressive-disclosure budget, per-surface limits
- [Claude Code — Extend Claude with skills](https://code.claude.com/docs/en/skills) — full frontmatter table, skill locations, conflict rules, portable-field boundary
- [Claude Code — plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) — marketplace.json/plugin.json schema, install commands, validation
- [vercel-labs/skills](https://github.com/vercel-labs/skills) — CLI README, `src/skills.ts` (repo scanning), `src/providers/wellknown.ts` (discovery schema)
- [skills.sh](https://www.skills.sh/docs) — supported agents, leaderboard/telemetry
- Local inspection of `~/.claude/plugins/` — `known_marketplaces.json`, `installed_plugins.json`, and the `mvanhorn/last30days-skill` multi-runtime repo layout
