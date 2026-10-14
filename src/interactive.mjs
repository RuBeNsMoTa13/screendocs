import fs from "node:fs";
import path from "node:path";
import pc, { crimson, bgCrimson } from "./theme.mjs";
import * as p from "@clack/prompts";
import { login } from "./login.mjs";
import { authFile } from "./paths.mjs";
import { launch } from "./browser.mjs";
import { sessionStatus } from "./session.mjs";
import { AGENTS, PROVIDERS, installedAgents } from "./agents.mjs";
import { checkUrl, EXAMPLES, URL_TEXT, short } from "./checkurl.mjs";

const BIG = String.raw`
███████╗ ██████╗██████╗ ███████╗███████╗███╗   ██╗██████╗  ██████╗  ██████╗███████╗
██╔════╝██╔════╝██╔══██╗██╔════╝██╔════╝████╗  ██║██╔══██╗██╔═══██╗██╔════╝██╔════╝
███████╗██║     ██████╔╝█████╗  █████╗  ██╔██╗ ██║██║  ██║██║   ██║██║     ███████╗
╚════██║██║     ██╔══██╗██╔══╝  ██╔══╝  ██║╚██╗██║██║  ██║██║   ██║██║     ╚════██║
███████║╚██████╗██║  ██║███████╗███████╗██║ ╚████║██████╔╝╚██████╔╝╚██████╗███████║
╚══════╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═══╝╚═════╝  ╚═════╝  ╚═════╝╚══════╝`;

const SMALL = String.raw`
  ____                           ____
 / ___|  ___ _ __ ___  ___ _ __ |  _ \  ___   ___ ___
 \___ \ / __| '__/ _ \/ _ \ '_ \| | | |/ _ \ / __/ __|
  ___) | (__| | |  __/  __/ | | | |_| | (_) | (__\__ \
 |____/ \___|_|  \___|\___|_| |_|____/ \___/ \___|___/`;

