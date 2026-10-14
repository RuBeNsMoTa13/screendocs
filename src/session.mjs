import fs from "node:fs";
import { open } from "./discover.mjs";
import { authFile } from "./paths.mjs";

const infoFile = (host) => authFile(host).replace(/\.json$/, ".info.json");

/** Remembers the page you were on when the login was saved: only a logged-in user can stay on it. */
export function saveSessionInfo(host, url) {
  const u = new URL(url);
  if (u.host !== host) return;
  fs.writeFileSync(infoFile(host), JSON.stringify({ checkUrl: u.href, savedAt: new Date().toISOString() }, null, 2) + "\n");
}

/**
 * Opens that page with the saved session. Being sent somewhere else (usually the
 * login page) or seeing a password field means the session expired.
 * Returns "ok", "expired" or "unknown" (no page to check, e.g. older logins).
 */
export async function sessionStatus(browser, host) {
  const file = infoFile(host);
  if (!fs.existsSync(file)) return { state: "unknown" };
  const { checkUrl, savedAt } = JSON.parse(fs.readFileSync(file, "utf8"));
  const context = await browser.newContext({ storageState: authFile(host) });
  try {
    const page = await context.newPage();
    await open(page, checkUrl);
    const landed = new URL(page.url());
    const wanted = new URL(checkUrl);
    const moved = landed.host !== wanted.host || trim(landed.pathname) !== trim(wanted.pathname);
    const askingPassword = await page.locator("input[type=password]").first().isVisible().catch(() => false);
    return { state: moved || askingPassword ? "expired" : "ok", checkUrl, landed: landed.href, savedAt };
  } catch {
    return { state: "unknown", checkUrl, savedAt };
  } finally {
    await context.close();
  }
}

const trim = (p) => p.replace(/\/+$/, "") || "/";
