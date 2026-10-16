import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { launchForLogin } from "./browser.mjs";
import { authFile } from "./paths.mjs";
import { saveSessionInfo } from "./session.mjs";
import { tr } from "./i18n.mjs";

export async function login(url) {
  const session = await openLogin(url);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await rl.question(tr({ en: `Log in to ${url} in the browser window, then press Enter here... `, pt: `Faça login em ${url} na janela do navegador e depois aperte Enter aqui... `, es: `Inicia sesión en ${url} en la ventana del navegador y luego presiona Enter aquí... ` }));
  rl.close();
  const file = await saveLogin(session);
  console.log(
    tr({
      en: `Session saved to ${file}. Keep it private: it gives access to your account.`,
      pt: `Sessão salva em ${file}. Não compartilhe: ela dá acesso à sua conta.`,
      es: `Sesión guardada en ${file}. No la compartas: da acceso a tu cuenta.`,
    }),
  );
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
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  // indexedDB: Firebase and similar SDKs keep the session there, not in cookies
  await context.storageState({ path: file, indexedDB: true });
  // Only your user can read it, like keys.json (no effect on Windows, where your user folder is already yours)
  fs.chmodSync(file, 0o600);
  // The tab you ended on (logins sometimes open a new one) tells later runs whether the session still works
  const current = [...context.pages()].reverse().find((p) => hostOf(p.url()) === host) ?? page;
  saveSessionInfo(host, current.url());
  await browser.close();
  return file;
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}
