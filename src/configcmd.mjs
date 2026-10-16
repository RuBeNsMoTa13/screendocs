import fs from "node:fs";
import os from "node:os";
import * as p from "@clack/prompts";
import pc from "./theme.mjs";
import { tr, uiLang, setUiLang, systemLang, LANGUAGES } from "./i18n.mjs";
import { DEFAULTS } from "./config.mjs";
import { resolveModel } from "./providers.mjs";
import {
  USER_CONFIG,
  SETTINGS,
  readUserConfig,
  writeUserConfig,
  settingName,
  parseSetting,
  setSetting,
  unsetSetting,
  showValue,
} from "./userconfig.mjs";

/** What each setting is, in the CLI language. */
const LABELS = {
  en: {
    language: "Language of screendocs",
    lang: "Language of the descriptions",
    viewports: "Screens (desktop, mobile)",
    video: "Record videos",
    maxPages: "Pages to discover",
    depth: "Link depth",
    exclude: "Skip pages containing",
    autoMask: "Blur personal data",
    mask: "Other things to blur (CSS selectors)",
    out: "Output folder",
    keep: "Keep the previous capture",
    headed: "Show the browser",
    describe: "Who describes (AI tool or chat)",
    model: "API model (provider/model)",
    instructions: "What the descriptions focus on",
  },
  pt: {
    language: "Idioma do screendocs",
    lang: "Idioma das descrições",
    viewports: "Telas (desktop, mobile)",
    video: "Gravar vídeos",
    maxPages: "Páginas para encontrar",
    depth: "Profundidade dos links",
    exclude: "Pular páginas que contêm",
    autoMask: "Borrar dados pessoais",
    mask: "Outras coisas para borrar (seletores CSS)",
    out: "Pasta da captura",
    keep: "Guardar a captura anterior",
    headed: "Mostrar o navegador",
    describe: "Quem descreve (ferramenta de IA ou chat)",
    model: "Modelo de API (provedor/modelo)",
    instructions: "No que as descrições focam",
  },
  es: {
    language: "Idioma de screendocs",
    lang: "Idioma de las descripciones",
    viewports: "Pantallas (desktop, mobile)",
    video: "Grabar videos",
    maxPages: "Páginas a encontrar",
    depth: "Profundidad de enlaces",
    exclude: "Saltar páginas que contienen",
    autoMask: "Difuminar datos personales",
    mask: "Otras cosas para difuminar (selectores CSS)",
    out: "Carpeta de la captura",
    keep: "Guardar la captura anterior",
    headed: "Mostrar el navegador",
    describe: "Quién describe (herramienta de IA o chat)",
    model: "Modelo de API (proveedor/modelo)",
    instructions: "En qué se enfocan las descripciones",
  },
};

