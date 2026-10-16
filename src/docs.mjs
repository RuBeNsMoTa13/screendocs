import fs from "node:fs";
import path from "node:path";
import { tr } from "./i18n.mjs";

/**
 * The project documentation the AI reads along with the screenshots: a folder or a single
 * file. Its text is taken out once and saved in the capture folder (DOCS_FILE), so every way
 * of describing (AI tools, API, chat, MCP) gets the same text, PDFs and Office files included.
 */
export const DOCS_FILE = "docs-for-ai.md";

/** About 40 pages of text. Past that the rest is cut. */
const LIMIT = 150_000;

const TEXT = ["md", "mdx", "txt", "html", "htm", "rst", "adoc", "json", "yaml", "yml", "csv"];
const OFFICE = ["pdf", "docx", "odt", "xlsx", "ods", "pptx", "odp"];
/** The file types read, for the menu and the errors. */
export const DOC_TYPES = [...TEXT, ...OFFICE];

const ext = (file) => path.extname(file).slice(1).toLowerCase();

/** The text of a folder (and its subfolders) or of one file: { text, files, skipped, cut }. */
export async function readDocs(target) {
  const from = path.resolve(String(target).trim());
  if (!fs.existsSync(from)) throw new Error(tr({ en: `documentation not found: ${from}`, pt: `documentação não encontrada: ${from}`, es: `no encontré la documentación: ${from}` }));
  const one = fs.statSync(from).isFile();
  if (one && !DOC_TYPES.includes(ext(from))) throw new Error(`${path.basename(from)}: ${tr({ en: "screendocs reads", pt: "o screendocs lê", es: "screendocs lee" })} ${DOC_TYPES.join(", ")}`);

  const files = one ? [from] : walk(from);
  const parts = [];
  const read = [];
  const skipped = [];
  let size = 0;
  let cut = false;
  for (const file of files) {
    if (size >= LIMIT) {
      cut = true;
      break;
    }
    let text;
    try {
      text = clean(await textOf(file));
    } catch {
      skipped.push(file);
      continue;
    }
    // A scanned PDF has only images: nothing to read
    if (!text) {
      skipped.push(file);
      continue;
    }
    if (size + text.length > LIMIT) cut = true;
    text = text.slice(0, LIMIT - size);
    size += text.length;
    parts.push(`## ${one ? path.basename(file) : path.relative(from, file).replace(/\\/g, "/")}\n\n${text}`);
    read.push(file);
  }
  return { text: parts.join("\n\n"), files: read, skipped, cut };
}

/** Readable files of a folder, in name order, skipping hidden folders and node_modules. */
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (DOC_TYPES.includes(ext(e.name))) out.push(p);
  }
  return out;
}

async function textOf(file) {
  const type = ext(file);
  if (type === "pdf") return pdfText(file);
  if (OFFICE.includes(type)) return officeText(file, type);
  const raw = fs.readFileSync(file, "utf8");
  return type === "html" || type === "htm" ? fromHtml(raw) : raw;
}

async function pdfText(file) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(fs.readFileSync(file)));
  const { text } = await extractText(pdf, { mergePages: false });
  return text.join("\n\n");
}

/**
 * Word, Excel, PowerPoint and their OpenDocument versions are zip files with XML inside:
 * the text is in the XML, so only the zip needs a library.
 */
async function officeText(file, type) {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const get = (name) => zip.file(name)?.async("string") ?? "";
  const numbered = (re) =>
    Object.keys(zip.files)
      .filter((n) => re.test(n))
      .sort((a, b) => Number(a.match(/(\d+)\.xml$/)[1]) - Number(b.match(/(\d+)\.xml$/)[1]));

  if (type === "docx") return fromXml(await get("word/document.xml"));
  if (type === "pptx") {
    const slides = numbered(/^ppt\/slides\/slide\d+\.xml$/);
    return (await Promise.all(slides.map(get))).map((x, i) => `Slide ${i + 1}\n${fromXml(x)}`).join("\n\n");
  }
  if (type === "xlsx") {
    const shared = [...(await get("xl/sharedStrings.xml")).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => fromXml(m[1]).replace(/\n/g, " "));
    const sheets = numbered(/^xl\/worksheets\/sheet\d+\.xml$/);
    const tables = await Promise.all(
      sheets.map(async (name) =>
        [...(await get(name)).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)]
          .map((row) =>
            [...row[1].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)]
              .map(([, attrs, body = ""]) => {
                const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
                if (/t="s"/.test(attrs)) return shared[Number(v)] ?? "";
                if (/t="inlineStr"/.test(attrs)) return fromXml(body);
                return decode(v ?? "");
              })
              .join(" | "),
          )
          .join("\n"),
      ),
    );
    return tables.join("\n\n");
  }
  // odt, ods, odp
  return fromXml(await get("content.xml"));
}

