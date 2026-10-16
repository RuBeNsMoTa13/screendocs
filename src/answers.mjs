import fs from "node:fs";
import path from "node:path";
import { writeData, aiName } from "./report.mjs";

/** The capture folder of a site ("mysite.com", its URL or the folder itself). */
export function findCapture(target, out = "screendocs-output") {
  const root = locateCapture(target, out);
  if (root) return root;
  const all = listCaptures(out).map((c) => c.name);
  throw new Error(
    `no capture found for "${target}". ` +
      (all.length ? `Captures there are: ${all.join(", ")}.` : `Capture it first (npx screendocs ${target}) or give the capture folder.`),
  );
}

/** Like findCapture, but null when there is none. */
export function locateCapture(target, out = "screendocs-output") {
  const root = target && [target, path.join(out, target), path.join(out, hostOf(target))].find((d) => d && fs.existsSync(path.join(d, "screens.json")));
  return root ? path.resolve(root) : null;
}

/** Every capture in the output folder, newest first: { root, site, createdAt, screens }. */
export function listCaptures(out = "screendocs-output") {
  if (!fs.existsSync(out)) return [];
  return fs
    .readdirSync(out, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(out, d.name, "screens.json")))
    .map((d) => {
      const root = path.resolve(out, d.name);
      try {
        const data = JSON.parse(fs.readFileSync(path.join(root, "screens.json"), "utf8"));
        const screens = data.pages?.reduce((n, pg) => n + (pg.viewports?.[data.viewports?.[0]]?.screens?.length ?? 0), 0) ?? 0;
        return { root, name: d.name, site: data.site ?? d.name, createdAt: data.createdAt, screens };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

/** The JSON array in an AI's answer, even with text or a code block around it. */
export function parseAnswer(text) {
  const fenced = [...String(text).matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  for (const t of [...fenced, String(text)]) {
    const slice = t.slice(t.indexOf("["), t.lastIndexOf("]") + 1);
    for (const json of [slice, joinBrokenLines(slice)]) {
      try {
        const items = JSON.parse(json);
        // Skip the example of the text for the AI, when that text was pasted along with the answer
        if (Array.isArray(items) && !items.every((it) => /^2 to 6 words$/i.test(String(it?.title ?? "").trim()))) return items.map(clean);
      } catch {}
    }
  }
  return null;
}

/**
 * Chats sometimes break a long text in the middle ("a lis" / "ta de programas"), and a line
 * break inside quotes is not valid JSON. Inside quotes, a break between two letters with a
 * lowercase one after it is a cut word and is joined; any other break becomes a space.
 */
function joinBrokenLines(json) {
  let out = "";
  let inString = false;
  for (let i = 0; i < json.length; i++) {
    const c = json[i];
    if (c === '"' && json[i - 1] !== "\\") inString = !inString;
    if (inString && (c === "\n" || c === "\r" || c === "\t")) {
      let j = i;
      while (/\s/.test(json[j + 1] ?? "")) j++;
      const cut = /\p{L}/u.test(out.at(-1) ?? "") && /\p{Ll}/u.test(json[j + 1] ?? "");
      out = cut ? out : out.replace(/ *$/, " ");
      i = j;
      continue;
    }
    out += c;
  }
  return out;
}

/** Drops the source marks some chats add to the text, like [cite: 9] or [cite_start]. */
function clean(it) {
  if (!it || typeof it !== "object") return it;
  const strip = (v) => (typeof v === "string" ? v.replace(/\s*\[cite(?:_start|_end)?(?::[^\]]*)?\]/g, "").trim() : v);
  return { ...it, title: strip(it.title), description: strip(it.description) };
}

/**
 * Writes titles and descriptions into screens.json, index.html and prompt.md, recording
 * who wrote each one (describedBy) and when, so the report shows which screens the AI
 * described and which still have only the text from the page.
 */
export function applyItems(root, items, by) {
  const at = new Date().toISOString();
  const byFile = new Map(items.filter((i) => i?.file).map((i) => [normalize(i.file), i]));

  const data = JSON.parse(fs.readFileSync(path.join(root, "screens.json"), "utf8"));
  const [primary, ...others] = data.viewports;
  let updated = 0;
  const missing = [];
  for (const page of data.pages) {
    const main = page.viewports[primary]?.screens ?? [];
    for (const s of main) {
      // The chat answers with the unique names of for-ai/ (home-desktop-01.jpg)
      const a = byFile.get(normalize(s.file)) ?? byFile.get(aiName(s.file)) ?? items.find((i) => sameFile(i?.file, s.file));
      if (!a) {
        if (!s.describedBy) missing.push(s.file);
        continue;
      }
      keepOriginal(s);
      s.title = String(a.title ?? s.title).trim();
      s.description = String(a.description ?? s.description).trim();
      Object.assign(s, { describedBy: by, describedAt: at });
      updated++;
    }
    const done = (m) => items.some((i) => sameFile(i?.file, m.file));
    for (const vp of others) {
      const list = page.viewports[vp]?.screens ?? [];
      for (const [i, s] of list.entries()) {
        // Same heading on the same page; without headings, the same position when both have as many sections
        const twin =
          byFile.get(normalize(s.file)) ??
          main.find((m) => m.heading && m.heading === s.heading && done(m)) ??
          (!s.heading && list.length === main.length && done(main[i]) ? main[i] : undefined);
        if (twin) keepOriginal(s);
        if (twin) Object.assign(s, { title: String(twin.title).trim(), description: String(twin.description).trim(), describedBy: by, describedAt: at });
      }
    }
  }
  const report = writeData(root, data);
  const total = data.pages.reduce((n, p) => n + (p.viewports[primary]?.screens.length ?? 0), 0);
  return { updated, total, report, missing, by };
}

/**
 * The text a screen had before any AI wrote over it (taken from the page), kept so the
 * report can show what changed. Only the first time: later answers do not replace it.
 */
function keepOriginal(s) {
  if (!s.original && !s.describedBy) s.original = { title: s.title, description: s.description };
}

/**
 * The same screen, even when the AI wrote the name another way: "desktop/home/01.jpg",
 * "home-desktop-01.jpg", ".\\desktop\\home\\01.jpg" or the full path on the computer.
 */
export function sameFile(answered, file) {
  const a = normalize(answered ?? "").toLowerCase();
  const f = normalize(file).toLowerCase();
  return !!a && (a === f || a === aiName(f) || a.endsWith(`/${f}`) || a.endsWith(`/${aiName(f)}`));
}

const normalize = (f) => String(f).replace(/\\/g, "/").replace(/^\.\//, "").trim();

function hostOf(t) {
  try {
    return new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`).host.replace(/[^a-z0-9.-]/gi, "_");
  } catch {
    return "";
  }
}