const T = {
  en: {
    tagline: "screenshots, videos and docs of every screen of a website",
    by: "by",
    url: "Which site do you want to document?",
    urlBad: "Type a web address, like mysite.com",
    savedLogin: (h) => `Using the saved login for ${h}.`,
    checking: "Checking the saved login...",
    expired: (h, u) => `The saved login for ${h} has expired (${u} sent you to another page).`,
    relogin: "Log in again now?",
    unchecked: (h) => `Using the saved login for ${h}. Log in again with this version so screendocs can warn you when it expires.`,
    hasLogin: "Does the site have pages behind a login?",
    loginNow: "A browser window will open. Log in, then come back here and press Enter.",
    viewports: "Which screens?",
    desktop: "Desktop", mobile: "Mobile", both: "Both",
    video: "Record a video scrolling each page?",
    mode: "Which pages?",
    discover: "Find them by following the links", discoverHint: "recommended",
    list: "Only the paths I type",
    maxPages: "Up to how many pages?",
    paths: "Paths, separated by commas",
    exclude: "Skip pages whose address contains (e.g. /admin, /checkout; Enter for none)",
    mask: "Blur emails, phones, CPF/CNPJ and filled form fields?",
    describe: "Who writes the descriptions of the screens?",
    yourPlan: "uses your plan, no API key",
    chat: "A chat in your browser (ChatGPT, Gemini, Claude.ai...)",
    chatHint: "step by step, no key",
    later: "Nobody now",
    laterHint: "later: npx screendocs describe <site>",
    api: "An API (your key)",
    provider: "Which provider?",
    other: "Other (type the address)",
    apiUrl: "API address (OpenAI-compatible)",
    model: "Model (one that reads images)",
    modelHint: "e.g. gpt-4o-mini, gemini-2.5-flash, llama3.2-vision",
    apiKey: "API key (not saved and not shown; next time set SCREENDOCS_API_KEY)",
    noKey: "Descriptions will use each section's title and first paragraph. To have an AI write them later: npx screendocs describe <site>",
    lang: "Description language",
    previous: (h) => `There is already a capture of ${h}. What should happen to it?`,
    replace: "Replace it", keepOld: "Keep it (renamed with its date)",
    advanced: "Change advanced options? (link depth, output folder, extra blurring...)",
    depth: "How many clicks away from the start page to look for pages?",
    maskSel: "Other things to blur (CSS selectors, e.g. .customer-name, #balance)",
    out: "Output folder",
    headed: "Show the browser while capturing?",
    docs: "Folder with the project's docs for the AI to read (e.g. ./docs)",
    usingConfig: (f) => `Also using the options in ${f}.`,
    start: "Start the capture?",
    command: "Same thing next time, without the questions",
    cancel: "Cancelled.",
    yes: "Yes", no: "No", none: "none",
    number: "Type a number",
  },
  pt: {
    tagline: "fotos, vídeos e documentação de todas as telas de um site",
    by: "por",
    url: "Qual site você quer documentar?",
    urlBad: "Digite um endereço, como meusite.com.br",
    savedLogin: (h) => `Usando o login salvo de ${h}.`,
    checking: "Conferindo o login salvo...",
    expired: (h, u) => `O login salvo de ${h} expirou (${u} mandou para outra página).`,
    relogin: "Fazer login de novo agora?",
    unchecked: (h) => `Usando o login salvo de ${h}. Faça login de novo com esta versão para o screendocs avisar quando expirar.`,
    hasLogin: "O site tem páginas que exigem login?",
    loginNow: "Vai abrir uma janela do navegador. Faça login, volte aqui e aperte Enter.",
    viewports: "Quais telas?",
    desktop: "Computador", mobile: "Celular", both: "Os dois",
    video: "Gravar um vídeo rolando cada página?",
    mode: "Quais páginas?",
    discover: "Encontrar seguindo os links", discoverHint: "recomendado",
    list: "Só os caminhos que eu digitar",
    maxPages: "No máximo quantas páginas?",
    paths: "Caminhos, separados por vírgula",
    exclude: "Pular páginas cujo endereço contém (ex.: /admin, /checkout; Enter para nenhuma)",
    mask: "Borrar e-mails, telefones, CPF/CNPJ e campos preenchidos?",
    describe: "Quem escreve as descrições das telas?",
    yourPlan: "usa o seu plano, sem chave de API",
    chat: "Um chat no navegador (ChatGPT, Gemini, Claude.ai...)",
    chatHint: "passo a passo, sem chave",
    later: "Ninguém agora",
    laterHint: "depois: npx screendocs describe <site>",
    api: "Uma API (com a sua chave)",
    provider: "Qual provedor?",
    other: "Outro (digitar o endereço)",
    apiUrl: "Endereço da API (compatível com OpenAI)",
    model: "Modelo (que leia imagens)",
    modelHint: "ex.: gpt-4o-mini, gemini-2.5-flash, llama3.2-vision",
    apiKey: "Chave da API (não é salva nem mostrada; da próxima vez defina SCREENDOCS_API_KEY)",
    noKey: "As descrições vão usar o título e o primeiro parágrafo de cada seção. Para uma IA escrever depois: npx screendocs describe <site>",
    lang: "Idioma das descrições",
    previous: (h) => `Já existe uma captura de ${h}. O que fazer com ela?`,
    replace: "Substituir", keepOld: "Guardar (renomeada com a data)",
    advanced: "Mudar as opções avançadas? (profundidade dos links, pasta de saída, borrar mais coisas...)",
    depth: "A quantos cliques da página inicial procurar páginas?",
    maskSel: "Outras coisas para borrar (seletores CSS, ex.: .nome-cliente, #saldo)",
    out: "Pasta de saída",
    headed: "Mostrar o navegador durante a captura?",
    docs: "Pasta com a documentação do projeto para a IA ler (ex.: ./docs)",
    usingConfig: (f) => `Usando também as opções de ${f}.`,
    start: "Começar a captura?",
    command: "Para repetir sem as perguntas",
    cancel: "Cancelado.",
    yes: "Sim", no: "Não", none: "nenhuma",
    number: "Digite um número",
  },
};

const AUTHOR = {
  name: "Rubens Mota",
  github: "https://github.com/RuBeNsMoTa13",
  portfolio: "",
};

export function uiLang() {
  const loc = process.env.LC_ALL || process.env.LANG || Intl.DateTimeFormat().resolvedOptions().locale || "";
  return /^pt/i.test(loc) ? "pt" : "en";
}

export function banner(t = T[uiLang()]) {
  const art = (process.stdout.columns ?? 80) >= 86 ? BIG : SMALL;
  console.log(crimson(art));
  console.log(pc.dim(`  ${t.tagline}`));
  const links = [AUTHOR.github, AUTHOR.portfolio].filter(Boolean).map((l) => crimson(l));
  console.log(`  ${pc.dim(t.by)} ${pc.bold(AUTHOR.name)}  ${links.join(pc.dim("  ·  "))}\n`);
}

/** Stops cleanly when the user presses Ctrl+C or Esc on any question. */
function ask(t) {
  return async (prompt) => {
    const v = await prompt;
    if (p.isCancel(v)) {
      p.cancel(t.cancel);
      process.exit(0);
    }
    return v;
  };
}

