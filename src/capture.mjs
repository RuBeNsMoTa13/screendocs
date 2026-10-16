import fs from "node:fs";
import path from "node:path";
import { VIEWPORTS } from "./config.mjs";
import { open } from "./discover.mjs";
import { applyMask, hideText } from "./mask.mjs";
import { slugOf } from "./paths.mjs";
import { tr } from "./i18n.mjs";

/**
 * Captures every page on every viewport: one image per section of the page
 * (header, sections, footer), a full-page image and, optionally, a video
 * scrolling through it. Also keeps the text of each section, used later for
 * the descriptions.
 */
export async function capture(browser, config, pages, storageState, onPage) {
  const host = new URL(config.url).host;
  const root = path.resolve(config.out, host.replace(/[^a-z0-9.-]/gi, "_"));
  if (config.keep) archive(root);
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });

  const result = { site: host, url: config.url, createdAt: new Date().toISOString(), root, pages: [], screens: [] };

  for (const [n, { url }] of pages.entries()) {
    const step = `[${n + 1}/${pages.length}]`;
    const slug = uniqueSlug(result.pages, slugOf(url));
    const entry = { url, slug, title: "", summary: "", viewports: {} };
    result.pages.push(entry);

    for (const vp of config.viewports) {
      const dir = path.join(root, vp, slug);
      fs.mkdirSync(dir, { recursive: true });
      const size = VIEWPORTS[vp].viewport;
      const context = await browser.newContext({
        ...VIEWPORTS[vp],
        storageState,
        recordVideo: config.video ? { dir: path.join(root, ".tmp-video"), size } : undefined,
      });
      const page = await context.newPage();
      const shot = { full: null, video: null, sections: [] };

      try {
        await withTimeout(PAGE_TIMEOUT, async () => {
          await open(page, url);
          await applyMask(page, config);
          if (!entry.title) {
            const info = await pageInfo(page, config.mask);
            Object.assign(entry, { title: hideText(info.title, config), summary: hideText(info.summary, config) });
          }
          await scrollThrough(page, size.height);

          // The text saved with the capture leaves out what the screenshots blur
          const sections = (await findSections(page, size, config.maxSectionsPerPage, config.mask)).map((s) => ({
            ...s,
            heading: hideText(s.heading, config),
            text: hideText(s.text, config),
          }));
          for (const [i, s] of sections.entries()) {
            const file = `${String(i + 1).padStart(2, "0")}.jpg`;
            await page.screenshot({ path: path.join(dir, file), type: "jpeg", quality: 82, fullPage: true, clip: s.clip });
            const screen = {
              page: url,
              slug,
              viewport: vp,
              file: rel(root, path.join(dir, file)),
              heading: s.heading,
              text: s.text,
              description: s.text,
            };
            shot.sections.push(screen);
            result.screens.push(screen);
          }
          await page.screenshot({ path: path.join(dir, "full.jpg"), type: "jpeg", quality: 75, fullPage: true });
          shot.full = rel(root, path.join(dir, "full.jpg"));
          console.log(`  ${step} ${vp.padEnd(7)} ${url}  ${sections.length} ${tr({ en: "section(s)", pt: "seção(ões)", es: "sección(es)" })}`);
        });
      } catch (err) {
        console.log(`  ${step} ${vp.padEnd(7)} ${url}  ${tr({ en: "failed", pt: "falhou", es: "falló" })}: ${err.message.split("\n")[0]}`);
      }

      const video = page.video();
      await context.close();
      if (video) {
        const file = path.join(dir, "video.webm");
        await video.saveAs(file).catch(() => {});
        await video.delete().catch(() => {});
        if (fs.existsSync(file)) shot.video = rel(root, file);
      }
      entry.viewports[vp] = shot;
    }
    onPage?.(result);
  }

  fs.rmSync(path.join(root, ".tmp-video"), { recursive: true, force: true });
  return result;
}

/** A page that hangs (endless scroll, stuck request) is skipped instead of stopping the run. */
const PAGE_TIMEOUT = 120_000;
function withTimeout(ms, work) {
  let timer;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(tr({ en: `took longer than ${ms / 1000}s, skipped`, pt: `levou mais de ${ms / 1000}s, pulei`, es: `tardó más de ${ms / 1000}s, la salté` }))), ms);
  });
  return Promise.race([work(), limit]).finally(() => clearTimeout(timer));
}

