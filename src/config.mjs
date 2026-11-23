import fs from "node:fs";
import { readUserConfig, SETTINGS } from "./userconfig.mjs";
import { uiLang } from "./i18n.mjs";

export const DEFAULTS = {
  maxPages: 20,
  depth: 3,
  pages: null,
  exclude: [],
  viewports: ["desktop", "mobile"],
  video: true,
  // slow, normal, fast or pixels per second
  scrollSpeed: "normal",
  // seconds on the top of the page before scrolling (loading and opening animations)
  scrollDelay: 1,
  gif: false,
  gifWidth: 800,
  // the video is filmed at 25 frames per second: fewer makes the scroll look jumpy
  gifFps: 25,
  out: "screendocs-output",
  mask: [],
  autoMask: true,
  describe: null,
  docs: null,
  instructions: null,
  model: null,
  // null: the language of the CLI
  lang: null,
  headed: false,
  keep: false,
  maxSectionsPerPage: 10,
};

export const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};

/** Pixels per second for each named speed of --scroll-speed. */
export const SCROLL_SPEEDS = { slow: 500, normal: 800, fast: 1500 };

/** --scroll-speed as pixels per second: slow, normal, fast or a number. */
export function scrollSpeed(v) {
  if (v == null || v === "") return SCROLL_SPEEDS.normal;
  if (SCROLL_SPEEDS[String(v).toLowerCase()]) return SCROLL_SPEEDS[String(v).toLowerCase()];
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`--scroll-speed is slow, normal, fast or pixels per second (e.g. 300), not "${v}"`);
  return n;
}

/** The project's config file: --config, else screendocs.config.json in this folder. */
export function projectFile(flags = {}) {
  return flags.config ?? (fs.existsSync("screendocs.config.json") ? "screendocs.config.json" : null);
}

/** The user's config, without what is only about the CLI itself (language). */
function userDefaults() {
  const saved = readUserConfig();
  return Object.fromEntries(Object.entries(saved).filter(([k]) => k !== "language" && SETTINGS[k]));
}

/**
 * What a run uses before any option is typed: the defaults, then the user's config
 * (~/.screendocs/config.json, from "screendocs config"), then screendocs.config.json.
 */
export function baseConfig(flags = {}) {
  const file = projectFile(flags);
  const fromFile = file ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const config = { ...DEFAULTS };
  for (const layer of [userDefaults(), fromFile]) merge(config, layer);
  config.lang ??= uiLang();
  return config;
}

/**
 * One layer over the ones below. describe and model both say who describes, so a layer
 * that names one replaces the other from the layers below.
 */
function merge(config, layer) {
  if (layer.describe != null && layer.model == null) config.model = null;
  if (layer.model != null && layer.describe == null) config.describe = null;
  for (const [k, v] of Object.entries(layer)) if (v !== undefined) config[k] = v;
}

/** Defaults, then the user's config, then screendocs.config.json, then command line flags. */
export function loadConfig(url, flags) {
  const list = (v) => (v == null ? undefined : String(v).split(",").map((s) => s.trim()).filter(Boolean));
  const num = (v) => (v == null ? undefined : Number(v));
  const yes = (on, off) => (flags[off] ? false : flags[on] ? true : undefined);

  const fromFlags = {
    maxPages: num(flags["max-pages"]),
    depth: num(flags.depth),
    pages: list(flags.pages),
    exclude: list(flags.exclude),
    viewports: list(flags.viewports),
    video: yes("video", "no-video"),
    scrollSpeed: flags["scroll-speed"],
    scrollDelay: num(flags["scroll-delay"]),
    gif: yes("gif", "no-gif"),
    gifWidth: num(flags["gif-width"]),
    gifFps: num(flags["gif-fps"]),
    out: flags.out,
    mask: list(flags.mask),
    autoMask: yes("auto-mask", "no-auto-mask"),
    describe: flags.describe,
    docs: flags.docs,
    instructions: flags.instructions,
    model: flags.model,
    lang: flags.lang,
    headed: yes("headed", "no-headed"),
    keep: yes("keep", "no-keep"),
  };
  // One flag for an API: --model <provider/model>
  if (fromFlags.describe === "api") throw new Error("--describe api was replaced by --model <provider/model> (e.g. --model gemini/gemini-2.5-flash, --model ollama/llama3.2-vision)");
  if (fromFlags.model && fromFlags.describe && fromFlags.describe !== "none")
    throw new Error(`--model is for describing with an API, and --describe ${fromFlags.describe} uses the tool's own model. Drop one of the two.`);
  const config = baseConfig(flags);
  merge(config, fromFlags);
  config.url = url;
  // --describe none: no AI this time, even when the config names one
  if (config.describe === "none") Object.assign(config, { describe: null, model: null });
  if (config.describe === "api") throw new Error("\"describe\": \"api\" was replaced by \"model\": \"<provider/model>\"");
  if (config.model && config.describe)
    throw new Error(`the config has both "model" and "describe" (${config.describe}). Keep one of the two.`);
  if (config.model) config.describe = "api";

  scrollSpeed(config.scrollSpeed);
  if (!(config.scrollDelay >= 0)) throw new Error("--scroll-delay is a number of seconds, like 3");
  if (!(config.gifWidth >= 100)) throw new Error("--gif-width is a width in pixels, like 800");
  if (!(config.gifFps >= 1 && config.gifFps <= 25)) throw new Error("--gif-fps is a number from 1 to 25 (the video has 25)");
  // A GIF is made from the video: no video, no GIF
  if (!config.video) config.gif = false;

  const bad = config.viewports.filter((v) => !VIEWPORTS[v]);
  if (bad.length) throw new Error(`unknown viewport "${bad[0]}" (use desktop, mobile)`);
  return config;
}