/**
 * The menu shown when screendocs runs with no arguments. Asks for the site and the
 * options, logs in if needed, and returns the same arguments the command line takes.
 */
export async function interactive() {
  const lang = uiLang();
  const t = T[lang];
  const a = ask(t);
  const yesNo = (o) => p.confirm({ active: t.yes, inactive: t.no, ...o });
  banner(t);
  p.intro(pc.bold(bgCrimson(pc.white(" ScreenDocs "))));

  const url = await askUrl(t, a, lang);
  const host = new URL(url).host;

  if (fs.existsSync(authFile(host))) {
    const spin = p.spinner();
    spin.start(t.checking);
    const browser = await launch();
    const s = await sessionStatus(browser, host).finally(() => browser.close());
    if (s.state === "expired") {
      spin.stop(pc.yellow(t.expired(host, new URL(s.checkUrl).pathname)));
      if (await a(yesNo({ message: t.relogin, initialValue: true }))) {
        p.log.step(t.loginNow);
        await login(url);
      }
    } else {
      spin.stop(s.state === "ok" ? t.savedLogin(host) : t.unchecked(host));
    }
  } else if (await a(yesNo({ message: t.hasLogin, initialValue: false }))) {
    p.log.step(t.loginNow);
    await login(url);
  }

  const viewports = await a(p.select({
    message: t.viewports,
    options: [
      { value: "both", label: t.both },
      { value: "desktop", label: t.desktop },
      { value: "mobile", label: t.mobile },
    ],
  }));
  const video = await a(yesNo({ message: t.video, initialValue: true }));

  const args = [url];
  if (viewports !== "both") args.push("--viewports", viewports);
  if (!video) args.push("--no-video");

  const mode = await a(p.select({
    message: t.mode,
    options: [
      { value: "discover", label: t.discover, hint: t.discoverHint },
      { value: "list", label: t.list },
    ],
  }));
  if (mode === "discover") {
    const max = await a(p.text({
      message: t.maxPages,
      initialValue: "20",
      validate: (v) => (/^\d+$/.test((v ?? "").trim()) && Number(v) > 0 ? undefined : t.number),
    }));
    if (max.trim() !== "20") args.push("--max-pages", max.trim());
    const skip = await a(p.text({ message: t.exclude, placeholder: t.none }));
    const list = (skip ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length) args.push("--exclude", list.join(","));
  } else {
    const paths = await a(p.text({ message: t.paths, placeholder: "/, /about, /pricing", validate: (v) => ((v ?? "").trim() ? undefined : t.paths) }));
    args.push("--pages", paths.split(",").map((s) => s.trim()).filter(Boolean).join(","));
  }

  if (!(await a(yesNo({ message: t.mask, initialValue: true })))) args.push("--no-auto-mask");

  const how = await chooseDescriber({ t, a, later: true });
  const describing = how.describe && how.describe !== "chat";
  if (how.describe) {
    args.push("--describe", how.describe);
    if (how.describe === "api") args.push("--api-url", how.apiUrl, "--model", how.model);
  } else {
    p.log.info(pc.dim(t.noKey));
  }
  // The language the AI writes the descriptions in
  const descLang = await a(p.select({
    message: t.lang,
    initialValue: lang,
    options: [{ value: "pt", label: "Português" }, { value: "en", label: "English" }, { value: "es", label: "Español" }],
  }));
  if (descLang !== "en") args.push("--lang", descLang);

  let outDir = "screendocs-output";
  if (await a(yesNo({ message: t.advanced, initialValue: false }))) {
    const isNum = (v) => (/^\d+$/.test((v ?? "").trim()) ? undefined : t.number);
    if (mode === "discover") {
      const depth = await a(p.text({ message: t.depth, initialValue: "3", validate: isNum }));
      if (depth.trim() !== "3") args.push("--depth", depth.trim());
    }
    const sel = await a(p.text({ message: t.maskSel, placeholder: t.none }));
    if (sel?.trim()) args.push("--mask", sel.trim());
    const out = await a(p.text({ message: t.out, initialValue: outDir, validate: (v) => ((v ?? "").trim() ? undefined : t.out) }));
    outDir = out.trim();
    if (outDir !== "screendocs-output") args.push("--out", outDir);
    if (await a(yesNo({ message: t.headed, initialValue: false }))) args.push("--headed");
    if (describing) {
      const docs = await a(p.text({ message: t.docs, placeholder: t.none }));
      if (docs?.trim()) args.push("--docs", docs.trim());
    }
  }
  if (fs.existsSync("screendocs.config.json")) p.log.info(t.usingConfig("screendocs.config.json"));

  if (fs.existsSync(path.join(outDir, host.replace(/[^a-z0-9.-]/gi, "_")))) {
    const keep = await a(p.select({
      message: t.previous(host),
      options: [{ value: true, label: t.keepOld }, { value: false, label: t.replace }],
    }));
    if (keep) args.push("--keep");
  }

  p.note(`npx screendocs ${args.map(quote).join(" ")}`, t.command);
  if (!(await a(yesNo({ message: t.start, initialValue: true })))) {
    p.cancel(t.cancel);
    process.exit(0);
  }
  p.outro("ScreenDocs");
  return [...args, "--open"];
}

