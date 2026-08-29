#!/usr/bin/env node
/**
 * docx-to-text.mjs — extract the text of a .docx without any dependency.
 *
 * ADR 0009's intake ladder reads a DOCX with this before falling back to macOS
 * `textutil` and then to paste. A DOCX is a zip, so a minimal central-directory
 * reader plus `zlib.inflateRawSync` is enough to reach `word/document.xml`; no
 * package is needed, and none may be added (ADR 0005 buys us Node, not npm).
 *
 * Output goes to the confirmation step, not to the user directly, so the failure
 * modes are ranked: garbled-but-visible is recoverable, silently-empty is not.
 * Every path that cannot produce text therefore throws with a specific reason —
 * including a document that parsed fine but yielded nothing — so the ladder can
 * fall through instead of planning against silence.
 *
 * Shape of the extraction:
 *   <w:p>    ends a line          <w:tab/>  a tab separator
 *   <w:br/>  breaks a line        <w:t>     the only element whose text is kept
 *
 * Paragraphs are emitted in document order wherever they occur, so paragraphs
 * inside `<w:tbl>` / `<w:tr>` / `<w:tc>` come out with everything else. Many
 * resume templates lay experience out in a table; an extractor that walks only
 * the top-level children of `<w:body>`, or that treats `<w:tbl>` as markup to
 * strip, drops that entire section and reports success.
 *
 *   node docx-to-text.mjs <file.docx>
 */

import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import { pathToFileURL } from "node:url";

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const EOCD_SIZE = 22;
/** A zip comment is at most 64 KiB, so the record cannot start earlier than this. */
const EOCD_SCAN = 64 * 1024 + EOCD_SIZE;
/** A field set to all-ones means the real value lives in a ZIP64 extra field. */
const ZIP64 = 0xffffffff;
const DOCUMENT = "word/document.xml";

// ── zip ────────────────────────────────────────────────────────────────────────

/** Offset of the end-of-central-directory record, scanning back from the tail. */
const findEndOfCentralDirectory = (bytes) => {
  const floor = Math.max(0, bytes.length - EOCD_SCAN);
  for (let i = bytes.length - EOCD_SIZE; i >= floor; i--) {
    if (bytes.readUInt32LE(i) === EOCD_SIG) return i;
  }
  throw new Error(
    "not a DOCX: no zip end-of-central-directory record — the file is truncated or is not a zip",
  );
};

/** Every central-directory entry, in the order the archive lists them. */
const readCentralDirectory = (bytes) => {
  const eocd = findEndOfCentralDirectory(bytes);
  const count = bytes.readUInt16LE(eocd + 10);
  const start = bytes.readUInt32LE(eocd + 16);
  if (count === 0xffff || start === ZIP64) {
    throw new Error("ZIP64 archives are not supported — a .docx this large is not a resume");
  }
  if (count === 0) throw new Error("not a DOCX: the zip is empty");

  const entries = [];
  let at = start;
  for (let i = 0; i < count; i++) {
    if (at + 46 > bytes.length || bytes.readUInt32LE(at) !== CENTRAL_SIG) {
      throw new Error(`corrupt zip: central-directory entry ${i} of ${count} has a bad signature`);
    }
    const nameLength = bytes.readUInt16LE(at + 28);
    const entry = {
      method: bytes.readUInt16LE(at + 10),
      compressedSize: bytes.readUInt32LE(at + 20),
      localOffset: bytes.readUInt32LE(at + 42),
      name: bytes.toString("utf8", at + 46, at + 46 + nameLength),
    };
    at += 46 + nameLength + bytes.readUInt16LE(at + 30) + bytes.readUInt16LE(at + 32);
    entries.push(entry);
  }
  return entries;
};

/** Decompressed bytes of one entry. Stored and deflated members only. */
const readEntry = (bytes, entry) => {
  if (entry.compressedSize === ZIP64 || entry.localOffset === ZIP64) {
    throw new Error(`${entry.name} needs ZIP64 fields, which are not supported`);
  }
  if (entry.localOffset + 30 > bytes.length || bytes.readUInt32LE(entry.localOffset) !== LOCAL_SIG) {
    throw new Error(`corrupt zip: ${entry.name} has no local file header`);
  }
  const header =
    entry.localOffset + 30 + bytes.readUInt16LE(entry.localOffset + 26) +
    bytes.readUInt16LE(entry.localOffset + 28);
  const data = bytes.subarray(header, header + entry.compressedSize);
  if (data.length !== entry.compressedSize) {
    throw new Error(`corrupt zip: ${entry.name} is truncated`);
  }
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateRawSync(data);
  throw new Error(`${entry.name} uses zip compression method ${entry.method}, which is not supported`);
};

