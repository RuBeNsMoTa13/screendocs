#!/usr/bin/env node
/**
 * Takes the README images from docs/manual.html: one PNG per part of the manual, in each
 * language, in docs/images/<lang>/, reduced to 128 colors so the repository stays small.
 * Run after changing the manual: npm run manual:images
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import UPNG from "upng-js";
import { launch } from "../src/browser.mjs";

const docs = fileURLToPath(new URL("../docs/", import.meta.url));
// image name: [section id, first child, last child] of that section in the manual
const SHOTS = {
  ways: ["jeitos", 0, 99],
  "menu-start": ["menu", 0, 4],
  "menu-run": ["menu", 18, 19],
  "mapping-steps": ["mapa", 0, 2],
  "mapping-pages": ["mapa", 3, 8],
  "mapping-sections": ["mapa", 9, 99],
  describe: ["descrever", 0, 3],
  layers: ["padroes", 4, 8],
  files: ["padroes", 9, 11],
  keys: ["seguranca", 2, 5],
  output: ["resultado", 0, 99],
};

const browser = await launch({ headless: true });
try {
  for (const lang of ["en", "pt", "es"]) {
    const page = await browser.newPage({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: 1.5, colorScheme: "light" });
    await page.goto(`file://${docs}manual.html`);
    await page.click(`#lang-${lang}`);
    await page.addStyleTag({ content: "header.top{position:static !important} .part{padding-top:28px !important}" });
    await page.waitForTimeout(500);
    fs.mkdirSync(`${docs}images/${lang}`, { recursive: true });
    for (const [name, part] of Object.entries(SHOTS)) {
      const clip = await page.evaluate(([id, first, last]) => {
        const section = document.getElementById(id);
        const boxes = [...section.children].slice(first, last + 1).map((el) => el.getBoundingClientRect());
        const top = Math.min(...boxes.map((b) => b.top)) + scrollY;
        const bottom = Math.max(...boxes.map((b) => b.bottom)) + scrollY;
        const left = section.getBoundingClientRect().left;
        return { x: Math.max(0, left - 24), y: top - 24, width: section.offsetWidth + 48, height: bottom - top + 36 };
      }, part);
      const shot = await page.screenshot({ clip, fullPage: true });
      const img = UPNG.decode(shot);
      const small = UPNG.encode(UPNG.toRGBA8(img), img.width, img.height, 128);
      fs.writeFileSync(`${docs}images/${lang}/${name}.png`, Buffer.from(small));
    }
    await page.close();
    console.log(`docs/images/${lang}/`);
  }
} finally {
  await browser.close();
}
