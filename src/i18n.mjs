import { readUserConfig, LANGUAGES } from "./userconfig.mjs";

/** pt, es or en from a code like "pt-BR", "es_AR.UTF-8" or "English". null when it is none of them. */
export function pickLang(code) {
  const c = String(code ?? "").trim().toLowerCase();
  if (!c) return null;
  if (/^pt|portugu/.test(c)) return "pt";
  if (/^es|espa|spanish/.test(c)) return "es";
  if (/^en/.test(c)) return "en";
  return null;
}

/** The language of the computer, English when it is none of the three. */
export function systemLang() {
  const loc = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || Intl.DateTimeFormat().resolvedOptions().locale || "";
  return pickLang(loc) ?? "en";
}

let current;

/**
 * The language the CLI talks in: SCREENDOCS_LANGUAGE, else the one saved in the user's
 * config (asked on the first run), else the computer's.
 */
export function uiLang() {
  if (current) return current;
  let saved;
  try {
    saved = readUserConfig().language;
  } catch {}
  return (current = pickLang(process.env.SCREENDOCS_LANGUAGE) ?? pickLang(saved) ?? systemLang());
}

export function setUiLang(lang) {
  current = pickLang(lang) ?? current;
}

/** True when the language was never chosen: the first run asks for it. */
export function languageChosen() {
  if (pickLang(process.env.SCREENDOCS_LANGUAGE)) return true;
  try {
    return !!pickLang(readUserConfig().language);
  } catch {
    return true;
  }
}

/** The text of a { en, pt, es } table in the CLI language (English when one is missing). */
export const tr = (table) => table[uiLang()] ?? table.en;

export { LANGUAGES };
