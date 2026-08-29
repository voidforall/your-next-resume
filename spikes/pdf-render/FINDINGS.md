# Spike: does the headless-Chrome PDF path hold up?

Ticket: [#5](https://github.com/voidforall/your-next-resume/issues/5). Constrains [#8](https://github.com/voidforall/your-next-resume/issues/8) (resume template).

**Verdict: it holds up.** `@page` size and margins, `break-inside` / `break-after` / `break-before`,
background colours and the layered Stamp all survive `--headless --print-to-pdf`, and the text stays
selectable. Two things do **not** come for free and must be handled: Chrome stamps a browser
header/footer on every page unless told not to, and it cannot write `/Subject`, which
[ADR 0001](../../docs/adr/0001-projection-contract.md) §5 requires. Both have cheap fixes, included here.

Bench: macOS 15.7.4, arm64, Google Chrome **151.0.7922.174** (Skia/PDF m151). Inspection with poppler
(`pdfinfo`, `pdffonts`, `pdftotext`, `pdftoppm`), Pillow for pixel sampling, and macOS Quartz
(`qlmanage`) as an independent PDF parser.

Spike page: [`resume.spike.html`](./resume.spike.html) — multi-column header, `@page` size + margins +
`:first`, `break-inside: avoid` items forced across a page boundary, a Google-font-or-fallback stack, a
background-coloured Stamp band, and per-bullet PROJECTED / REFRAMED marks. Generated PDFs are
gitignored; every command below reproduces them.

---

## 1. The command we ship

```sh
"$CHROME" \
  --headless \
  --no-pdf-header-footer \
  --print-to-pdf="/abs/path/out/resume.pdf" \
  "file:///abs/path/resume.html"
```

Then, because Chrome cannot set `/Subject`:

```sh
node set-pdf-metadata.mjs /abs/path/out/resume.pdf \
  --title   "Ada Lovelace — PROJECTION resume (target state 2027-03-01)" \
  --subject "PROJECTION. Target state 2027-03-01. Not a record of experience." \
  --author  "Ada Lovelace" \
  --creator "your-next-resume"
```

Notes on the flags, all checked:

| Flag | Verdict |
|---|---|
| `--headless` | Required. Chrome 151 has only the new headless; `--headless=old` is accepted and silently gives new headless (its output still carried the header/footer). |
| `--no-pdf-header-footer` | **Required.** Without it every page gets `29/08/2026, 01:51` top-left and the document title + `file:///…` + page number. Verified: `pdftotext` found the date string on all 4 pages of `a-bare.pdf` and none of `b-nohf.pdf`. |
| `--print-to-pdf=<abs path>` | Value is a raw filesystem path, not a URL. Quote it; paths with spaces work. |
| `file://` URL | Must be URL-encoded (`%20` for spaces). Verified with `out/dir with spaces/my resume.html`. |
| `--disable-gpu` | Not needed on macOS 151. Harmless. |
| `--no-sandbox` | Not needed on macOS. Only add it for root-in-container Linux, and only then. |
| `--virtual-time-budget=N` | **Do not ship it.** See §5 — it hung indefinitely on the first run and had to be killed. |
| unknown switches | Silently ignored (`--this-flag-does-not-exist` still produced a correct PDF), so passing `--no-pdf-header-footer` to an older Chrome that predates it is safe. |
| `--user-data-dir` | Not needed. The render ran fine with the user's ordinary Chrome already open (2 live processes) — new headless does not take the profile lock. |

Chrome exits 0 and writes `NNNNN bytes written to file …` to **stderr**, not stdout. Check the file
exists and is non-empty rather than parsing that line.

---

## 2. Browser detection

### macOS — verified on this machine

Present: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` (only one of the candidates
below existed here; the rest were probed and absent).

```
$CHROME_PATH                                                                   (env override)
/Applications/Google Chrome.app/Contents/MacOS/Google Chrome                   found, used
/Applications/Chromium.app/Contents/MacOS/Chromium                             absent
/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge                 absent
/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary     absent
~/Applications/…  (same four, user-local installs)
```

`which google-chrome chromium chromium-browser chrome msedge` found **nothing** — on macOS there is no
binary on `PATH`. A `PATH`-only probe fails on the most common platform; probe the `.app` bundles.

### Linux

Not testable here; paths taken from the two reference implementations rather than guessed —
Playwright's channel registry and Google's `chrome-launcher`.

```
$CHROME_PATH
which google-chrome-stable | google-chrome | chromium-browser | chromium | microsoft-edge-stable
/opt/google/chrome/chrome
/opt/microsoft/msedge/msedge
/snap/bin/chromium
/usr/bin/google-chrome-stable, /usr/bin/google-chrome, /usr/bin/chromium
```

`chrome-launcher` resolves Linux by `which` over `google-chrome-stable`, `google-chrome`,
`chromium-browser`, `chromium` (plus `.desktop` files under `~/.local/share/applications` and
`/usr/share/applications`); Playwright hardcodes `/opt/google/chrome/chrome` and
`/opt/microsoft/msedge/msedge`. `which` first, absolute paths as backstop.

### Windows

```
%CHROME_PATH%
%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe
%ProgramFiles%\Google\Chrome\Application\chrome.exe
%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe
%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe
%ProgramFiles%\Microsoft\Edge\Application\msedge.exe
%LOCALAPPDATA%\Google\Chrome SxS\Application\chrome.exe        (Canary, last resort)
```

Playwright's registry uses the suffixes `\Google\Chrome\Application\chrome.exe` and
`\Microsoft\Edge\Application\msedge.exe` joined against each Program Files root; `chrome-launcher`
enumerates `%LOCALAPPDATA%`, `%PROGRAMFILES%`, `%PROGRAMFILES(X86)%` in that order. Edge is
pre-installed on Windows 10/11, so **on Windows the fallback almost never fires** — worth saying in the
skill's copy.

Sources: [`chrome-launcher/src/chrome-finder.ts`](https://github.com/GoogleChrome/chrome-launcher/blob/main/src/chrome-finder.ts),
[`playwright-core/src/server/registry/index.ts`](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/registry/index.ts).

### Probe order we ship

1. `$CHROME_PATH` / `%CHROME_PATH%` if set and executable — an explicit override always wins, and it
   is the documented escape hatch for exotic installs.
2. Per-platform list above, **stable channels before Canary/beta**, and **Chrome before Edge before
   Chromium** — all are Chromium and all accept the same flags, so order is about picking the one most
   likely to be a real, updated install.
3. `PATH` lookup (Linux/Windows only; useless on macOS).
4. Not found → §6 fallback.

Validate a candidate by running it, not by `stat`: `"$candidate" --version` must exit 0 and print a
string containing `Chrome`, `Chromium` or `Edg`. A path can exist and be a broken/quarantined bundle.

---

## 3. Render fidelity — everything checked by measurement, not by eye

Measured by rasterising at 72 dpi and computing the ink bounding box per page.

| Thing | Result |
|---|---|
| `@page { size: Letter }` | PASS — `612 x 792 pts (letter)` |
| `@page { size: A4 }` | PASS — `594.96 x 841.92 pts (A4)`; CSS page size is honoured by the CLI, no flag needed |
| `@page { margin: 14mm 15mm 16mm 15mm }` | PASS — measured L/R = **14.8 mm** on all 4 pages, top = 14.5–14.8 mm on pages 3–4 |
| `@page :first { margin-top: 10mm }` | PASS — page 1 top ink at **10.6 mm** vs 14.5 mm elsewhere |
| `break-before: page` | PASS — Skills section started page 2 exactly |
| `break-after: avoid` on `h2` | PASS — no heading orphaned at a page foot |
| `break-inside: avoid` on `li` | PASS — probe lines 01–14 whole on page 3, line 15 pushed intact to page 4; **no item split** |
| `break-inside: avoid` on a block taller than one page | Silently ignored (correctly — it cannot be honoured). Do not wrap whole sections in it. |
| CSS `column-count: 2` + `break-inside: avoid` children | PASS — project cards balanced, none split |
| CSS grid multi-column header | PASS |
| Background colours | PASS — stamp band `#2f3b52` = **10,778 px on page 1 and 11,529 px on page 4**; chip `#fdf0dc` and box `#f2f4f8` also present |
| Text selectable | PASS — `pdftotext` recovers 1,375–1,434 words including all 9 `PROJECTED` marks (they are CSS `::after` `content:` and still extract) |
| File size | 2-page realistic resume **174.7 KB**; 4-page spike **199.2 KB**. ~165 KB is fixed font-subset overhead, ~12 KB per extra page. Emailable. |
| PDF version / tagging | PDF 1.4, `Tagged: yes` |

### Backgrounds: the flag question, answered precisely

The CLI needs **no flag**. `--print-to-pdf` printed the Stamp band identically with and without
`print-color-adjust: exact` in the CSS (`f-nocolor.pdf` was byte-identical in size to `b-nohf.pdf`,
10,778 stamp pixels either way). The folklore about needing a background flag comes from the
**CDP/Puppeteer** API and from the browser's own print dialog, where `printBackground` defaults to
*false*.

That still matters, because the no-browser fallback is the print dialog. Driving `Page.printToPDF` over
CDP with `printBackground` forced both ways gives the decisive result:

| | `print-color-adjust: exact` in CSS | without it |
|---|---|---|
| `printBackground: true` | stamp = 10,459 px | stamp = 10,459 px |
| `printBackground: false` | stamp = **10,459 px** (kept) | stamp = **0 px** (lost) |

**So `print-color-adjust: exact` (plus the `-webkit-` prefix) is load-bearing and non-negotiable in the
template.** Without it, a user who prints via Cmd+P with the default settings gets a PDF where the
Stamp band and every per-bullet mark are gone — and worse, the band's *white text survives as invisible
white-on-white text*: `pdftotext` still finds `NOT A RECORD OF EXPERIENCE` in a document that looks to a
human like an ordinary resume. That is precisely the accidental-mistaking failure ADR 0001 §5 exists to
prevent. Repro: `out/i-nobg-nocss.pdf`.

### Two layout gotchas for #8

- **Negative margins do not full-bleed.** `margin: 0 -15mm` on the Stamp band did not reach the paper
  edge; ink stayed at 14.8 mm, i.e. clipped to the `@page` content box. A full-bleed band needs
  `@page { margin: 0 }` with the page padding applied by an inner wrapper instead.
- **`position: fixed` repeats per page but reserves no space.** With `bottom: 0` the runner appeared at
  the foot of all 5 pages of `out/probe2.pdf` — and flowing text ran *underneath* it. With
  `bottom: -11mm` (trying to sit in the page margin) it was mispositioned to the top of pages 3–4,
  overprinting the content. Recommendation: do **not** build the repeating Stamp footer this way for
  v1. The ADR's layered Stamp (first-page band + per-bullet marks + PDF metadata) is already satisfied
  without it.

---

## 4. PDF metadata — Chrome cannot do it, and here is what can

**Chrome sets `/Title` from `<title>` and nothing else.** `pdfinfo` on a bare render:

```
Title:    PROJECTION — Alex Rivera — target state 2027-03-01. Not a record of experience.
Creator:  Mozilla/5.0 … HeadlessChrome/151.0.0.0 …
Producer: Skia/PDF m151
```

No `Subject`, no `Author`, no `Keywords`. `<meta name="subject">`, `<meta name="author">` and
`<meta name="description">` are all **ignored** — I put them in the spike page specifically to check,
and none reached the PDF. There is no CLI switch for it, and CDP `Page.printToPDF` exposes no metadata
parameters either (it also takes `/Title` from `document.title`). So **ADR 0001 §5's "the same
statement in the PDF's document metadata" cannot be met by the render step alone.**

What does meet it, without adding a dependency:
[`skills/your-next-resume/scripts/set-pdf-metadata.mjs`](../../skills/your-next-resume/scripts/set-pdf-metadata.mjs) — ~90 lines of plain Node, no packages. It appends a
**PDF incremental update**: the original bytes are untouched, a replacement `/Info` object plus a fresh
xref section and a trailer with `/Prev` are appended. Verified end-to-end:

```
Title:    Alex Rivera — PROJECTION resume (target state 2027-03-01)
Subject:  PROJECTION. Target state 2027-03-01. Not a record of experience.
Keywords: projection; not a record of experience
Author:   Alex Rivera
Creator:  your-next-resume
```

…with the document still intact afterwards: 4 pages, 1,434 words extractable, `pdftoppm` renders every
page, and macOS Quartz (`qlmanage -t`) produces a thumbnail — an independent parser, not poppler.
Cost: **+959 bytes**.

Caveats, all real:
- Strings are written as UTF-16BE hex literals (`<FEFF…>`), so em-dashes and non-Latin names are safe.
- The `/Info` object is replaced **wholesale**, so Skia's `Producer` is dropped unless you pass
  `--producer`. Pass every field you want to keep.
- It only handles the classic `trailer` + xref table that Skia emits. It refuses, with a clear message,
  anything using a cross-reference stream. If we ever change producers, swap in `pdf-lib` (pure JS,
  no native deps) — that is the drop-in alternative. `qpdf`/`exiftool`/Ghostscript also work but are
  not installed by default anywhere and would violate "no new install steps".
- **`mdls` is not a valid check.** On macOS `mdls -name kMDItemTitle` returned `(null)` for a correct,
  fully-populated PDF even after `mdimport`. Use `pdfinfo`, or Preview's Get Info. Don't let this
  mislead whoever writes the CI check.

---

## 5. Web fonts: don't. Two independent reasons, both measured.

The spike loaded `Newsreader` + `Inter` from Google Fonts with a full system fallback stack.

**Reason 1 — it is non-deterministic.** Four back-to-back runs of the *identical* command:

```
run 1: 344742 bytes, fonts = CID TrueType + Type 3     <- Google font won the race
run 2: 199220 bytes, fonts = CID TrueType              <- fallback
run 3: 199220 bytes, fonts = CID TrueType
run 4: 199220 bytes, fonts = CID TrueType
```

Chrome snapshots for print without waiting for the font fetch. Same input, two different documents.
For a resume that is unacceptable.

**Reason 2 — variable fonts degrade to Type 3.** When the Google font *did* load, `pdffonts` showed 20
unnamed **Type 3** fonts: glyphs re-emitted as drawing procedures rather than an embedded font program.
Isolated to the cause with a minimal page:

| Request | Result |
|---|---|
| `family=Inter:wght@400` (static instance) | `AAAAAA+Inter-Regular`, CID TrueType, 5,969 B |
| `family=Inter:wght@100..900` (variable axis range) | `[none]` x 2, **Type 3**, 15,777 B |
| no web font, system stack | `Georgia`, `HelveticaNeue`, CID TrueType |

A variable-axis request makes Skia fall back to Type 3, 2.6x larger, with no font name for an ATS
parser to see. `pdftotext` still extracts the text (ToUnicode is present), so it is not fatal — but it
is strictly worse for no benefit.

Also: fetching a font is a network request from a page built from the user's resume, which sits badly
with the map's "local-only processing, no telemetry, no uploads" standing preference.

**Ship: system font stacks, or a base64 `@font-face` embedded in the HTML.** If we ever want a branded
face, embed a *static* instance, never a variable axis range.

`--virtual-time-budget` looks like the fix for reason 1 and is not: its first invocation here **hung
indefinitely** and had to be SIGKILLed (later runs completed in 5 s). If it is ever used, it must be
wrapped in a hard timeout.

---

## 6. The no-browser fallback

The fallback is genuinely fine, but the copy has to carry two instructions or the output is wrong.

The self-contained HTML is already the deliverable; the user opens it and prints:
`open <file>` (macOS) / `xdg-open` (Linux) / `start ""` (Windows).

What the user must be told, exactly:

> No Chrome, Chromium or Edge found, so I could not render the PDF here. Your resume is complete at
> `~/…/resume.html` — open it and press **Cmd+P** (Ctrl+P), then:
> 1. **Destination → Save as PDF**
> 2. **More settings → untick "Headers and footers"** (otherwise every page gets the date and the
>    file path printed on it)
> 3. Leave margins on **Default** — the page sets its own.
>
> The projection stamp is forced to print, so you cannot lose it by accident.

Step 2 is the one that would otherwise go wrong: Chrome's print dialog defaults "Headers and footers"
**on**, and there is no CSS that can suppress it. That is a genuine cosmetic weakness of the fallback
path and the reason `--no-pdf-header-footer` matters so much on the automated path.

The **backgrounds are safe** on this path — verified in §3 — because `print-color-adjust: exact`
overrides the dialog's "Background graphics" default. The Stamp cannot be lost by a user who just hits
Cmd+P and Save.

Not covered, and fine for v1: Safari and Firefox print the page acceptably but honour print CSS
differently. We should not promise fidelity on those; the instruction should name Chrome/Edge.

---

## 7. What this constrains in #8 (resume template)

1. `print-color-adjust: exact` **and** `-webkit-print-color-adjust: exact` on `body`. Non-negotiable —
   §3 shows the Stamp silently vanishes without it on the manual path.
2. No remote web fonts. System stack or base64-embedded static face.
3. `break-inside: avoid` belongs on `li` and on individual role/entry blocks — never on a container
   that can exceed one page.
4. No negative margins for full-bleed. Use `@page { margin: 0 }` + an inner padded wrapper, or accept
   an inset band.
5. No `position: fixed` repeating footer in v1.
6. `<title>` is not decoration — it becomes `/Title`. Write it as the Stamp statement.
7. `::after` chips for the PROJECTED / REFRAMED marks extract into the text layer, which is good: an
   ATS or a copy-paste keeps the marks. Keep them as text, not as images.

---

## Reproducing

```sh
cd spikes/pdf-render
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p out
"$CHROME" --headless --no-pdf-header-footer \
  --print-to-pdf="$PWD/out/resume.pdf" "file://$PWD/resume.spike.html"
node set-pdf-metadata.mjs out/resume.pdf \
  --title "…" --subject "PROJECTION. Target state …. Not a record of experience."
pdfinfo out/resume.pdf && pdffonts out/resume.pdf && pdftotext out/resume.pdf - | head
pdftoppm -png -r 110 out/resume.pdf out/page   # then look at the images
```

`out/` is gitignored.