async function pageInfo(page, mask = []) {
  return page.evaluate((sel) => {
      // What the --mask selectors blur is left out of the text too
      const textOf = (el) => {
        if (!el) return "";
        if (!sel) return el.innerText;
        try {
          if (el.closest(sel)) return "";
          const copy = el.cloneNode(true);
          for (const n of copy.querySelectorAll(sel)) n.remove();
          return copy.textContent;
        } catch {
          return el.innerText;
        }
      };
      return {
        title: (textOf(document.querySelector("h1")) || document.title || "").replace(/\s+/g, " ").trim().slice(0, 120),
        summary: (document.querySelector('meta[name="description"]')?.content || "").trim().slice(0, 300),
      };
  }, mask.join(","));
}

/** Scrolls down and back up: loads lazy images, fires entrance animations and films the page. */
async function scrollThrough(page, viewportHeight) {
  await page.evaluate(async (step) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 40 && window.scrollY + innerHeight < document.documentElement.scrollHeight - 2; i++) {
      window.scrollBy({ top: step, behavior: "smooth" });
      await sleep(450);
    }
    await sleep(600);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, Math.round(viewportHeight * 0.7));
  await page.waitForTimeout(1000);
}

/**
 * The page's big blocks (<header>, <section>, <footer>, <main> children, [data-section]),
 * outermost only. Pages without that structure are cut into screen-sized slices.
 */
async function findSections(page, size, max, mask = []) {
  const found = await page.evaluate(
    ({ minH, maxH, minW, sel }) => {
      const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
      // What the --mask selectors blur is left out of the text too
      const textOf = (el) => {
        if (!el) return "";
        if (!sel) return el.innerText;
        try {
          if (el.closest(sel)) return "";
          const copy = el.cloneNode(true);
          for (const n of copy.querySelectorAll(sel)) n.remove();
          return copy.textContent;
        } catch {
          return el.innerText;
        }
      };

      const candidates = [...document.querySelectorAll("header, section, footer, article, [data-section], main > div, main > form")];
      const visible = candidates.filter((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.height >= minH && r.width >= minW && cs.visibility !== "hidden" && cs.display !== "none";
      });
      const outer = visible.filter((el) => !visible.some((o) => o !== el && o.contains(el)));
      const docH = document.documentElement.scrollHeight;
      return outer.map((el) => {
        const r = el.getBoundingClientRect();
        const y = Math.max(0, Math.round(r.top + window.scrollY));
        const heading = clean(textOf(el.querySelector("h1, h2, h3, [role=heading]"))).slice(0, 100);
        const para = [...el.querySelectorAll("p, li")].map((p) => clean(textOf(p))).find((t) => t.length > 30) || "";
        return {
          clip: { x: 0, y, width: document.documentElement.clientWidth, height: Math.round(Math.min(r.height, maxH, docH - y)) },
          heading,
          text: para.slice(0, 220),
        };
      });
    },
    { minH: Math.round(size.height * 0.25), maxH: Math.round(size.height * 1.6), minW: Math.round(size.width * 0.6), sel: mask.join(",") },
  );

  let list = found.filter((s) => s.clip.height > 0).sort((a, b) => a.clip.y - b.clip.y);
  if (list.length < 2) {
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    const width = await page.evaluate(() => document.documentElement.clientWidth);
    const heading = (await pageInfo(page, mask)).title.slice(0, 100);
    list = [];
    for (let y = 0; y < total && list.length < max; y += size.height) {
      list.push({ clip: { x: 0, y, width, height: Math.min(size.height, total - y) }, heading: list.length ? "" : heading, text: "" });
    }
  }
  return list.slice(0, max);
}

/** Moves the previous capture of this site aside, named after the day it was made. */
function archive(root) {
  if (!fs.existsSync(root)) return;
  let when = fs.statSync(root).mtime;
  try {
    when = new Date(JSON.parse(fs.readFileSync(path.join(root, "screens.json"), "utf8")).createdAt);
  } catch {}
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}_${pad(when.getHours())}${pad(when.getMinutes())}`;
  let dest = `${root}_${stamp}`;
  for (let i = 2; fs.existsSync(dest); i++) dest = `${root}_${stamp}-${i}`;
  fs.renameSync(root, dest);
  console.log(tr({ en: `Previous capture kept in ${dest}`, pt: `Captura anterior guardada em ${dest}`, es: `Captura anterior guardada en ${dest}` }));
}

function uniqueSlug(pages, slug) {
  let s = slug;
  for (let i = 2; pages.some((p) => p.slug === s); i++) s = `${slug}-${i}`;
  return s;
}

const rel = (root, file) => path.relative(root, file).split(path.sep).join("/");