const T = {
  en: {
    title: "Your screendocs defaults",
    file: (f) => `Saved in ${f}. They apply wherever you run screendocs; screendocs.config.json in a folder and the options you type still win.`,
    pick: "What do you want to change?",
    done: "Done",
    resetAll: "Reset everything to the defaults",
    resetSure: "Erase every saved default (the language is asked again on the next run)?",
    reset: (f) => `Erased ${f}.`,
    nothing: "Nothing to erase: no defaults were saved.",
    def: (v) => `default: ${v}`,
    useDefault: "Use the default",
    none: "none",
    sameAsCli: "the language of screendocs",
    saved: (k, v) => `${k} = ${v}`,
    unset: (k) => `${k} is back to its default.`,
    yes: "Yes",
    no: "No",
    both: "Both",
    empty: "Enter with nothing typed goes back to the default",
    unknown: (k) => `"${k}" is not a setting. Settings: ${Object.keys(SETTINGS).join(", ")}`,
    use: "use: screendocs config [list | path | get <setting> | set <setting> <value> | unset <setting> | reset]",
    noneSaved: "No defaults saved yet: screendocs uses its own.",
    list: "Saved defaults:",
    langSaved: (l) => `screendocs will talk in ${l}. Change it any time: npx screendocs config`,
  },
  pt: {
    title: "Os seus padrões do screendocs",
    file: (f) => `Guardados em ${f}. Valem em qualquer pasta onde você rodar o screendocs; o screendocs.config.json de uma pasta e as opções digitadas no comando ainda ganham.`,
    pick: "O que você quer mudar?",
    done: "Pronto",
    resetAll: "Voltar tudo para o padrão",
    resetSure: "Apagar todos os padrões guardados (o idioma é perguntado de novo na próxima vez)?",
    reset: (f) => `Apaguei ${f}.`,
    nothing: "Nada para apagar: não havia padrões guardados.",
    def: (v) => `padrão: ${v}`,
    useDefault: "Usar o padrão",
    none: "nenhum",
    sameAsCli: "o idioma do screendocs",
    saved: (k, v) => `${k} = ${v}`,
    unset: (k) => `${k} voltou ao padrão.`,
    yes: "Sim",
    no: "Não",
    both: "Os dois",
    empty: "Enter sem digitar nada volta ao padrão",
    unknown: (k) => `"${k}" não é uma configuração. Configurações: ${Object.keys(SETTINGS).join(", ")}`,
    use: "use: screendocs config [list | path | get <configuração> | set <configuração> <valor> | unset <configuração> | reset]",
    noneSaved: "Nenhum padrão guardado ainda: o screendocs usa os dele.",
    list: "Padrões guardados:",
    langSaved: (l) => `O screendocs vai falar em ${l}. Mude quando quiser: npx screendocs config`,
  },
  es: {
    title: "Tus valores predeterminados de screendocs",
    file: (f) => `Guardados en ${f}. Valen en cualquier carpeta donde ejecutes screendocs; el screendocs.config.json de una carpeta y las opciones que escribas en el comando todavía ganan.`,
    pick: "¿Qué quieres cambiar?",
    done: "Listo",
    resetAll: "Volver todo a los valores predeterminados",
    resetSure: "¿Borrar todos los valores guardados (el idioma se pregunta de nuevo la próxima vez)?",
    reset: (f) => `Borré ${f}.`,
    nothing: "Nada que borrar: no había valores guardados.",
    def: (v) => `predeterminado: ${v}`,
    useDefault: "Usar el predeterminado",
    none: "ninguno",
    sameAsCli: "el idioma de screendocs",
    saved: (k, v) => `${k} = ${v}`,
    unset: (k) => `${k} volvió a su valor predeterminado.`,
    yes: "Sí",
    no: "No",
    both: "Las dos",
    empty: "Enter sin escribir nada vuelve al predeterminado",
    unknown: (k) => `"${k}" no es una configuración. Configuraciones: ${Object.keys(SETTINGS).join(", ")}`,
    use: "uso: screendocs config [list | path | get <configuración> | set <configuración> <valor> | unset <configuración> | reset]",
    noneSaved: "Todavía no hay valores guardados: screendocs usa los suyos.",
    list: "Valores guardados:",
    langSaved: (l) => `screendocs hablará en ${l}. Cámbialo cuando quieras: npx screendocs config`,
  },
};

const shortHome = (f) => f.replace(os.homedir(), "~");

/**
 * The first run in a terminal: which language screendocs talks in. The computer's language
 * comes selected; the answer is saved in the user's config.
 */
export async function askLanguage() {
  const v = await p.select({
    message: "Language · Idioma",
    initialValue: systemLang(),
    options: Object.entries(LANGUAGES).map(([value, label]) => ({ value, label })),
  });
  if (p.isCancel(v)) process.exit(0);
  setSetting("language", v);
  setUiLang(v);
  p.log.info(pc.dim(tr(T).langSaved(LANGUAGES[v])));
}

/** screendocs config [list | path | get | set | unset | reset]: the user's own defaults. */
export async function configCommand(action, args) {
  const t = tr(T);
  if (!action) return process.stdin.isTTY && process.stdout.isTTY ? editor() : list();
  if (action === "list" || action === "show") return list();
  if (action === "path") return console.log(USER_CONFIG);
  if (action === "reset") {
    if (!fs.existsSync(USER_CONFIG)) return console.log(t.nothing);
    fs.rmSync(USER_CONFIG);
    return console.log(t.reset(USER_CONFIG));
  }
  if (!["get", "set", "unset"].includes(action)) throw new Error(t.use);
  const key = settingName(args[0]);
  if (!key) throw new Error(args[0] ? t.unknown(args[0]) : t.use);
  if (action === "get") {
    const v = readUserConfig()[key];
    return console.log(v === undefined ? t.def(defaultOf(key)) : showValue(v));
  }
  if (action === "unset") {
    unsetSetting(key);
    return console.log(t.unset(key));
  }
  if (args.length < 2) throw new Error(t.use);
  const value = check(key, parseSetting(key, args.slice(1).join(" "), uiLang()));
  setSetting(key, value);
  console.log(t.saved(key, showValue(value)));
}

/** describe and model are checked beyond their type: the same checks a run makes. */
function check(key, value) {
  if (key === "model") resolveModel(value);
  return value;
}

