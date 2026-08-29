#!/usr/bin/env node
/**
 * render-pdf.mjs — HTML in, stamped PDF out. The whole render pipeline in one step.
 *
 *   node render-pdf.mjs <input.html> <output.pdf>
 *                       [--title "…"] [--subject "…"] [--author "…"]
 *                       [--keywords "…"] [--creator "…"] [--producer "…"]
 *                       [--probe]
 *
 * Three stages, each measured in the #5 spike (spikes/pdf-render/FINDINGS.md):
 *
 *   1. Find a Chrome-family browser. $CHROME_PATH wins; otherwise a per-platform list
 *      (macOS `.app` bundles, Linux PATH + /opt + /snap, Windows Program Files), Chrome
 *      before Edge before Chromium, stable before Canary. A candidate is accepted only
 *      when `--version` exits 0 and prints Chrome/Chromium/Edg — a path can exist and be
 *      a broken or quarantined bundle, so `stat` is not enough (FINDINGS §2).
 *   2. Render with --headless --no-pdf-header-footer --print-to-pdf. The header/footer
 *      flag is required: without it Chrome prints the date and the file:// URL on every
 *      page (FINDINGS §1).
 *   3. Stamp /Info with set-pdf-metadata.mjs, next to this file. Chrome sets only /Title,
 *      from <title>, and ADR 0001 §5 requires the statement in the document metadata too
 *      (FINDINGS §4). /Info is replaced wholesale, so every field is passed explicitly.
 *
 * Degradation, per ADR 0005:
 *   - No browser  → the HTML is still the deliverable. Print instructions are written to
 *                   stdout and the exit code is 3. Never silent.
 *   - No metadata → the PDF ships anyway with a loud warning. The visible Stamp (header
 *                   band + per-bullet marks) is CSS and needs no runtime; only the
 *                   provenance layer is missing.
 *
 * Exit codes: 0 ok (possibly without metadata) · 1 usage · 2 render failed · 3 no browser.
 */