// ── xml ────────────────────────────────────────────────────────────────────────

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Resolve the five XML entities and numeric character references; leave anything else literal. */
export const decodeEntities = (text) =>
  text.replace(/&(#[0-9]+|#[xX][0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]*);/g, (whole, body) => {
    if (body[0] !== "#") return NAMED[body] ?? whole;
    const code = body[1] === "x" || body[1] === "X"
      ? Number.parseInt(body.slice(2), 16)
      : Number.parseInt(body.slice(1), 10);
    if (!Number.isInteger(code) || code < 1 || code > 0x10ffff) return whole;
    return String.fromCodePoint(code);
  });

/** Element name without its namespace prefix: `w:tbl` and `tbl` both read as `tbl`. */
const localName = (name) => {
  const colon = name.indexOf(":");
  return colon === -1 ? name : name.slice(colon + 1);
};

/**
 * End of the tag that starts at `<`, respecting quoted attribute values — a `>`
 * inside an attribute is legal XML and does not close the tag.
 */
const endOfTag = (xml, open) => {
  let quote = "";
  for (let i = open + 1; i < xml.length; i++) {
    const ch = xml[i];
    if (quote) {
      if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ">") {
      return i;
    }
  }
  return -1;
};

/**
 * WordprocessingML to plain text, walking the document exactly once so that
 * ordering — and table content — survives regardless of nesting depth.
 */
export const documentXmlToText = (xml) => {
  const lines = [];
  let line = "";
  let textDepth = 0; // open <w:t> elements; their character data is the only text kept

  const flush = () => {
    lines.push(line.replace(/[ \t]+$/, ""));
    line = "";
  };

  let i = 0;
  while (i < xml.length) {
    const open = xml.indexOf("<", i);
    if (open === -1) break;

    if (textDepth > 0 && open > i) line += decodeEntities(xml.slice(i, open));

    if (xml.startsWith("<!--", open)) {
      const close = xml.indexOf("-->", open);
      i = close === -1 ? xml.length : close + 3;
      continue;
    }
    if (xml.startsWith("<![CDATA[", open)) {
      const close = xml.indexOf("]]>", open);
      const end = close === -1 ? xml.length : close;
      if (textDepth > 0) line += xml.slice(open + 9, end); // CDATA is literal, no entities
      i = close === -1 ? xml.length : close + 3;
      continue;
    }

    const close = endOfTag(xml, open);
    if (close === -1) break; // unterminated tag: keep what was extracted rather than throwing
    const inner = xml.slice(open + 1, close);
    i = close + 1;
    if (inner[0] === "?" || inner[0] === "!") continue; // declaration or doctype

    const isEnd = inner[0] === "/";
    const isEmpty = inner.endsWith("/");
    const name = localName(inner.slice(isEnd ? 1 : 0).split(/[\s/>]/, 1)[0]);

    if (name === "t" && !isEmpty) textDepth += isEnd ? -1 : 1;
    else if (name === "tab" && !isEnd) line += "\t";
    else if ((name === "br" || name === "cr") && !isEnd) flush();
    else if (name === "p" && (isEnd || isEmpty)) flush();
  }
  if (line) flush();

  // Word emits an empty paragraph for spacing; keep one, drop runs of them.
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\s+$/g, "");
};

// ── entry point ────────────────────────────────────────────────────────────────

/** Plain text of a .docx given its bytes. Throws, specifically, rather than returning nothing. */
export const docxToText = (bytes) => {
  if (bytes.length < EOCD_SIZE || bytes.readUInt32LE(0) !== LOCAL_SIG) {
    throw new Error("not a DOCX: the file does not begin with a zip local file header (PK\\x03\\x04)");
  }
  const entries = readCentralDirectory(bytes);
  const entry =
    entries.find((e) => e.name === DOCUMENT) ??
    entries.find((e) => e.name.toLowerCase() === DOCUMENT);
  if (!entry) {
    const listed = entries.slice(0, 8).map((e) => e.name).join(", ");
    throw new Error(
      `not a DOCX: the zip has no ${DOCUMENT} — it holds ${entries.length} entr${
        entries.length === 1 ? "y" : "ies"
      } (${listed}${entries.length > 8 ? ", …" : ""})`,
    );
  }
  const text = documentXmlToText(readEntry(bytes, entry).toString("utf8"));
  if (!text.trim()) {
    throw new Error(
      `${DOCUMENT} parsed but holds no <w:t> text — the document is empty, or its text lives ` +
        "somewhere this extractor does not read (an embedded object, or an image of a resume)",
    );
  }
  return text;
};

const main = async () => {
  const [file, ...rest] = process.argv.slice(2);
  if (!file || file.startsWith("-") || rest.length > 0) {
    throw new Error("usage: docx-to-text.mjs <file.docx>");
  }
  // Piping into `head` closes stdout early; that is not an extraction failure.
  process.stdout.on("error", (err) => {
    if (err.code !== "EPIPE") throw err;
  });
  const bytes = await readFile(file);
  try {
    process.stdout.write(`${docxToText(bytes)}\n`);
  } catch (err) {
    throw new Error(`${file}: ${err.message}`);
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`docx-to-text: ${err.message}`);
    process.exit(1);
  });
}
