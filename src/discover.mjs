import { VIEWPORTS } from "./config.mjs";

const LOGOUT = /(log-?out|sign-?out|sign-?off|logoff|sair|deslogar|desconectar|encerrar-sessao)/i;
const FILE = /\.(pdf|zip|rar|7z|png|jpe?g|gif|webp|svg|mp4|mp3|webm|docx?|xlsx?|pptx?|csv|json|xml|txt)$/i;

/**
 * Finds the pages to capture: either the configured list, or a breadth-first walk
 * over same-site links starting at the given URL (with the saved login, so pages
 * behind it are found too). Logout links and files are skipped, and URLs that
 * only differ by an id (/posts/12, /posts/13) count as one screen.
 */
export async function discover(browser, config, storageState) {
  const start = new URL(config.url);
  if (config.pages?.length) {
    return config.pages.map((p) => ({ url: new URL(p, start).href }));
  }

  const context = await browser.newContext({ ...VIEWPORTS.desktop, storageState });
  const page = await context.newPage();
  const seen = new Set();
  const templates = new Set();
  const found = [];
  const queue = [{ url: clean(start), depth: 0 }];

  console.log(`\nLooking for pages (up to ${config.maxPages})...`);
  while (queue.length && found.length < config.maxPages) {
    const { url, depth } = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);

    try {
      await open(page, url);
    } catch (err) {
      console.log(`  skip ${url} (${err.message.split("\n")[0]})`);
      continue;
    }
    // A redirect (e.g. to the login page) lands on a page we may already have
    const landed = clean(new URL(page.url()));
    if (landed !== url && seen.has(landed)) continue;
    seen.add(landed);
    if (!sameSite(new URL(landed).host, start.host)) {
      console.log(`  skip ${url} (it opened ${new URL(landed).host}, another site)`);
      continue;
    }

    const template = templateOf(landed);
    if (templates.has(template)) continue;
    templates.add(template);
    found.push({ url: landed });
    console.log(`  [${found.length}/${config.maxPages} max] found ${landed}`);

    if (depth >= config.depth) continue;
    const links = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
    for (const href of links) {
      let u;
      try {
        u = new URL(href);
      } catch {
        continue;
      }
      if (!sameSite(u.host, start.host) || !/^https?:$/.test(u.protocol)) continue;
      const c = clean(u);
      if (seen.has(c) || LOGOUT.test(c) || FILE.test(u.pathname)) continue;
      if (config.exclude.some((x) => c.includes(x))) continue;
      queue.push({ url: c, depth: depth + 1 });
    }
  }

  await context.close();
  return found;
}

/** Loads a page and waits for it to settle; SPAs that never go network-idle still work. */
export async function open(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(800);
}

/** google.com and www.google.com are the same site (sites often redirect from one to the other). */
function sameSite(a, b) {
  const bare = (h) => h.toLowerCase().replace(/^www\./, "");
  return bare(a) === bare(b);
}

function clean(u) {
  const c = new URL(u);
  c.hash = "";
  c.search = ""; // ?q=, ?utm_ etc. are the same screen; pass --pages for query-routed apps
  // hash routers (#/dashboard) are real pages
  if (/^#\//.test(u.hash ?? "")) c.hash = u.hash;
  return c.href.replace(/\/$/, "") || c.href;
}

function templateOf(url) {
  const u = new URL(url);
  const path = (u.pathname + (u.hash || ""))
    .split("/")
    .map((s) => (/^\d+$|^[0-9a-f-]{16,}$|^[A-Za-z0-9_-]{20,}$/i.test(s) ? ":id" : s))
    .join("/");
  return path.replace(/\/$/, "");
}