import { execFileSync, spawn } from "node:child_process";
import { accessSync, constants, existsSync, mkdirSync, readFileSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const METADATA_SCRIPT = join(HERE, "set-pdf-metadata.mjs");

/** A real Chrome-family binary prints one of these in `--version`. */
const BROWSER_VERSION = /Chrome|Chromium|Edg/;
const PROBE_TIMEOUT_MS = 10_000;
const RENDER_TIMEOUT_MS = 120_000;
const POLL_MS = 150;
const METADATA_TIMEOUT_MS = 30_000;

const META_FIELDS = ["title", "subject", "author", "keywords", "creator", "producer"];
const DEFAULT_KEYWORDS = "projection; not a record of experience";
const DEFAULT_CREATOR = "your-next-resume";
const STAMP_EARNED = "Earned only if the roadmap is completed.";
const STAMP_NEGATION = "Not a record of experience.";

const EXIT = { ok: 0, usage: 1, render: 2, noBrowser: 3 };

const USAGE =
  "usage: render-pdf.mjs <input.html> <output.pdf> [--title '…'] [--subject '…'] " +
  "[--author '…'] [--keywords '…'] [--creator '…'] [--producer '…'] [--probe]";

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

/** Bad input from the caller, as opposed to a stage that failed. Drives the exit code. */
const usageError = (message) => Object.assign(new Error(message), { usage: true });

/** argv → { htmlPath, pdfPath, meta, probeOnly }. Pure; never mutates argv. */
const parseArgs = (argv) => {
  const walk = (rest, acc) => {
    if (rest.length === 0) return acc;
    const [token, ...tail] = rest;
    if (token === "--probe") return walk(tail, { ...acc, probeOnly: true });
    if (!token.startsWith("--")) return walk(tail, { ...acc, positional: [...acc.positional, token] });
    const key = token.slice(2).toLowerCase();
    if (!META_FIELDS.includes(key)) throw usageError(`unknown option --${key}\n${USAGE}`);
    const [value, ...after] = tail;
    if (value === undefined || value.startsWith("--")) throw usageError(`--${key} needs a value`);
    return walk(after, { ...acc, meta: { ...acc.meta, [key]: value } });
  };

  const { positional, meta, probeOnly } = walk(argv, { positional: [], meta: {}, probeOnly: false });
  if (probeOnly) return { htmlPath: null, pdfPath: null, meta, probeOnly };
  const [html, pdf] = positional;
  if (!html || !pdf) throw usageError(USAGE);
  return { htmlPath: resolve(html), pdfPath: resolve(pdf), meta, probeOnly };
};

/** Fail fast at the boundary: the HTML must exist, the PDF path must be writable. */
const checkPaths = (htmlPath, pdfPath) => {
  if (!existsSync(htmlPath) || !statSync(htmlPath).isFile()) {
    throw usageError(`no such HTML file: ${htmlPath}`);
  }
  if (existsSync(pdfPath) && statSync(pdfPath).isDirectory()) {
    throw usageError(`output path is a directory: ${pdfPath}`);
  }
  mkdirSync(dirname(pdfPath), { recursive: true });
};

// ---------------------------------------------------------------------------
// Browser probe — FINDINGS §2
// ---------------------------------------------------------------------------

/** macOS: there is no Chrome on PATH, so the `.app` bundles are the probe. */
const macCandidates = () => {
  const stable = [
    "Google Chrome.app/Contents/MacOS/Google Chrome",
    "Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "Chromium.app/Contents/MacOS/Chromium",
  ];
  const preview = [
    "Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "Microsoft Edge Canary.app/Contents/MacOS/Microsoft Edge Canary",
  ];
  return ["/Applications", join(homedir(), "Applications")].flatMap((root) =>
    [...stable, ...preview].map((app) => join(root, app)),
  );
};

/**
 * Look a bare command up on PATH, the way `which` does, without spawning anything.
 * Returns every hit in PATH order so a shadowed install still gets a chance.
 */
const onPath = (name) =>
  (process.env.PATH ?? "")
    .split(delimiter)
    .filter(Boolean)
    .map((dir) => join(dir, name))
    .filter((candidate) => {
      try {
        accessSync(candidate, constants.X_OK);
        return statSync(candidate).isFile();
      } catch {
        return false;
      }
    });

/** Linux: `which` first (chrome-launcher's order), then the paths Playwright hardcodes. */
const linuxCandidates = () => [
  ...["google-chrome-stable", "google-chrome", "chromium-browser", "chromium", "microsoft-edge-stable"].flatMap(
    onPath,
  ),
  "/opt/google/chrome/chrome",
  "/opt/microsoft/msedge/msedge",
  "/snap/bin/chromium",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

/** Windows: the three install roots, Chrome then Edge then Chromium, Canary last. */
const windowsCandidates = (env) => {
  const roots = [env.LOCALAPPDATA, env.ProgramFiles, env["ProgramFiles(x86)"]].filter(Boolean);
  const suffixes = [
    "Google\\Chrome\\Application\\chrome.exe",
    "Microsoft\\Edge\\Application\\msedge.exe",
    "Chromium\\Application\\chrome.exe",
    "Google\\Chrome SxS\\Application\\chrome.exe",
  ];
  return suffixes.flatMap((suffix) => roots.map((root) => join(root, suffix)));
};

/** The full ordered candidate list for this platform. $CHROME_PATH always wins. */
const candidateList = (env = process.env, platform = process.platform) => [
  ...(env.CHROME_PATH ? [env.CHROME_PATH] : []),
  ...(platform === "darwin" ? macCandidates() : []),
  ...(platform === "win32" ? windowsCandidates(env) : []),
  ...(platform !== "darwin" && platform !== "win32" ? linuxCandidates() : []),
];

/**
 * Accept a candidate only if it runs. A path can exist and be a broken, quarantined or
 * half-uninstalled bundle, so `stat` is not evidence — `--version` is (FINDINGS §2).
 */
const browserVersion = (candidate) => {
  try {
    const out = execFileSync(candidate, ["--version"], {
      timeout: PROBE_TIMEOUT_MS,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const version = out.trim();
    return BROWSER_VERSION.test(version) ? version : null;
  } catch {
    return null;
  }
};

/** First candidate that answers `--version`, or null. Deduplicated, order preserved. */
const findBrowser = (env = process.env, platform = process.platform) => {
  const seen = new Set();
  for (const candidate of candidateList(env, platform)) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    const version = browserVersion(candidate);
    if (version) return { path: candidate, version };
  }
  return null;
};

// ---------------------------------------------------------------------------
// Metadata derived from the page — ADR 0001 §5
// ---------------------------------------------------------------------------

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  mdash: "—", ndash: "–", middot: "·", hellip: "…",
};

const decodeEntities = (text) =>
  text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (whole, name) => ENTITIES[name.toLowerCase()] ?? whole);

/** <title> is not decoration — Chrome turns it into /Title (FINDINGS §7). */
const readTitle = (html) => {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match ? decodeEntities(match[1]).replace(/\s+/g, " ").trim() : null;
};

/** Pull the target date out of the Stamp band, falling back to the <title> wording. */
const readTargetDate = (html) => {
  const band = /PROJECTED STATE\s*(?:&middot;|&#183;|·)\s*([^<\n]{3,48}?)\s*(?:&mdash;|&#8212;|—|<)/i.exec(html);
  if (band) return decodeEntities(band[1]).trim();
  const title = /target state\s+([^<\n—]{3,48}?)\s*(?:&mdash;|—|<|$)/i.exec(readTitle(html) ?? "");
  return title ? title[1].trim() : null;
};

/**
 * The /Info fields to write. Explicit flags win; anything unset is derived from the page.
 * Every field is passed because set-pdf-metadata.mjs replaces /Info wholesale.
 */
/**
 * Only a page that carries the Stamp band gets the projection metadata. The present-day
 * resume (ADR 0012) is entirely true, so claiming "PROJECTION. Not a record of experience"
 * in its /Info would be a false mark in the opposite direction.
 */
const buildMeta = (html, overrides, engine) => {
  const date = readTargetDate(html);
  const stamped = /class="stamp"/.test(html) || date !== null;
  const subject = stamped
    ? ["PROJECTION.", ...(date ? [`Target state ${date}.`] : []), STAMP_EARNED, STAMP_NEGATION].join(" ")
    : undefined;
  return {
    title:
      readTitle(html) ?? (stamped ? "PROJECTION resume — not a record of experience" : "Resume"),
    ...(subject ? { subject } : {}),
    ...(stamped ? { keywords: DEFAULT_KEYWORDS } : {}),
    creator: DEFAULT_CREATOR,
    // /Info is replaced wholesale, so Skia's own /Producer is dropped unless we say
    // what rendered the file. Name the engine rather than leaving the field empty.
    producer: engine,
    ...overrides,
  };
};

// ---------------------------------------------------------------------------
// Stages 2 and 3
// ---------------------------------------------------------------------------

/** --no-sandbox is only for root-in-container Linux, and only then (FINDINGS §1). */
const needsNoSandbox = () =>
  process.platform === "linux" && typeof process.getuid === "function" && process.getuid() === 0;

/**
 * Render. --print-to-pdf takes a raw filesystem path; the page is a URL-encoded file://
 * URL, which pathToFileURL gives us for free (spaces in paths are verified in FINDINGS §1).
 * Chrome reports success on stderr and exits 0, so the file itself is the check.
 */
const renderPdf = (chrome, htmlPath, pdfPath) => {
  // A throwaway profile. Without --user-data-dir, headless Chrome opens the user's
  // default profile — which their running browser already holds — and the render blocks.
  // Most people have Chrome open, so this is the common case, not the edge one.
  const profile = mkdtempSync(join(tmpdir(), "ynr-chrome-"));
  const args = [
    "--headless",
    "--no-pdf-header-footer",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--disable-extensions",
    ...(needsNoSandbox() ? ["--no-sandbox"] : []),
    `--print-to-pdf=${pdfPath}`,
    pathToFileURL(htmlPath).href,
  ];
  // Chrome writes the PDF and then, on some machines, does not exit — measured here with
  // and without --disable-gpu and --headless=new, all three writing a correct PDF and then
  // hanging until killed. So the finished FILE is the completion signal, not the process:
  // wait for it to appear and stop growing, then stop the browser ourselves. Waiting on
  // exit instead would stall for the full timeout and then report failure on a good render.
  const child = spawn(chrome, args, { stdio: ["ignore", "ignore", "ignore"] });
  const deadline = Date.now() + RENDER_TIMEOUT_MS;
  let exited = false;
  let spawnError = null;
  child.on("exit", () => { exited = true; });
  child.on("error", (err) => { spawnError = err; exited = true; });

  try {
    let lastSize = -1;
    let stableFor = 0;
    while (Date.now() < deadline) {
      execFileSync(process.execPath, ["-e", `setTimeout(()=>{}, ${POLL_MS})`]);
      if (spawnError) throw new Error(`Chrome failed to start: ${spawnError.message}`);

      const size = existsSync(pdfPath) ? statSync(pdfPath).size : 0;
      if (size > 0 && size === lastSize) stableFor += 1;
      else stableFor = 0;
      lastSize = size;

      if (stableFor >= 2) break;          // written and no longer growing
      if (exited) break;                  // Chrome finished on its own
    }

    if (!existsSync(pdfPath) || statSync(pdfPath).size === 0) {
      throw new Error(
        `Chrome wrote no PDF at ${pdfPath} within ${RENDER_TIMEOUT_MS / 1000}s`
      );
    }
    return statSync(pdfPath).size;
  } finally {
    if (!exited) {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2000).unref?.();
    }
    child.unref?.();
    // Best-effort: the browser we just signalled may still be writing into the profile,
    // and a cleanup race must never fail a render that succeeded.
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      /* a temp profile left behind is harmless */
    }
  }
};

