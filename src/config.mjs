import fs from "node:fs";

const DEFAULTS = {
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
  lang: "en",
  headed: false,
  keep: false,
  maxSectionsPerPage: 10,
};

export const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};

/** Defaults, then screendocs.config.json, then command line flags. */
export function loadConfig(url, flags) {
  const file = flags.config ?? (fs.existsSync("screendocs.config.json") ? "screendocs.config.json" : null);
  const fromFile = file ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const list = (v) => (v == null ? undefined : String(v).split(",").map((s) => s.trim()).filter(Boolean));
  const num = (v) => (v == null ? undefined : Number(v));

  const fromFlags = {
    maxPages: num(flags["max-pages"]),
    depth: num(flags.depth),
    pages: list(flags.pages),
    exclude: list(flags.exclude),
    viewports: list(flags.viewports),
    video: flags["no-video"] ? false : flags.video,
    out: flags.out,
    mask: list(flags.mask),
    autoMask: flags["no-auto-mask"] ? false : undefined,
    describe: flags.describe,
    docs: flags.docs,
    instructions: flags.instructions,
    model: flags.model,
    lang: flags.lang,
    headed: flags.headed,
    keep: flags.keep,
  };
  const config = { ...DEFAULTS, ...fromFile, url };
  for (const [k, v] of Object.entries(fromFlags)) if (v !== undefined) config[k] = v;

  // One flag for an API: --model <provider/model>
  if (config.describe === "api") throw new Error("--describe api was replaced by --model <provider/model> (e.g. --model gemini/gemini-2.5-flash, --model ollama/llama3.2-vision)");
  if (config.model && config.describe)
    throw new Error(`--model is for describing with an API, and --describe ${config.describe} uses the tool's own model. Drop one of the two.`);
  if (config.model) config.describe = "api";

  const bad = config.viewports.filter((v) => !VIEWPORTS[v]);
  if (bad.length) throw new Error(`unknown viewport "${bad[0]}" (use desktop, mobile)`);
  return config;
}
