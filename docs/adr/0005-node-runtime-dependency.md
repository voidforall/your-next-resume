# 5. Node is a declared runtime dependency

Date: 2026-08-29
Status: Accepted
Ticket: [#17](https://github.com/voidforall/your-next-resume/issues/17)

## Context

[ADR 0001](0001-projection-contract.md) §5 requires the Stamp statement in the PDF's document metadata. The [#5 spike](../../spikes/pdf-render/FINDINGS.md) established that headless Chrome sets only `/Title`, from `<title>`, with no CLI switch and no CDP parameter. A post-render `/Info` writer is therefore mandatory, and a dependency-free ~90-line implementation is proven: [`set-pdf-metadata.mjs`](../../spikes/pdf-render/set-pdf-metadata.mjs).

The work is pure text manipulation — read the last trailer, append a replacement `/Info` object, a new xref section and a trailer with `/Prev` — so it ports to any language. The question was which runtime to assume.

## Decision

**Node 18+ is a declared dependency of the PDF path.** One implementation, the Node one. The skill declares:

```yaml
compatibility: Requires Node 18+ and a Chrome-family browser (Chrome, Chromium or Edge) for PDF output. Runs fully offline.
```

The dependency is close to free: every install path chosen for this project — `npx your-next-resume` or `npx skills add voidforall/your-next-resume` — already puts Node on the machine. It bites only someone who hand-copies the skill directory or runs it under a non-Node agent.

Rejected: **dual Node + Python implementations** (two byte-level PDF writers to keep in sync, to serve a case our distribution mostly excludes); **Python primary** (wrong bet for an audience that arrives through npm); **dropping the metadata layer** (it is the one Stamp layer that does not depend on paint, and therefore the one that survives when the Cmd+P fallback drops the band's background — a change to ADR 0001 we are not making).

### When Node is absent

The skill still produces the roadmap, the HTML and the PDF — the header band and per-bullet marks are CSS and need no runtime. It states plainly in its closing summary that the metadata layer could not be written and why. Failing the whole run over a provenance layer would be a worse trade than shipping a document whose visible Stamp is intact.

## Consequences

- `set-pdf-metadata.mjs` graduates from the spike into the skill's `scripts/` when the repo is scaffolded ([#11](https://github.com/voidforall/your-next-resume/issues/11)).
- The `compatibility` field is part of the Agent Skills standard (max 500 chars) and is carried by every install path, so the requirement is visible before install.
- Unblocks [#14](https://github.com/voidforall/your-next-resume/issues/14): the install-string decision can now assume a Node runtime rather than argue about it.