/**
 * Write the Stamp statement into /Info. Returns true on success; on failure it warns and
 * returns false rather than throwing — ADR 0005: a document whose visible Stamp is intact
 * beats failing the whole run over the provenance layer.
 */
const stampMetadata = (pdfPath, meta) => {
  const args = META_FIELDS.filter((key) => meta[key] !== undefined).flatMap((key) => [
    `--${key}`,
    meta[key],
  ]);
  try {
    if (!existsSync(METADATA_SCRIPT)) throw new Error(`${METADATA_SCRIPT} is missing`);
    execFileSync(process.execPath, [METADATA_SCRIPT, pdfPath, ...args], {
      timeout: METADATA_TIMEOUT_MS,
      stdio: ["ignore", "ignore", "pipe"],
    });
    return true;
  } catch (err) {
    const detail = err.stderr?.toString().trim() || err.message;
    console.warn(
      `\n! PDF metadata not written: ${detail}\n` +
        "  The PDF itself is complete and its visible stamp is intact — the header band and\n" +
        "  the per-bullet marks are CSS and need no runtime. Only the metadata layer of the\n" +
        "  stamp (PDF Title/Subject, ADR 0001 §5) is missing from this file.",
    );
    return false;
  }
};

// ---------------------------------------------------------------------------
// The no-browser path — FINDINGS §6
// ---------------------------------------------------------------------------

