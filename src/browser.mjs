import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { tr } from "./i18n.mjs";

/**
 * screendocs never downloads a browser: it drives the Chrome or Edge already installed
 * on the computer. This also keeps Google login working, since Google refuses to log in
 * on Playwright's bundled Chromium ("this browser may not be secure").
 * CHROMIUM_PATH points it at any other Chromium-based browser instead.
 */
const CHANNELS = ["chrome", "msedge"];

async function launchInstalled(opts) {
  if (process.env.CHROMIUM_PATH) return chromium.launch({ ...opts, executablePath: process.env.CHROMIUM_PATH });
  for (const channel of CHANNELS) {
    try {
      return await chromium.launch({ ...opts, channel });
    } catch {}
  }
  throw new Error(
    tr({
      en: "no Google Chrome or Microsoft Edge found on this computer. Install one of them, or set CHROMIUM_PATH to the executable of another Chromium-based browser.",
      pt: "não achei o Google Chrome nem o Microsoft Edge neste computador. Instale um deles, ou aponte CHROMIUM_PATH para o executável de outro navegador baseado no Chromium.",
      es: "no encontré Google Chrome ni Microsoft Edge en esta computadora. Instala uno de ellos, o apunta CHROMIUM_PATH al ejecutable de otro navegador basado en Chromium.",
    }),
  );
}

/** Used for discovery and capture. */
export function launch({ headless = true } = {}) {
  return launchInstalled({ headless });
}

/** A visible window without the automation flags, so Google accepts the login. */
export function launchForLogin() {
  return launchInstalled({
    headless: false,
    ignoreDefaultArgs: ["--enable-automation"],
    args: ["--disable-blink-features=AutomationControlled"],
  });
}

/**
 * Videos are encoded by Playwright's own ffmpeg (a few MB), which Chrome does not have.
 * Downloads it the first time a video is recorded; the browser itself is never downloaded.
 */
export async function ensureVideoEncoder(browser) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "screendocs-video-"));
  const context = await browser.newContext({ recordVideo: { dir } });
  try {
    await context.newPage();
    return;
  } catch (err) {
    if (!/ffmpeg/i.test(err.message)) throw err;
  } finally {
    await context.close().catch(() => {});
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(tr({ en: "Downloading the video encoder (ffmpeg, first run only)...", pt: "Baixando o codificador de vídeo (ffmpeg, só na primeira vez)...", es: "Descargando el codificador de video (ffmpeg, solo la primera vez)..." }));
  const cli = path.join(path.dirname(createRequire(import.meta.url).resolve("playwright-core/package.json")), "cli.js");
  // Its output goes to stderr: under `screendocs mcp`, stdout carries the protocol
  const r = spawnSync(process.execPath, [cli, "install", "ffmpeg"], { stdio: ["ignore", 2, 2] });
  if (r.status !== 0) throw new Error(tr({ en: "could not download ffmpeg for the videos. Run again, or use --no-video.", pt: "não consegui baixar o ffmpeg para os vídeos. Rode de novo, ou use --no-video.", es: "no pude descargar ffmpeg para los videos. Ejecuta de nuevo, o usa --no-video." }));
}
