#!/usr/bin/env node
/**
 * make-sample-resume.mjs — regenerate fixtures/docx/sample-resume.docx.
 *
 *   node fixtures/docx/make-sample-resume.mjs
 *
 * The fixture is the Alex Moreau persona laid out the way real resume templates
 * lay it out: the Experience section is a two-column `<w:tbl>`, so an extractor
 * that walks only the top-level children of `<w:body>` loses every employer and
 * every bullet while still exiting zero. It also carries a `<w:tab/>` separator,
 * a `<w:br/>` line break, an `&amp;` entity and a numeric `&#8212;` reference.
 *
 * Written by hand rather than by Word so the bytes are deterministic — fixed
 * timestamps mean regenerating produces an identical file and no diff churn.
 * Zero dependencies, same constraint as the extractor it tests.
 */

import { writeFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DOS_TIME = 0; // 00:00:00
const DOS_DATE = ((2026 - 1980) << 9) | (8 << 5) | 29; // 2026-08-29

const CRC_TABLE = Array.from({ length: 256 }, (_, n) =>
  Array.from({ length: 8 }).reduce((c) => (c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1), n),
);

const crc32 = (buf) =>
  (buf.reduce((c, byte) => CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8), 0xffffffff) ^ 0xffffffff) >>> 0;

/** One deflated zip member: its local header + data, and the central-directory record. */
const member = (name, content, offset) => {
  const nameBytes = Buffer.from(name, "utf8");
  const raw = Buffer.from(content, "utf8");
  const data = deflateRawSync(raw, { level: 9 });
  const crc = crc32(raw);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4); // version made by
  central.writeUInt16LE(20, 6); // version needed
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(DOS_TIME, 12);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(raw.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt32LE(offset, 42);

  return {
    local: Buffer.concat([local, nameBytes, data]),
    central: Buffer.concat([central, nameBytes]),
  };
};

const zip = (files) => {
  const { locals, centrals } = files.reduce(
    (acc, [name, content]) => {
      const { local, central } = member(name, content, acc.offset);
      return {
        offset: acc.offset + local.length,
        locals: [...acc.locals, local],
        centrals: [...acc.centrals, central],
      };
    },
    { offset: 0, locals: [], centrals: [] },
  );

  const body = Buffer.concat(locals);
  const directory = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(body.length, 16);
  return Buffer.concat([body, directory, eocd]);
};

// ── the document ───────────────────────────────────────────────────────────────

const p = (...runs) => `<w:p>${runs.join("")}</w:p>`;
const t = (text) => `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;
const TAB = "<w:r><w:tab/></w:r>";
const BR = "<w:r><w:br/></w:r>";
const cell = (...paragraphs) => `<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>${paragraphs.join("")}</w:tc>`;
const row = (...cells) => `<w:tr>${cells.join("")}</w:tr>`;

const DOCUMENT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${p(t("Alex Moreau"))}
${p(t("Senior Backend Engineer"), TAB, t("alex@example.com"), TAB, t("Berlin"))}
${p(t("Platform &amp; Reliability &#8212; ten years shipping order-critical services."), BR, t("Open to lead roles."))}
${p(t("Experience"))}
<w:tbl>
<w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr>
${row(
  cell(p(t("2022 &#8211; present"))),
  cell(
    p(t("Northwind Logistics &#8212; Senior Backend Engineer")),
    p(t("Own the order-routing service handling 40M requests a day across three regions.")),
    p(t("Moved our batch jobs onto Kubernetes.")),
    p(t("Mentor three engineers; run the team&apos;s on-call review.")),
  ),
)}
${row(
  cell(p(t("2019 &#8211; 2022"))),
  cell(
    p(t("Kestrel Systems &#8212; Backend Engineer")),
    p(t("Built the billing reconciliation pipeline in Python and Postgres.")),
  ),
)}
</w:tbl>
${p(t("Skills"))}
${p(t("Python &#183; Go &#183; Postgres &#183; Kubernetes &#183; Airflow &#183; AWS"))}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>
</w:body>
</w:document>`;

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const out = join(dirname(fileURLToPath(import.meta.url)), "sample-resume.docx");
writeFileSync(
  out,
  zip([
    ["[Content_Types].xml", CONTENT_TYPES],
    ["_rels/.rels", RELS],
    ["word/document.xml", DOCUMENT],
  ]),
);
console.log(`wrote ${out}`);
