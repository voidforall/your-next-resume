# 6. One install channel: the skills CLI

Date: 2026-08-29
Status: Accepted
Ticket: [#14](https://github.com/voidforall/your-next-resume/issues/14)
Supersedes the charting-time assumption that `npx your-next-resume` would be the headline string.

## Context

Charting settled on `npx your-next-resume` plus a Claude Code plugin marketplace. [#2](https://github.com/voidforall/your-next-resume/issues/2) then found that `npx skills add <owner>/<repo>` ([vercel-labs/skills](https://github.com/vercel-labs/skills), ~29.9k stars, npm `skills@1.5.23`) already resolves install paths for 77 agents and handles update, remove and private repos — and that installs through it feed the skills.sh leaderboard, where the incumbent in this space sits on 147.3K installs.

## Decision

**One channel. The headline is:**

```
npx skills add voidforall/your-next-resume
```

No npm package of our own, no `bin/`, no installer code, and **no plugin marketplace manifest** in v1.

Rejected: a **thin bin delegating to the skills CLI** (owns the string, but is a wrapper around another package and still something to publish and version); a **thin bin with our own copy logic** (inherits the `~/.agents` vs `~/.claude` path footgun, owns update and uninstall forever, forfeits leaderboard signal); **marketplace-only** (string means nothing outside Claude Code).

Rationale: nothing to publish, version or maintain; the string is the one the ecosystem already teaches; and the discovery that matters happens on skills.sh and GitHub rather than in an install string we own.

## Consequences

- **Repo layout must be discoverable by the skills CLI.** It walks the tree for directories containing a `SKILL.md`, skipping `node_modules`, `.git`, `dist`, `build`. `skills/your-next-resume/SKILL.md` is the conventional home. It **silently skips** a `SKILL.md` whose frontmatter lacks a string `name` or `description`, so CI must validate ([#11](https://github.com/voidforall/your-next-resume/issues/11)).
- **[ADR 0005](0005-node-runtime-dependency.md) still holds.** `npx` is part of npm, so the install path continues to guarantee Node at install time even though we ship no npm package of our own.
- **The npm name `your-next-resume` remains unclaimed.** We are not publishing it, which leaves it available to someone else. Reserving it defensively is a live option, not a decision made here.
- **Discovery now rests entirely on skills.sh, GitHub and the launch**, with no plugin-browser route. That raises the stakes on [#13](https://github.com/voidforall/your-next-resume/issues/13).
- Adding a marketplace manifest later is additive and breaks nothing, so this is not a one-way door.
