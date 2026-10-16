import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * The person's own settings, for everyone who runs screendocs from npm: the files inside
 * the package cannot be changed, and screendocs.config.json only counts in its folder.
 * ~/.screendocs/ is outside any project, so it never goes to Git and survives updates.
 * SCREENDOCS_HOME points it somewhere else.
 */
export const USER_DIR = process.env.SCREENDOCS_HOME || path.join(os.homedir(), ".screendocs");
export const USER_CONFIG = path.join(USER_DIR, "config.json");

/** The CLI languages. */
export const LANGUAGES = { en: "English", pt: "Português", es: "Español" };

/**
 * What can be kept in the user's config, with the type of each value. The same names as
 * screendocs.config.json, plus language (the language of the CLI itself).
 */
export const SETTINGS = {
  language: { type: "enum", values: Object.keys(LANGUAGES) },
  lang: { type: "string" },
  viewports: { type: "list", values: ["desktop", "mobile"] },
  video: { type: "bool" },
  maxPages: { type: "number" },
  depth: { type: "number" },
  exclude: { type: "list" },
  autoMask: { type: "bool" },
  mask: { type: "list" },
  out: { type: "string" },
  keep: { type: "bool" },
  headed: { type: "bool" },
  describe: { type: "enum", values: ["claude", "codex", "antigravity", "chat"] },
  model: { type: "string" },
  instructions: { type: "string" },
};

let cache;

/** The saved settings, {} when there are none yet. */
export function readUserConfig() {
  if (cache) return cache;
  if (!fs.existsSync(USER_CONFIG)) return (cache = {});
  try {
    const v = JSON.parse(fs.readFileSync(USER_CONFIG, "utf8"));
    return (cache = v && typeof v === "object" && !Array.isArray(v) ? v : {});
  } catch (e) {
    throw new Error(`${USER_CONFIG} is not valid JSON (${e.message}). Fix it, or start over with: npx screendocs config reset`);
  }
}

export function writeUserConfig(values) {
  fs.mkdirSync(USER_DIR, { recursive: true });
  const clean = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined && v !== null));
  fs.writeFileSync(USER_CONFIG, JSON.stringify(clean, null, 2) + "\n");
  cache = clean;
}

/** max-pages, maxpages and maxPages are the same setting. null when it is not one. */
export function settingName(name) {
  const camel = String(name ?? "").trim().replace(/^--/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  return Object.keys(SETTINGS).find((k) => k.toLowerCase() === camel.toLowerCase()) ?? null;
}

const TRUE = ["true", "yes", "y", "on", "1", "sim", "s", "si", "sí"];
const FALSE = ["false", "no", "n", "off", "0", "não", "nao"];

const ERR = {
  en: {
    bool: (k) => `${k} is true or false`,
    number: (k) => `${k} is a whole number, like 20`,
    item: (k, x, list) => `${k}: "${x}" is not one of ${list}`,
    oneOf: (k, list) => `${k} is one of ${list}`,
    empty: (k) => `${k} needs a value`,
  },
  pt: {
    bool: (k) => `${k} é true ou false (sim ou não)`,
    number: (k) => `${k} é um número inteiro, como 20`,
    item: (k, x, list) => `${k}: "${x}" não é um de ${list}`,
    oneOf: (k, list) => `${k} é um de ${list}`,
    empty: (k) => `${k} precisa de um valor`,
  },
  es: {
    bool: (k) => `${k} es true o false (sí o no)`,
    number: (k) => `${k} es un número entero, como 20`,
    item: (k, x, list) => `${k}: "${x}" no es uno de ${list}`,
    oneOf: (k, list) => `${k} es uno de ${list}`,
    empty: (k) => `${k} necesita un valor`,
  },
};

/** The typed text as the setting's value, or an Error saying what it accepts. */
export function parseSetting(key, text, lang = "en") {
  const e = ERR[lang] ?? ERR.en;
  const s = SETTINGS[key];
  const raw = String(text ?? "").trim();
  if (s.type === "bool") {
    if (TRUE.includes(raw.toLowerCase())) return true;
    if (FALSE.includes(raw.toLowerCase())) return false;
    throw new Error(e.bool(key));
  }
  if (s.type === "number") {
    if (!/^\d+$/.test(raw) || Number(raw) < 1) throw new Error(e.number(key));
    return Number(raw);
  }
  if (s.type === "list") {
    const list = raw.split(",").map((x) => x.trim()).filter(Boolean);
    const bad = s.values && list.find((x) => !s.values.includes(x));
    if (bad) throw new Error(e.item(key, bad, s.values.join(", ")));
    if (s.values && !list.length) throw new Error(e.oneOf(key, s.values.join(", ")));
    return list;
  }
  if (s.type === "enum") {
    const v = raw.toLowerCase();
    if (!s.values.includes(v)) throw new Error(e.oneOf(key, s.values.join(", ")));
    return v;
  }
  if (!raw) throw new Error(e.empty(key));
  return raw;
}

/** Saves one setting. describe and model replace each other: only one says who describes. */
export function setSetting(key, value) {
  const next = { ...readUserConfig(), [key]: value };
  if (key === "describe") delete next.model;
  if (key === "model") delete next.describe;
  writeUserConfig(next);
}

export function unsetSetting(key) {
  const next = { ...readUserConfig() };
  delete next[key];
  writeUserConfig(next);
}

/** A value as it is typed: lists with commas. */
export const showValue = (v) => (Array.isArray(v) ? v.join(",") : String(v));
