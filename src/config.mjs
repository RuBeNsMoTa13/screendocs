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

  const bad = config.viewports.filter((v) => !VIEWPORTS[v]);
  if (bad.length) throw new Error(`unknown viewport "${bad[0]}" (use desktop, mobile)`);
  return config;
}
