import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { launchForLogin } from "./browser.mjs";
import { authFile } from "./paths.mjs";
import { saveSessionInfo } from "./session.mjs";

export async function login(url) {
  const session = await openLogin(url);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await rl.question(`Log in to ${url} in the browser window, then press Enter here... `);
  rl.close();
  console.log(`Session saved to ${await saveLogin(session)}. Keep it private: it gives access to your account.`);
}

/** Opens a visible browser window on the site for the person to log in. */
export async function openLogin(url) {
  const host = new URL(url).host;
  const browser = await launchForLogin();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(url);
  return { url, host, browser, context, page };
}

/** Saves the session of a window opened by openLogin, closes it and returns the session file. */
export async function saveLogin({ host, browser, context, page }) {
  const file = authFile(host);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // indexedDB: Firebase and similar SDKs keep the session there, not in cookies
  await context.storageState({ path: file, indexedDB: true });
  // The tab you ended on (logins sometimes open a new one) tells later runs whether the session still works
  const current = [...context.pages()].reverse().find((p) => hostOf(p.url()) === host) ?? page;
  saveSessionInfo(host, current.url());
  await browser.close();
  ensureGitignored();
  return file;
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/** Adds .screendocs/ to the project's .gitignore so the session is never committed. */
function ensureGitignored() {
  if (!fs.existsSync(".git")) return;
  const gi = fs.existsSync(".gitignore") ? fs.readFileSync(".gitignore", "utf8") : "";
  if (/^\/?\.screendocs\/?$/m.test(gi)) return;
  fs.appendFileSync(".gitignore", `${gi && !gi.endsWith("\n") ? "\n" : ""}.screendocs/\n`);
  console.log("Added .screendocs/ to .gitignore.");
}
