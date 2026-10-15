import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import pc, { crimson, bgCrimson } from "./theme.mjs";
import * as p from "@clack/prompts";
import { login } from "./login.mjs";
import { authFile } from "./paths.mjs";
import { launch } from "./browser.mjs";
import { sessionStatus } from "./session.mjs";
import { AGENTS, PROVIDERS, installedAgents, installCommand, installAgent } from "./agents.mjs";
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
    url: "Which site do you want to document? (e.g. mysite.com, www.mysite.com.br, app.mysite.io/login)",
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
    notInstalled: "not installed here, I can install it",
    installWhat: (n, c) => `${n} is not installed on this computer. Its official installer is:\n  ${c}`,
    installNow: (n) => `Install ${n} now?`,
    installed: (n) => `${n} installed.`,
    installFailed: (n, c) => `${n} did not install, or this terminal cannot see it yet. Close and reopen the terminal and run screendocs again, or install it yourself with:\n  ${c}`,
    agentLogin: (n, c) => `Now log in to ${n}: open another terminal, run ${c}, sign in with your account and come back.`,
    loggedIn: "Done, I am logged in",
    chat: "A chat in your browser (ChatGPT, Gemini, Claude.ai...)",
    chatHint: "step by step, no key",
    later: "Just the page scan for now",
    laterHint: "an AI can describe later: npx screendocs describe <site>",
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
    keys: "Esc goes back to the previous question · Ctrl+C quits",
    yes: "Yes", no: "No", none: "none",
    number: "Type a number",
  },
  pt: {
    tagline: "fotos, vídeos e documentação de todas as telas de um site",
    by: "por",
    url: "Qual site você quer documentar? (ex.: meusite.com.br, www.meusite.com, app.meusite.io/login)",
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
    notInstalled: "não instalado aqui, posso instalar",
    installWhat: (n, c) => `O ${n} não está instalado neste computador. O instalador oficial é:\n  ${c}`,
    installNow: (n) => `Instalar o ${n} agora?`,
    installed: (n) => `${n} instalado.`,
    installFailed: (n, c) => `O ${n} não instalou, ou este terminal ainda não enxerga ele. Feche e abra o terminal e rode o screendocs de novo, ou instale você mesmo com:\n  ${c}`,
    agentLogin: (n, c) => `Agora faça login no ${n}: abra outro terminal, rode ${c}, entre com a sua conta e volte aqui.`,
    loggedIn: "Pronto, fiz login",
    chat: "Um chat no navegador (ChatGPT, Gemini, Claude.ai...)",
    chatHint: "passo a passo, sem chave",
    later: "Por enquanto, só o scan da página",
    laterHint: "uma IA pode descrever depois: npx screendocs describe <site>",
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
    keys: "Esc volta para a pergunta anterior · Ctrl+C sai",
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

/** Thrown by a question when the person presses Esc: go back to the previous one. */
const BACK = Symbol("back");
let lastKey;
/** For .catch(): Esc inside a step gives `value` instead of leaving the step. */
const back = (value) => (e) => {
  if (e !== BACK) throw e;
  return value;
};

/**
 * Wraps each question. Ctrl+C stops cleanly. Esc also stops, unless `back` is on (the
 * capture menu), where it goes back to the previous question instead.
 */
function ask(t, { back = false } = {}) {
  if (back && lastKey === undefined) {
    // Clack reports Esc and Ctrl+C the same way, so the key itself is watched here
    readline.emitKeypressEvents(process.stdin);
    process.stdin.on("keypress", (_, k) => (lastKey = k?.name));
    lastKey = null;
  }
  return async (prompt) => {
    const v = await prompt;
    if (p.isCancel(v)) {
      if (back && lastKey === "escape") throw BACK;
      p.cancel(t.cancel);
      process.exit(0);
    }
    return v;
  };
}

/**
 * The menu shown when screendocs runs with no arguments. Asks for the site and the
 * options, logs in if needed, and returns the same arguments the command line takes.
 * Each question is a step; Esc goes back to the previous step with its answer filled in.
 */
export async function interactive() {
  const lang = uiLang();
  const t = T[lang];
  const a = ask(t, { back: true });
  const yesNo = (o) => p.confirm({ active: t.yes, inactive: t.no, ...o });
  banner(t);
  p.intro(pc.bold(bgCrimson(pc.white(" ScreenDocs "))));
  p.log.message(pc.dim(t.keys));

  const s = { outDir: "screendocs-output", maxPages: "20", depth: "3" };
  const isNum = (v) => (/^\d+$/.test((v ?? "").trim()) ? undefined : t.number);
  const steps = [
    async () => {
      s.url = await askUrl(t, a, lang, s.typed);
      s.typed = s.url.replace(/^https:\/\//, "").replace(/\/$/, "");
      s.host = new URL(s.url).host;
    },
    async () => {
      if (fs.existsSync(authFile(s.host))) {
        const spin = p.spinner();
        spin.start(t.checking);
        const browser = await launch();
        const st = await sessionStatus(browser, s.host).finally(() => browser.close());
        if (st.state === "expired") {
          spin.stop(pc.yellow(t.expired(s.host, new URL(st.checkUrl).pathname)));
          if (await a(yesNo({ message: t.relogin, initialValue: true }))) {
            p.log.step(t.loginNow);
            await login(s.url);
          }
        } else {
          spin.stop(st.state === "ok" ? t.savedLogin(s.host) : t.unchecked(s.host));
        }
      } else if (await a(yesNo({ message: t.hasLogin, initialValue: false }))) {
        p.log.step(t.loginNow);
        await login(s.url);
      }
    },
    async () => {
      s.viewports = await a(p.select({
        message: t.viewports,
        initialValue: s.viewports,
        options: [
          { value: "both", label: t.both },
          { value: "desktop", label: t.desktop },
          { value: "mobile", label: t.mobile },
        ],
      }));
    },
    async () => (s.video = await a(yesNo({ message: t.video, initialValue: s.video ?? true }))),
    async () => {
      s.mode = await a(p.select({
        message: t.mode,
        initialValue: s.mode,
        options: [
          { value: "discover", label: t.discover, hint: t.discoverHint },
          { value: "list", label: t.list },
        ],
      }));
    },
    {
      when: () => s.mode === "discover",
      run: async () => {
        s.maxPages = (await a(p.text({
          message: t.maxPages,
          initialValue: s.maxPages,
          validate: (v) => (/^\d+$/.test((v ?? "").trim()) && Number(v) > 0 ? undefined : t.number),
        }))).trim();
      },
    },
    {
      when: () => s.mode === "discover",
      run: async () => (s.exclude = (await a(p.text({ message: t.exclude, placeholder: t.none, initialValue: s.exclude }))) ?? ""),
    },
    {
      when: () => s.mode === "list",
      run: async () => {
        s.paths = await a(p.text({ message: t.paths, placeholder: "/, /about, /pricing", initialValue: s.paths, validate: (v) => ((v ?? "").trim() ? undefined : t.paths) }));
      },
    },
    async () => (s.autoMask = await a(yesNo({ message: t.mask, initialValue: s.autoMask ?? true }))),
    async () => {
      s.how = await chooseDescriber({ t, a, later: true });
      if (!s.how.describe) p.log.info(pc.dim(t.noKey));
    },
    async () => {
      // The language the AI writes the descriptions in
      s.descLang = await a(p.select({
        message: t.lang,
        initialValue: s.descLang ?? lang,
        options: [{ value: "pt", label: "Português" }, { value: "en", label: "English" }, { value: "es", label: "Español" }],
      }));
    },
    async () => (s.advanced = await a(yesNo({ message: t.advanced, initialValue: s.advanced ?? false }))),
    {
      when: () => s.advanced && s.mode === "discover",
      run: async () => (s.depth = (await a(p.text({ message: t.depth, initialValue: s.depth, validate: isNum }))).trim()),
    },
    {
      when: () => s.advanced,
      run: async () => (s.maskSel = (await a(p.text({ message: t.maskSel, placeholder: t.none, initialValue: s.maskSel }))) ?? ""),
    },
    {
      when: () => s.advanced,
      run: async () => {
        s.outDir = (await a(p.text({ message: t.out, initialValue: s.outDir, validate: (v) => ((v ?? "").trim() ? undefined : t.out) }))).trim();
      },
    },
    { when: () => s.advanced, run: async () => (s.headed = await a(yesNo({ message: t.headed, initialValue: s.headed ?? false }))) },
    {
      when: () => s.advanced && s.how.describe && s.how.describe !== "chat",
      run: async () => (s.docs = (await a(p.text({ message: t.docs, placeholder: t.none, initialValue: s.docs }))) ?? ""),
    },
    {
      when: () => fs.existsSync(path.join(s.outDir, s.host.replace(/[^a-z0-9.-]/gi, "_"))),
      run: async () => {
        s.keep = await a(p.select({
          message: t.previous(s.host),
          initialValue: s.keep ?? false,
          options: [{ value: true, label: t.keepOld }, { value: false, label: t.replace }],
        }));
      },
    },
    async () => {
      if (fs.existsSync("screendocs.config.json")) p.log.info(t.usingConfig("screendocs.config.json"));
      p.note(`npx screendocs ${toArgs(s).map(quote).join(" ")}`, t.command);
      if (!(await a(yesNo({ message: t.start, initialValue: true })))) {
        p.cancel(t.cancel);
        process.exit(0);
      }
    },
  ].map((st) => (typeof st === "function" ? { run: st } : st));

  // Steps that were asked, so Esc returns to the last one actually shown
  const done = [];
  for (let i = 0; i < steps.length; ) {
    if (steps[i].when && !steps[i].when()) {
      i++;
      continue;
    }
    try {
      await steps[i].run();
      done.push(i++);
    } catch (e) {
      if (e !== BACK) throw e;
      if (done.length) i = done.pop();
    }
  }
  p.outro("ScreenDocs");
  return [...toArgs(s), "--open"];
}

/** The menu's answers as command line arguments. */
function toArgs(s) {
  const args = [s.url];
  if (s.viewports !== "both") args.push("--viewports", s.viewports);
  if (!s.video) args.push("--no-video");
  if (s.mode === "discover") {
    if (s.maxPages !== "20") args.push("--max-pages", s.maxPages);
    const list = (s.exclude ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    if (list.length) args.push("--exclude", list.join(","));
  } else {
    args.push("--pages", s.paths.split(",").map((x) => x.trim()).filter(Boolean).join(","));
  }
  if (!s.autoMask) args.push("--no-auto-mask");
  if (s.how.describe) {
    args.push("--describe", s.how.describe);
    if (s.how.describe === "api") args.push("--api-url", s.how.apiUrl, "--model", s.how.model);
  }
  if (s.descLang !== "en") args.push("--lang", s.descLang);
  if (s.advanced) {
    if (s.mode === "discover" && s.depth !== "3") args.push("--depth", s.depth);
    if (s.maskSel?.trim()) args.push("--mask", s.maskSel.trim());
    if (s.outDir !== "screendocs-output") args.push("--out", s.outDir);
    if (s.headed) args.push("--headed");
    if (s.how.describe && s.how.describe !== "chat" && s.docs?.trim()) args.push("--docs", s.docs.trim());
  }
  if (s.keep) args.push("--keep");
  return args;
}

/**
 * "Who writes the descriptions?": an AI tool installed here, an API, an AI chat in the
 * browser (guided) or, in the capture menu, just the page scan for now. Also used by "screendocs describe".
 */
export async function chooseDescriber({ t = T[uiLang()], a = ask(t), later = false } = {}) {
  // Every AI tool is listed; one that is missing can be installed from here
  for (;;) {
    const agents = installedAgents();
    const tool = await a(p.select({
      message: t.describe,
      options: [
        ...Object.keys(AGENTS).map((k) => ({ value: k, label: AGENTS[k].name, hint: agents.includes(k) ? t.yourPlan : t.notInstalled })),
        { value: "api", label: t.api, hint: "OpenAI, Gemini, OpenRouter, Anthropic, Ollama..." },
        { value: "chat", label: t.chat, hint: t.chatHint },
        ...(later ? [{ value: "", label: t.later, hint: t.laterHint }] : []),
      ],
    }));
    if (AGENTS[tool] && !agents.includes(tool) && !(await setUp(t, a, tool).catch(back(false)))) continue;
    if (tool !== "api") return { describe: tool };
    // Esc on the API questions goes back to the list above
    const api = await askApi(t, a).catch(back(null));
    if (api) return api;
  }
}

/** Which API, which model and, when needed, the key. */
async function askApi(t, a) {
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

/** Installs a missing AI tool with its official installer and has the person log in. False: back to the list. */
async function setUp(t, a, agent) {
  const { name, login } = AGENTS[agent];
  p.log.warn(t.installWhat(name, installCommand(agent)));
  if (!(await a(p.confirm({ message: t.installNow(name), active: t.yes, inactive: t.no, initialValue: true })))) return false;
  if (!installAgent(agent)) {
    p.log.error(t.installFailed(name, installCommand(agent)));
    return false;
  }
  p.log.success(t.installed(name));
  await a(p.select({ message: t.agentLogin(name, login), options: [{ value: true, label: t.loggedIn }] }));
  return true;
}

/**
 * Asks for the site and checks that it opens. When it does not, offers the close
 * addresses that do (missing www, missing .br, a typo) and shows examples.
 */
async function askUrl(t, a, lang, typed = "") {
  const u = URL_TEXT[lang];
  for (;;) {
    typed = await a(p.text({
      message: t.url,
      placeholder: lang === "pt" ? "meusite.com.br" : "mysite.com",
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
    })).catch(back("retype"));
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