/** Text of an XML document: paragraphs, rows and slides become lines, cells get a separator. */
function fromXml(xml) {
  return decode(
    String(xml)
      .replace(/<(w:tab|text:tab)\b[^>]*\/>/g, "\t")
      .replace(/<\/(w:tc|table:table-cell)>/g, " | ")
      .replace(/<\/(w:p|a:p|text:p|text:h|w:tr|table:table-row)>|<(w:br|text:line-break)\b[^>]*\/>/g, "\n")
      .replace(/<[^>]+>/g, "")
      // A cell's paragraphs stay on its row
      .replace(/\n \| /g, " | ")
      .replace(/ \| (\n|$)/g, "$1"),
  );
}

function fromHtml(html) {
  return decode(
    html
      .replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, "")
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article|header|footer)>|<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  );
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
    e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e.toLowerCase()] ?? m),
  );
}

const clean = (s) => s.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

/**
 * Saves the person's extra request and the documentation text with the capture, where every
 * way of describing finds them. `undefined` keeps what the capture already has; an empty
 * text removes it. Returns what was read, to tell the person.
 */
export async function saveBrief(root, { instructions, docs } = {}) {
  const file = path.join(root, "screens.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  let read = null;
  if (instructions !== undefined) {
    const t = String(instructions ?? "").trim();
    if (t) data.instructions = t;
    else delete data.instructions;
  }
  if (docs !== undefined) {
    const out = path.join(root, DOCS_FILE);
    if (String(docs ?? "").trim()) {
      read = await readDocs(docs);
      if (!read.text)
        throw new Error(
          tr({
            en: `no text found in ${path.resolve(docs)} (screendocs reads ${DOC_TYPES.join(", ")}; a scanned PDF has only images)`,
            pt: `não achei texto em ${path.resolve(docs)} (o screendocs lê ${DOC_TYPES.join(", ")}; um PDF escaneado só tem imagens)`,
            es: `no encontré texto en ${path.resolve(docs)} (screendocs lee ${DOC_TYPES.join(", ")}; un PDF escaneado solo tiene imágenes)`,
          }),
        );
      fs.writeFileSync(out, read.text + "\n");
      data.docs = path.resolve(docs);
    } else {
      fs.rmSync(out, { force: true });
      delete data.docs;
    }
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  return read;
}

/** The documentation text saved with a capture, or "". */
export const docsText = (root) => {
  const f = path.join(root, DOCS_FILE);
  return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "";
};

/** "Documentation: 3 file(s) read (cut at ~150 KB), 1 without text: scan.pdf" */
export function docsSummary(read) {
  if (!read) return "";
  const names = (list) => list.map((f) => path.basename(f)).join(", ");
  const t = tr({
    en: { read: (n) => `Documentation for the AI: ${n} file(s) read`, cut: " (cut at about 150 KB of text)", skipped: "; without text, skipped: " },
    pt: { read: (n) => `Documentação para a IA: ${n} arquivo(s) lido(s)`, cut: " (cortada em uns 150 KB de texto)", skipped: "; sem texto, pulei: " },
    es: { read: (n) => `Documentación para la IA: ${n} archivo(s) leído(s)`, cut: " (cortada en unos 150 KB de texto)", skipped: "; sin texto, salté: " },
  });
  return t.read(read.files.length) + (read.cut ? t.cut : "") + (read.skipped.length ? t.skipped + names(read.skipped) : "");
}
