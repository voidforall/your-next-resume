#!/usr/bin/env node
/**
 * set-pdf-metadata.mjs — stamp a PDF's /Info dictionary without any dependency.
 *
 * Headless Chrome sets /Title from <title> and nothing else. ADR 0001 requires the
 * Stamp statement to appear in the PDF's document metadata, so /Subject must be set
 * after the render. This does it with a PDF incremental update: the original bytes
 * are left untouched and a replacement /Info object plus a new xref section and
 * trailer are appended.
 *
 * Verified against Chrome 151 / Skia m151 output (classic xref table, PDF 1.4).
 * Guards: refuses cross-reference-stream PDFs, which Skia does not emit but other
 * producers do.
 *
 *   node set-pdf-metadata.mjs <file.pdf> --title "…" --subject "…" [--author "…"]
 *                                        [--keywords "…"] [--creator "…"] [--producer "…"]
 */

import { readFile, writeFile } from "node:fs/promises";

const FIELDS = ["title", "subject", "author", "keywords", "creator", "producer"];

/** Parse argv into { file, meta } without mutating the input array. */
const parseArgs = (argv) => {
  const file = argv[0];
  if (!file || file.startsWith("--")) {
    throw new Error("usage: set-pdf-metadata.mjs <file.pdf> --title '…' --subject '…'");
  }
  const meta = argv.slice(1).reduce((acc, token, i, all) => {
    if (!token.startsWith("--")) return acc;
    const key = token.slice(2).toLowerCase();
    if (!FIELDS.includes(key)) throw new Error(`unknown option --${key}`);
    const value = all[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`--${key} needs a value`);
    }
    return { ...acc, [key]: value };
  }, {});
  if (Object.keys(meta).length === 0) throw new Error("nothing to set");
  return { file, meta };
};

/** PDF text string as a UTF-16BE hex literal — safe for any Unicode, no escaping rules. */
const pdfString = (text) =>
  `<FEFF${Buffer.from(text, "utf16le").swap16().toString("hex").toUpperCase()}>`;

const capitalise = (key) => key[0].toUpperCase() + key.slice(1);

/** Read the last trailer dictionary and the offset it points at. */
const readTrailer = (bytes) => {
  const tail = bytes.toString("latin1");
  const match = /trailer\s*<<([\s\S]*?)>>\s*startxref\s*(\d+)\s*%%EOF\s*$/.exec(tail);
  if (!match) {
    throw new Error(
      "no classic trailer found — this PDF probably uses a cross-reference stream, " +
        "which this script does not handle. Use qpdf or pdf-lib instead.",
    );
  }
  const [, body, prev] = match;
  const size = /\/Size\s+(\d+)/.exec(body);
  const root = /\/Root\s+(\d+\s+\d+\s+R)/.exec(body);
  const info = /\/Info\s+(\d+)\s+\d+\s+R/.exec(body);
  if (!size || !root || !info) throw new Error("trailer is missing /Size, /Root or /Info");
  return {
    size: Number(size[1]),
    root: root[1],
    infoNum: Number(info[1]),
    prev: Number(prev),
  };
};

const buildUpdate = (bytes, trailer, meta) => {
  const entries = FIELDS.filter((k) => meta[k] !== undefined)
    .map((k) => `/${capitalise(k)} ${pdfString(meta[k])}`)
    .join("\n");
  // The appended object starts on the newline we add, so its offset is bytes.length + 1.
  const objOffset = bytes.length + 1;
  const object = Buffer.from(
    `\n${trailer.infoNum} 0 obj\n<< ${entries} >>\nendobj\n`,
    "latin1",
  );
  const xrefOffset = bytes.length + object.length;
  const xref = Buffer.from(
    `xref\n${trailer.infoNum} 1\n${String(objOffset).padStart(10, "0")} 00000 n \n` +
      `trailer\n<< /Size ${trailer.size} /Root ${trailer.root} ` +
      `/Info ${trailer.infoNum} 0 R /Prev ${trailer.prev} >>\n` +
      `startxref\n${xrefOffset}\n%%EOF\n`,
    "latin1",
  );
  return Buffer.concat([bytes, object, xref]);
};

const main = async () => {
  const { file, meta } = parseArgs(process.argv.slice(2));
  const bytes = await readFile(file);
  if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new Error(`${file} is not a PDF`);
  }
  const trailer = readTrailer(bytes);
  await writeFile(file, buildUpdate(bytes, trailer, meta));
  console.log(`set ${Object.keys(meta).join(", ")} on ${file}`);
};

main().catch((err) => {
  console.error(`set-pdf-metadata: ${err.message}`);
  process.exit(1);
});
