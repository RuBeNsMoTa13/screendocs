import fs from "node:fs";
import path from "node:path";
import { writeData, aiName } from "./report.mjs";

/** The capture folder of a site ("mysite.com", its URL or the folder itself). */
export function findCapture(target, out = "screendocs-output") {
  const root = [target, path.join(out, target), path.join(out, hostOf(target))].find((d) => d && fs.existsSync(path.join(d, "screens.json")));
  if (!root) throw new Error(`no capture found for "${target}". Capture it first (npx screendocs ${target}) or give the capture folder.`);
  return path.resolve(root);
}

/** The JSON array in an AI's answer, even with text or a code block around it. */
export function parseAnswer(text) {
  const fenced = [...String(text).matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  for (const t of [...fenced, String(text)]) {
    try {
      const items = JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1));
      if (Array.isArray(items)) return items;
    } catch {}
  }
  return null;
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
      const a = byFile.get(normalize(s.file)) ?? byFile.get(aiName(s.file));
      if (!a) {
        if (!s.describedBy) missing.push(s.file);
        continue;
      }
      s.title = String(a.title ?? s.title).trim();
      s.description = String(a.description ?? s.description).trim();
      Object.assign(s, { describedBy: by, describedAt: at });
      updated++;
    }
    const done = (m) => byFile.has(normalize(m.file)) || byFile.has(aiName(m.file));
    for (const vp of others) {
      const list = page.viewports[vp]?.screens ?? [];
      for (const [i, s] of list.entries()) {
        // Same heading on the same page; without headings, the same position when both have as many sections
        const twin =
          byFile.get(normalize(s.file)) ??
          main.find((m) => m.heading && m.heading === s.heading && done(m)) ??
          (!s.heading && list.length === main.length && done(main[i]) ? main[i] : undefined);
        if (twin) Object.assign(s, { title: String(twin.title).trim(), description: String(twin.description).trim(), describedBy: by, describedAt: at });
      }
    }
  }
  const report = writeData(root, data);
  const total = data.pages.reduce((n, p) => n + (p.viewports[primary]?.screens.length ?? 0), 0);
  return { updated, total, report, missing, by };
}

const normalize = (f) => String(f).replace(/\\/g, "/").replace(/^\.\//, "").trim();

function hostOf(t) {
  try {
    return new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`).host.replace(/[^a-z0-9.-]/gi, "_");
  } catch {
    return "";
  }
}
