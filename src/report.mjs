import fs from "node:fs";
import path from "node:path";

/** Writes screens.json (for scripts) and index.html (a report you can open or share). */
export function writeReport(result, config) {
  const data = {
    site: result.site,
    url: result.url,
    createdAt: result.createdAt,
    viewports: config.viewports,
    pages: result.pages.map((p) => ({
      url: p.url,
      slug: p.slug,
      title: p.title,
      summary: p.summary,
      viewports: Object.fromEntries(
        Object.entries(p.viewports).map(([vp, v]) => [
          vp,
          {
            full: v.full,
            video: v.video,
            screens: v.sections.map(({ file, heading, title, description }) => ({ file, heading, title: title || heading || "", description: description || "" })),
          },
        ]),
      ),
    })),
  };
  return writeData(result.root, data, config.lang);
}

/** screens.json, index.html and prompt.md from the report data. Also rewritten after describing. */
export function writeData(root, data, lang = data.lang ?? "en") {
  data.lang = lang;
  fs.writeFileSync(path.join(root, "screens.json"), JSON.stringify(data, null, 2) + "\n");
  fs.writeFileSync(path.join(root, "prompt.md"), prompt(data));
  const file = path.join(root, "index.html");
  fs.writeFileSync(file, html(data));
  return file;
}

const LANGS = { en: "English", pt: "Brazilian Portuguese", "pt-br": "Brazilian Portuguese", es: "Spanish" };
export const langName = (lang) => LANGS[String(lang).toLowerCase()] ?? lang;

/**
 * How to describe the screens with an AI chat in the browser, for whoever prefers doing it
 * outside the terminal. The images and the text for each message are in for-ai/.
 */
function prompt(data) {
  const parts = Math.max(1, Math.ceil(primaryScreens(data).length / PART));
  return `# Describe the screens of ${data.site}

The easiest way is to let screendocs guide you. Run:

    npx screendocs describe ${data.site}

and choose "A chat in your browser". It opens each folder of images, copies the text for the AI and reads the answer you paste back.

To do the chat part on your own: use a chat with an AI that reads images (ChatGPT, Gemini, Claude.ai...). The images are in the \`for-ai\` folder of this capture, in ${parts} part(s) of up to ${PART} (most chats take about ${PART} images per message). For each part, attach all the images of its folder and paste the text of its \`prompt.txt\`. Then run the command above, choose "A chat in your browser" and paste each answer when it asks.
`;
}

/** Images per chat message: most chats take about 10. */
export const PART = 10;

/** "desktop/home/01.jpg" -> "home-desktop-01.jpg", a name that is unique among all the screens. */
export const aiName = (file) => {
  const [vp, ...rest] = String(file).split("/");
  const name = rest.pop();
  return [...rest, vp, name].join("-");
};

/**
 * for-ai/part-N: copies of the screens to describe, with unique names, in groups small
 * enough for one chat message, each with the text to paste (prompt.txt).
 */
export function writeForAi(root) {
  const data = JSON.parse(fs.readFileSync(path.join(root, "screens.json"), "utf8"));
  const dir = path.join(root, "for-ai");
  fs.rmSync(dir, { recursive: true, force: true });
  const screens = primaryScreens(data).filter((s) => fs.existsSync(path.join(root, s.file)));
  const parts = [];
  for (let i = 0; i < screens.length; i += PART) {
    const batch = screens.slice(i, i + PART).map((s) => ({ ...s, file: aiName(s.file) }));
    const partDir = path.join(dir, `part-${parts.length + 1}`);
    fs.mkdirSync(partDir, { recursive: true });
    for (const [j, s] of batch.entries()) fs.copyFileSync(path.join(root, screens[i + j].file), path.join(partDir, s.file));
    const promptFile = path.join(partDir, "prompt.txt");
    fs.writeFileSync(promptFile, task(data, batch, "attached image"));
    parts.push({ dir: partDir, names: batch.map((s) => s.file), prompt: promptFile });
  }
  return parts;
}

/** The screens of the first viewport, the ones that get described. */
export function primaryScreens(data) {
  const vp = data.viewports[0];
  return data.pages.flatMap((p) => (p.viewports[vp]?.screens ?? []).map((s) => ({ ...s, page: p.url })));
}