/** The value screendocs uses when the setting is not saved, as text. */
function defaultOf(key) {
  const t = tr(T);
  if (key === "language") return LANGUAGES[systemLang()];
  if (key === "lang") return t.sameAsCli;
  const v = DEFAULTS[key];
  if (v === null || v === undefined || (Array.isArray(v) && !v.length)) return t.none;
  if (typeof v === "boolean") return v ? t.yes : t.no;
  return showValue(v);
}

function list() {
  const t = tr(T);
  const saved = readUserConfig();
  const keys = Object.keys(saved).filter((k) => SETTINGS[k]);
  console.log(USER_CONFIG);
  if (!keys.length) return console.log(t.noneSaved);
  console.log(t.list);
  for (const k of keys) console.log(`  ${k.padEnd(13)} ${showValue(saved[k])}  ${pc.dim(tr(LABELS)[k])}`);
}

/** The menu of "screendocs config": pick a setting, change it, repeat until Done. */
async function editor() {
  let t = tr(T);
  p.intro(pc.bold(t.title));
  p.log.info(pc.dim(t.file(shortHome(USER_CONFIG))));
  let last;
  for (;;) {
    t = tr(T);
    const labels = tr(LABELS);
    const saved = readUserConfig();
    const show = (k) => {
      const v = saved[k];
      if (v === undefined) return pc.dim(t.def(defaultOf(k)));
      if (k === "language") return LANGUAGES[v] ?? v;
      return typeof v === "boolean" ? (v ? t.yes : t.no) : showValue(v);
    };
    const key = await p.select({
      message: t.pick,
      initialValue: last,
      maxItems: 18,
      options: [
        ...Object.keys(SETTINGS).map((k) => ({ value: k, label: `${labels[k]}  ${pc.dim("·")} ${show(k)}`, hint: k })),
        { value: "__reset", label: t.resetAll },
        { value: "__done", label: t.done },
      ],
    });
    if (p.isCancel(key) || key === "__done") break;
    last = key;
    if (key === "__reset") {
      const sure = await p.confirm({ message: t.resetSure, active: t.yes, inactive: t.no, initialValue: false });
      if (sure === true) {
        writeUserConfig({});
        p.log.success(t.reset(shortHome(USER_CONFIG)));
      }
      continue;
    }
    const value = await askValue(key, saved[key], t, labels[key]);
    if (value === CANCEL) continue;
    if (value === undefined) {
      unsetSetting(key);
      p.log.success(t.unset(key));
    } else {
      setSetting(key, value);
      if (key === "language") setUiLang(value);
      p.log.success(tr(T).saved(key, key === "language" ? LANGUAGES[value] : showValue(value)));
    }
  }
  p.outro(shortHome(USER_CONFIG));
}

const CANCEL = Symbol("cancel");
const DEFAULT = "__default";

/** Asks for one setting. undefined: back to the default; CANCEL: leave it as it is. */
async function askValue(key, current, t, label) {
  const s = SETTINGS[key];
  const useDefault = { value: DEFAULT, label: t.useDefault, hint: defaultOf(key) };
  const pick = async (options, initialValue) => {
    const v = await p.select({ message: label, initialValue: initialValue ?? DEFAULT, options: [...options, useDefault] });
    if (p.isCancel(v)) return CANCEL;
    return v === DEFAULT ? undefined : v;
  };
  if (key === "language") return pick(Object.entries(LANGUAGES).map(([value, l]) => ({ value, label: l })), current);
  if (key === "lang") {
    const own = current && !["pt", "en", "es"].includes(current) ? [{ value: current, label: current }] : [];
    return pick([{ value: "pt", label: "Português" }, { value: "en", label: "English" }, { value: "es", label: "Español" }, ...own], current);
  }
  if (s.type === "bool") return pick([{ value: true, label: t.yes }, { value: false, label: t.no }], current);
  if (key === "viewports") {
    const v = await pick(
      [
        { value: "desktop,mobile", label: t.both },
        { value: "desktop", label: "Desktop" },
        { value: "mobile", label: "Mobile" },
      ],
      current && showValue(current),
    );
    return typeof v === "string" ? v.split(",") : v;
  }
  if (s.type === "enum") return pick(s.values.map((v) => ({ value: v, label: v })), current);
  const v = await p.text({
    message: `${label}\n${pc.dim(t.empty)}`,
    initialValue: current === undefined ? "" : showValue(current),
    placeholder: defaultOf(key),
    validate: (x) => {
      if (!String(x ?? "").trim()) return undefined;
      try {
        check(key, parseSetting(key, x, uiLang()));
      } catch (e) {
        return e.message;
      }
    },
  });
  if (p.isCancel(v)) return CANCEL;
  if (!String(v ?? "").trim()) return undefined;
  return check(key, parseSetting(key, v, uiLang()));
}