const openCommand = () =>
  ({ darwin: "open", win32: 'start ""' }[process.platform] ?? "xdg-open");

/**
 * Never fail silently here. The HTML is already the deliverable; the user only needs the
 * two instructions that make the manual print correct, plus the reason it is safe.
 */
const printItYourself = (htmlPath) =>
  [
    "No Chrome, Chromium or Edge found, so I could not render the PDF here.",
    "",
    `Your resume is complete at ${htmlPath} — open it and print to PDF:`,
    "",
    `  ${openCommand()} "${htmlPath}"`,
    "",
    "Then press Cmd+P (Ctrl+P) and:",
    "  1. Destination -> Save as PDF",
    '  2. More settings -> untick "Headers and footers" (otherwise every page gets the',
    "     date and the file path printed on it — there is no CSS that can suppress it)",
    "  3. Leave margins on Default — the page sets its own",
    "",
    "The projection stamp is safe on this path: the page carries print-color-adjust: exact,",
    "which overrides the print dialog's Background graphics default, so the stamp band keeps",
    "its background and cannot be lost by accident. Use Chrome or Edge — Safari and Firefox",
    "print the page acceptably but honour the print CSS differently.",
    "",
    "If your browser lives somewhere unusual, set CHROME_PATH to it and run this again.",
  ].join("\n");

// ---------------------------------------------------------------------------

const main = () => {
  const { htmlPath, pdfPath, meta, probeOnly } = parseArgs(process.argv.slice(2));
  const browser = findBrowser();

  if (probeOnly) {
    if (!browser) {
      console.error("no Chrome-family browser found");
      return EXIT.noBrowser;
    }
    console.log(`${browser.path}\n${browser.version}`);
    return EXIT.ok;
  }

  checkPaths(htmlPath, pdfPath);

  if (!browser) {
    console.log(printItYourself(htmlPath));
    return EXIT.noBrowser;
  }

  const html = readFileSync(htmlPath, "utf8");
  const size = renderPdf(browser.path, htmlPath, pdfPath);
  const stamped = stampMetadata(pdfPath, buildMeta(html, meta, browser.version));

  console.log(
    `rendered ${pdfPath} (${Math.round(size / 1024)} KB) with ${browser.version}` +
      (stamped ? ", metadata stamped" : ", WITHOUT metadata"),
  );
  return EXIT.ok;
};

try {
  process.exit(main());
} catch (err) {
  console.error(`render-pdf: ${err.message}`);
  process.exit(err.usage ? EXIT.usage : EXIT.render);
}