/** The instructions and the list of screens, shared by prompt.md and the AI tools. */
export function task(data, screens, what = "screenshot", docs = "") {
  const lang = langName(data.lang);
  const list = screens
    .map((s) => `- \`${s.file}\` · page ${s.page}${s.heading ? ` · heading: ${s.heading}` : ""}${s.description && !s.describedBy && s.description !== s.heading ? ` · text: ${s.description}` : ""}`)
    .join("\n");
  return `You are documenting the screens of the website ${data.url}. For each ${what}, say in ${lang} what the user sees and can do there, based only on what is visible and on the notes below${docs ? ` and on the project documentation in ${docs}` : ""}. Do not invent features.

Reply with only a JSON array, one item per image, using the exact file names below. There ${screens.length === 1 ? "is 1 image" : `are ${screens.length} images`}, so the array must have exactly ${screens.length} item(s), none repeated. If any image did not arrive, write which ones before the JSON.

\`\`\`json
[{ "file": "${screens[0]?.file ?? "desktop/home/01.jpg"}", "title": "2 to 6 words", "description": "one or two sentences" }]
\`\`\`

Screens:
${list}
`;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Who wrote a screen's description: an AI, or nobody yet (the text taken from the page). */
const badge = (s) =>
  s.describedBy
    ? `<em class="by ai" title="${esc(new Date(s.describedAt).toLocaleString())}">${esc(s.describedBy)}</em>`
    : `<em class="by">page text</em>`;

/** "18 of 20 screens described by Claude Code on ..." when an AI has described any screen. */
function summary(data) {
  const screens = primaryScreens(data);
  const done = screens.filter((s) => s.describedBy);
  if (!done.length) return "";
  const who = [...new Set(done.map((s) => s.describedBy))].join(", ");
  const last = new Date(Math.max(...done.map((s) => Date.parse(s.describedAt) || 0))).toLocaleString();
  const rest = screens.length - done.length;
  return `<p class="summary">${done.length} of ${screens.length} screens described by <strong>${esc(who)}</strong> · ${esc(last)}${
    rest ? ` · <span class="warn">${rest} without an AI description (marked "page text")</span>` : ""
  }</p>`;
}

function html(data) {
  const tabs = data.viewports
    .map((vp, i) => `<button class="tab${i ? "" : " on"}" data-vp="${vp}">${esc(vp)}</button>`)
    .join("");
  const nav = data.pages.map((p) => `<a href="#${esc(p.slug)}">${esc(p.title || new URL(p.url).pathname)}</a>`).join("");
  const pages = data.pages
    .map((p) => {
      const views = data.viewports
        .map((vp, i) => {
          const v = p.viewports[vp];
          if (!v) return "";
          const cards = v.screens
            .map(
              (s) => `<figure><a href="${esc(s.file)}" target="_blank"><img src="${esc(s.file)}" loading="lazy" alt="${esc(s.title)}"></a>
<figcaption><strong>${esc(s.title)}</strong>${s.description && s.description !== s.title ? `<span>${esc(s.description)}</span>` : ""}${badge(s)}</figcaption></figure>`,
            )
            .join("");
          const links = [v.full && `<a href="${esc(v.full)}" target="_blank">full page</a>`, v.video && `<a href="${esc(v.video)}" target="_blank">video</a>`]
            .filter(Boolean)
            .join(" · ");
          return `<div class="vp vp-${vp}"${i ? " hidden" : ""}>
${v.video ? `<video src="${esc(v.video)}" controls muted preload="metadata"></video>` : ""}
<div class="grid">${cards || "<p class=muted>No screenshots.</p>"}</div><p class="muted">${links}</p></div>`;
        })
        .join("");
      return `<section id="${esc(p.slug)}"><h2>${esc(p.title || p.slug)}</h2><p class="muted"><a href="${esc(p.url)}" target="_blank">${esc(p.url)}</a></p>
${p.summary ? `<p>${esc(p.summary)}</p>` : ""}${views}</section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(data.site)} screens</title>
<style>
:root{--bg:#0d0d0f;--panel:#17171b;--line:#2a2a30;--ink:#ececf1;--muted:#9a9aa5;--accent:#e5484d}
@media (prefers-color-scheme:light){:root{--bg:#fafafa;--panel:#fff;--line:#e3e3e8;--ink:#17171b;--muted:#6b6b76}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif}
header{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line);padding:14px 16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center}
h1{font-size:18px;margin:0;flex:1}h2{margin:0 0 4px}a{color:var(--accent)}
.tab{background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:6px 12px;cursor:pointer;text-transform:capitalize}
.tab.on{border-color:var(--accent);color:var(--accent)}
nav{display:flex;flex-wrap:wrap;gap:6px 14px;padding:12px 16px;border-bottom:1px solid var(--line)}
main{max-width:1200px;margin:auto;padding:0 16px 40px}section{padding:28px 0;border-bottom:1px solid var(--line)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-top:14px}
.vp-mobile .grid{grid-template-columns:repeat(auto-fill,minmax(170px,1fr))}
figure{margin:0;background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden}
figure img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top}
.vp-mobile figure img{aspect-ratio:9/16}
figcaption{padding:10px 12px;display:grid;gap:4px}figcaption span{color:var(--muted);font-size:14px}
.by{justify-self:start;font-style:normal;font-size:11px;padding:1px 7px;border-radius:99px;border:1px solid var(--line);color:var(--muted)}
.by.ai{border-color:var(--accent);color:var(--accent)}
.summary{margin:16px 0 0;font-size:14px}.warn{color:var(--accent)}
video{width:100%;max-height:420px;background:#000;border-radius:8px;margin-top:12px}
.muted{color:var(--muted);font-size:13px}
</style></head><body>
<header><h1>${esc(data.site)} <span class="muted">· ${esc(new Date(data.createdAt).toLocaleString())}</span></h1>${tabs}</header>
<nav>${nav}</nav><main>${summary(data)}${pages}</main>
<script>
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{
document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("on",t===b));
document.querySelectorAll(".vp").forEach(v=>v.hidden=!v.classList.contains("vp-"+b.dataset.vp));});
</script>
<p class="muted" style="text-align:center">Generated by screendocs</p></body></html>
`;
}