/**
 * "Who writes the descriptions?": an AI tool installed here, an API, an AI chat in the
 * browser (guided) or, in the capture menu, nobody for now. Also used by "screendocs describe".
 */
export async function chooseDescriber({ t = T[uiLang()], a = ask(t), later = false } = {}) {
  const agents = installedAgents();
  const tool = await a(p.select({
    message: t.describe,
    options: [
      ...agents.map((k) => ({ value: k, label: AGENTS[k].name, hint: t.yourPlan })),
      { value: "api", label: t.api, hint: "OpenAI, Gemini, OpenRouter, Anthropic, Ollama..." },
      { value: "chat", label: t.chat, hint: t.chatHint },
      ...(later ? [{ value: "", label: t.later, hint: t.laterHint }] : []),
    ],
  }));
  if (tool !== "api") return { describe: tool };
  const url = await a(p.select({
    message: t.provider,
    options: [...PROVIDERS.map((pr) => ({ value: pr.url, label: pr.name, hint: pr.url })), { value: "", label: t.other }],
  }));
  const apiUrl = url || (await a(p.text({ message: t.apiUrl, placeholder: "https://.../v1", validate: (v) => ((v ?? "").trim() ? undefined : t.apiUrl) }))).trim();
  const model = (await a(p.text({ message: t.model, placeholder: t.modelHint, validate: (v) => ((v ?? "").trim() ? undefined : t.model) }))).trim();
  const local = PROVIDERS.find((pr) => pr.url === apiUrl)?.local;
  if (!local && !process.env.SCREENDOCS_API_KEY) {
    // Kept out of the arguments so it never shows in a printed command
    const key = await a(p.password({ message: t.apiKey, validate: (v) => ((v ?? "").trim() ? undefined : t.apiKey) }));
    process.env.SCREENDOCS_API_KEY = key.trim();
  }
  return { describe: "api", apiUrl, model };
}

/**
 * Asks for the site and checks that it opens. When it does not, offers the close
 * addresses that do (missing www, missing .br, a typo) and shows examples.
 */
async function askUrl(t, a, lang) {
  const u = URL_TEXT[lang];
  let typed = "";
  for (;;) {
    typed = await a(p.text({
      message: t.url,
      placeholder: "https://",
      initialValue: typed,
      validate: (v) => (toUrl(v) ? undefined : t.urlBad),
    }));
    const url = toUrl(typed);
    const spin = p.spinner();
    spin.start(u.checking);
    const r = await checkUrl(url);
    if (r.ok) {
      const to = new URL(r.final).host;
      spin.stop(to === new URL(url).host ? u.ok(short(url)) : u.moved(short(url), to));
      return url;
    }
    spin.stop(pc.yellow(u.fail(short(url), r.reason)));
    if (!r.suggestions.length) p.log.message(`${u.noneFound}\n${EXAMPLES[lang].map((e) => `  ${e}`).join("\n")}`);
    const choice = await a(p.select({
      message: r.suggestions.length ? u.pick : u.retype + "?",
      options: [
        ...r.suggestions.map((s) => ({ value: s, label: s.replace(/^https:\/\//, "").replace(/\/$/, "") })),
        { value: "retype", label: u.retype },
        { value: "anyway", label: u.anyway },
      ],
    }));
    if (choice === "anyway") return url;
    if (choice !== "retype") return choice;
  }
}

function toUrl(v) {
  const s = String(v ?? "").trim();
  if (!s || /\s/.test(s)) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    // A single word (radiobraba) passes too: the check suggests the ending
    return u.hostname.includes(".") || /^[a-z0-9-]+$/i.test(u.hostname) ? u.href : null;
  } catch {
    return null;
  }
}

function quote(s) {
  return /^[\w./:,@=-]+$/.test(s) ? s : `"${s}"`;
}
