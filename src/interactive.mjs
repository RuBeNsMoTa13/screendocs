import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import pc, { crimson, bgCrimson } from "./theme.mjs";
import * as p from "@clack/prompts";
import { login } from "./login.mjs";
import { authFile } from "./paths.mjs";
import { launch } from "./browser.mjs";
import { sessionStatus } from "./session.mjs";
import { AGENTS, installedAgents, installCommand, installAgent } from "./agents.mjs";
import { PROVIDERS, providerById, resolveModel, findKey, saveKey, checkLocal, checkKey, KEYS_FILE } from "./providers.mjs";
import { storeOf } from "./secrets.mjs";
import { checkUrl, EXAMPLES, URL_TEXT, short } from "./checkurl.mjs";
import { setBack } from "./hud.mjs";
import { DOC_TYPES } from "./docs.mjs";
import { uiLang } from "./i18n.mjs";
import { baseConfig, projectFile } from "./config.mjs";
import { USER_CONFIG, readUserConfig } from "./userconfig.mjs";

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
    modelHint: (ex) => `e.g. ${ex}`,
    apiKey: "API key (Enter if this server has none)",
    baseUrl: (u) => `To run the printed command again later, first set OPENAI_BASE_URL=${u}`,
    keyFor: (n) => `${n} API key (it does not show while you type)`,
    keySave: (f) => `Save it for next time? (in ${f}, outside the project)`,
    keySaved: (f) => `Key saved in ${f}.`,
    keyReplace: "Replace the saved key with this one?",
    keyRefused: (n) => `${n} refused this key. Check it and type it again.`,
    keySafe: (n) => `It goes to the ${n}, not in plain text.`,
    stores: { keychain: "system keychain", encrypted: "file, encrypted with your Windows account", file: "file, readable only by you" },
    keyFound: (n, from) => `Using the ${n} key from ${from}.`,
    checkingLocal: (n) => `Checking ${n}...`,
    localOk: (n) => `${n} answered.`,
    noKey: "Descriptions will use each section's title and first paragraph. To have an AI write them later: npx screendocs describe <site>",
    lang: "Description language",
    previous: (h) => `There is already a capture of ${h}. What should happen to it?`,
    replace: "Replace it", keepOld: "Keep it (renamed with its date)",
    advanced: "Change advanced options? (link depth, extra blurring)",
    depth: "How many clicks away from the start page to look for pages?",
    maskSel: "Other things to blur (CSS selectors, e.g. .customer-name, #balance)",
    out: "Where to save the capture? (Enter keeps this folder)",
    headed: "Show the browser while capturing?",
    instructions: "Should the descriptions focus on something specific? (Enter to skip)",
    instructionsHint: "e.g. what the customer gains on each screen",
    docs: "A folder or file with the site's documentation for the AI to read? (Enter to skip)",
    docsHint: "e.g. C:\\mysite\\docs or ./manual.pdf",
    docsTypes: "md, txt, html, json, csv, PDF, Word, Excel, PowerPoint, OpenDocument...",
    docsMissing: "Not found. Type the path of a folder or a file, or leave it empty.",
    docsBadType: (types) => `screendocs does not read this kind of file. It reads: ${types}`,
    usingConfig: (f) => `Also using the options in ${f}.`,
    usingUser: (f) => `Your defaults come from ${f} (change them with: npx screendocs config).`,
    start: "Start the capture?",
    command: "Same thing next time, without the questions",
    cancel: "Cancelled.",
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
    modelHint: (ex) => `ex.: ${ex}`,
    apiKey: "Chave da API (Enter se esse servidor não usa)",
    baseUrl: (u) => `Para repetir o comando depois, defina antes OPENAI_BASE_URL=${u}`,
    keyFor: (n) => `Chave da API do ${n} (não aparece enquanto você digita)`,
    keySave: (f) => `Guardar para as próximas vezes? (em ${f}, fora do projeto)`,
    keySaved: (f) => `Chave guardada em ${f}.`,
    keyReplace: "Trocar a chave guardada por esta?",
    keyRefused: (n) => `O ${n} recusou esta chave. Confira e digite de novo.`,
    keySafe: (n) => `Ela vai para o ${n}, não em texto puro.`,
    stores: { keychain: "cofre de senhas do sistema", encrypted: "arquivo, criptografado com a sua conta do Windows", file: "arquivo, que só você pode ler" },
    keyFound: (n, from) => `Usando a chave do ${n} de ${from}.`,
    checkingLocal: (n) => `Conferindo o ${n}...`,
    localOk: (n) => `${n} respondeu.`,
    noKey: "As descrições vão usar o título e o primeiro parágrafo de cada seção. Para uma IA escrever depois: npx screendocs describe <site>",
    lang: "Idioma das descrições",
    previous: (h) => `Já existe uma captura de ${h}. O que fazer com ela?`,
    replace: "Substituir", keepOld: "Guardar (renomeada com a data)",
    advanced: "Mudar as opções avançadas? (profundidade dos links, borrar mais coisas)",
    depth: "A quantos cliques da página inicial procurar páginas?",
    maskSel: "Outras coisas para borrar (seletores CSS, ex.: .nome-cliente, #saldo)",
    out: "Onde salvar a captura? (Enter para usar esta pasta)",
    headed: "Mostrar o navegador durante a captura?",
    instructions: "Quer que as descrições falem de algo específico? (Enter para pular)",
    instructionsHint: "ex.: o que o cliente ganha em cada tela",
    docs: "Tem uma pasta ou arquivo com documentação do site para a IA ler? (Enter para pular)",
    docsHint: "ex.: C:\\meusite\\docs ou ./manual.pdf",
    docsTypes: "md, txt, html, json, csv, PDF, Word, Excel, PowerPoint, OpenDocument...",
    docsMissing: "Não achei. Digite o caminho de uma pasta ou de um arquivo, ou deixe vazio.",
    docsBadType: (types) => `O screendocs não lê esse tipo de arquivo. Ele lê: ${types}`,
    usingConfig: (f) => `Usando também as opções de ${f}.`,
    usingUser: (f) => `Os seus padrões vêm de ${f} (mude com: npx screendocs config).`,
    start: "Começar a captura?",
    command: "Para repetir sem as perguntas",
    cancel: "Cancelado.",
    yes: "Sim", no: "Não", none: "nenhuma",
    number: "Digite um número",
  },
  es: {
    tagline: "capturas, videos y documentación de todas las pantallas de un sitio web",
    by: "por",
    url: "¿Qué sitio quieres documentar? (ej.: misitio.com, www.misitio.es, app.misitio.io/login)",
    urlBad: "Escribe una dirección web, como misitio.com",
    savedLogin: (h) => `Usando el inicio de sesión guardado de ${h}.`,
    checking: "Revisando el inicio de sesión guardado...",
    expired: (h, u) => `El inicio de sesión guardado de ${h} expiró (${u} te llevó a otra página).`,
    relogin: "¿Iniciar sesión de nuevo ahora?",
    unchecked: (h) => `Usando el inicio de sesión guardado de ${h}. Inicia sesión de nuevo con esta versión para que screendocs te avise cuando expire.`,
    hasLogin: "¿El sitio tiene páginas que piden iniciar sesión?",
    loginNow: "Se abrirá una ventana del navegador. Inicia sesión, vuelve aquí y presiona Enter.",
    viewports: "¿Qué pantallas?",
    desktop: "Computadora", mobile: "Celular", both: "Las dos",
    video: "¿Grabar un video desplazándose por cada página?",
    mode: "¿Qué páginas?",
    discover: "Encontrarlas siguiendo los enlaces", discoverHint: "recomendado",
    list: "Solo las rutas que yo escriba",
    maxPages: "¿Hasta cuántas páginas?",
    paths: "Rutas, separadas por comas",
    exclude: "Saltar páginas cuya dirección contiene (ej.: /admin, /checkout; Enter para ninguna)",
    mask: "¿Difuminar correos, teléfonos, documentos (CPF/CNPJ) y campos de formulario llenos?",
    describe: "¿Quién escribe las descripciones de las pantallas?",
    yourPlan: "usa tu plan, sin clave de API",
    notInstalled: "no está instalado aquí, puedo instalarlo",
    installWhat: (n, c) => `${n} no está instalado en esta computadora. Su instalador oficial es:\n  ${c}`,
    installNow: (n) => `¿Instalar ${n} ahora?`,
    installed: (n) => `${n} instalado.`,
    installFailed: (n, c) => `${n} no se instaló, o esta terminal todavía no lo ve. Cierra y abre la terminal y ejecuta screendocs de nuevo, o instálalo tú con:\n  ${c}`,
    agentLogin: (n, c) => `Ahora inicia sesión en ${n}: abre otra terminal, ejecuta ${c}, entra con tu cuenta y vuelve aquí.`,
    loggedIn: "Listo, ya inicié sesión",
    chat: "Un chat en tu navegador (ChatGPT, Gemini, Claude.ai...)",
    chatHint: "paso a paso, sin clave",
    later: "Por ahora, solo el escaneo de la página",
    laterHint: "una IA puede describir después: npx screendocs describe <sitio>",
    api: "Una API (con tu clave)",
    provider: "¿Qué proveedor?",
    other: "Otro (escribir la dirección)",
    apiUrl: "Dirección de la API (compatible con OpenAI)",
    model: "Modelo (uno que lea imágenes)",
    modelHint: (ex) => `ej.: ${ex}`,
    apiKey: "Clave de la API (Enter si este servidor no usa)",
    baseUrl: (u) => `Para repetir el comando después, define antes OPENAI_BASE_URL=${u}`,
    keyFor: (n) => `Clave de la API de ${n} (no se ve mientras escribes)`,
    keySave: (f) => `¿Guardarla para la próxima vez? (en ${f}, fuera del proyecto)`,
    keySaved: (f) => `Clave guardada en ${f}.`,
    keyReplace: "¿Reemplazar la clave guardada por esta?",
    keyRefused: (n) => `${n} rechazó esta clave. Revísala y escríbela de nuevo.`,
    keySafe: (n) => `Va al ${n}, no en texto plano.`,
    stores: { keychain: "llavero del sistema", encrypted: "archivo, cifrado con tu cuenta de Windows", file: "archivo, que solo tú puedes leer" },
    keyFound: (n, from) => `Usando la clave de ${n} de ${from}.`,
    checkingLocal: (n) => `Revisando ${n}...`,
    localOk: (n) => `${n} respondió.`,
    noKey: "Las descripciones usarán el título y el primer párrafo de cada sección. Para que una IA las escriba después: npx screendocs describe <sitio>",
    lang: "Idioma de las descripciones",
    previous: (h) => `Ya existe una captura de ${h}. ¿Qué hago con ella?`,
    replace: "Reemplazarla", keepOld: "Guardarla (renombrada con su fecha)",
    advanced: "¿Cambiar las opciones avanzadas? (profundidad de enlaces, difuminar más cosas)",
    depth: "¿A cuántos clics de la página inicial buscar páginas?",
    maskSel: "Otras cosas para difuminar (selectores CSS, ej.: .nombre-cliente, #saldo)",
    out: "¿Dónde guardar la captura? (Enter para usar esta carpeta)",
    headed: "¿Mostrar el navegador durante la captura?",
    instructions: "¿Las descripciones deben enfocarse en algo específico? (Enter para saltar)",
    instructionsHint: "ej.: lo que gana el cliente en cada pantalla",
    docs: "¿Hay una carpeta o archivo con la documentación del sitio para que la IA lea? (Enter para saltar)",
    docsHint: "ej.: C:\\misitio\\docs o ./manual.pdf",
    docsTypes: "md, txt, html, json, csv, PDF, Word, Excel, PowerPoint, OpenDocument...",
    docsMissing: "No lo encontré. Escribe la ruta de una carpeta o de un archivo, o déjalo vacío.",
    docsBadType: (types) => `screendocs no lee este tipo de archivo. Lee: ${types}`,
    usingConfig: (f) => `También uso las opciones de ${f}.`,
    usingUser: (f) => `Tus valores predeterminados vienen de ${f} (cámbialos con: npx screendocs config).`,
    start: "¿Empezar la captura?",
    command: "Lo mismo la próxima vez, sin las preguntas",
    cancel: "Cancelado.",
    yes: "Sí", no: "No", none: "ninguna",
    number: "Escribe un número",
  },
};

const AUTHOR = {
  name: "Rubens Mota",
  github: "https://github.com/RuBeNsMoTa13",
  portfolio: "",
};

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
  setBack(back);
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

  // What runs with no option typed (defaults, the user's config, screendocs.config.json) comes filled in
  const base = baseConfig();
  const s = {
    outDir: path.resolve(base.out),
    maxPages: String(base.maxPages),
    depth: String(base.depth),
    viewports: base.viewports.length > 1 ? "both" : base.viewports[0],
    video: base.video,
    headed: base.headed,
    autoMask: base.autoMask,
    exclude: base.exclude.join(", "),
    maskSel: base.mask.join(", "),
    descLang: base.lang,
    instructions: base.instructions ?? "",
    keep: base.keep,
  };
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
    async () => (s.headed = await a(yesNo({ message: t.headed, initialValue: s.headed ?? false }))),
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
      // The full path, so the person sees where the capture goes before it starts
      s.outDir = (await a(p.text({ message: t.out, initialValue: s.outDir, validate: (v) => ((v ?? "").trim() ? undefined : t.out) }))).trim();
    },
    async () => {
      s.how = await chooseDescriber({ t, a, later: true, initial: s.how?.describe ?? (base.model ? "api" : base.describe) ?? undefined });
      if (!s.how.describe) p.log.info(pc.dim(t.noKey));
    },
    async () => {
      // The language the AI writes the descriptions in
      s.descLang = await a(p.select({
        message: t.lang,
        initialValue: s.descLang ?? lang,
        options: [
          ...[{ value: "pt", label: "Português" }, { value: "en", label: "English" }, { value: "es", label: "Español" }],
          // A language set in a config file that is not one of these three stays available
          ...(["pt", "en", "es"].includes(s.descLang) ? [] : [{ value: s.descLang, label: s.descLang }]),
        ],
      }));
    },
    { when: () => s.how.describe, run: async () => (s.instructions = await askInstructions(s.instructions, { t, a })) },
    { when: () => s.how.describe, run: async () => (s.docs = await askDocs(s.docs, { t, a })) },
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
      when: () => fs.existsSync(path.join(s.outDir, s.host.replace(/[^a-z0-9.-]/gi, "_"))),
      run: async () => {
        s.asked = { ...s.asked, keep: true };
        s.keep = await a(p.select({
          message: t.previous(s.host),
          initialValue: s.keep ?? false,
          options: [{ value: true, label: t.keepOld }, { value: false, label: t.replace }],
        }));
      },
    },
    async () => {
      if (Object.keys(readUserConfig()).some((k) => k !== "language")) p.log.info(t.usingUser(shortHome(USER_CONFIG)));
      if (projectFile()) p.log.info(t.usingConfig(projectFile()));
      p.note(`npx screendocs ${toArgs(s, base).map(quote).join(" ")}`, t.command);
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
  return [...toArgs(s, base), "--open"];
}

/**
 * The menu's answers as command line arguments: only what differs from what runs with no
 * option typed (`base`), which may come from the user's config or screendocs.config.json.
 */
function toArgs(s, base) {
  const args = [s.url];
  const flag = (on, off, value, was) => value !== was && args.push(value ? on : off);
  const viewports = s.viewports === "both" ? ["desktop", "mobile"] : [s.viewports];
  if (viewports.join() !== base.viewports.join()) args.push("--viewports", viewports.join(","));
  flag("--video", "--no-video", s.video, base.video);
  if (s.mode === "discover") {
    if (Number(s.maxPages) !== base.maxPages) args.push("--max-pages", s.maxPages);
    const list = (s.exclude ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    if (list.join() !== base.exclude.join()) args.push("--exclude", list.join(","));
  } else {
    args.push("--pages", s.paths.split(",").map((x) => x.trim()).filter(Boolean).join(","));
  }
  flag("--auto-mask", "--no-auto-mask", s.autoMask, base.autoMask);
  flag("--headed", "--no-headed", s.headed, base.headed);
  if (path.resolve(s.outDir) !== path.resolve(base.out)) args.push("--out", s.outDir);
  // --model alone already means an API
  if (s.how.describe === "api") {
    args.push("--model", s.how.model);
  } else if (s.how.describe) {
    args.push("--describe", s.how.describe);
  } else if (base.describe || base.model) {
    // Just the page scan, although the config names an AI
    args.push("--describe", "none");
  }
  if (s.descLang !== base.lang) args.push("--lang", s.descLang);
  if (s.how.describe && (s.instructions ?? "") !== (base.instructions ?? "")) args.push("--instructions", s.instructions);
  if (s.how.describe && s.docs) args.push("--docs", s.docs);
  if (s.advanced) {
    if (s.mode === "discover" && Number(s.depth) !== base.depth) args.push("--depth", s.depth);
    const mask = (s.maskSel ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    if (mask.join() !== base.mask.join()) args.push("--mask", mask.join(","));
  }
  if (s.asked?.keep) flag("--keep", "--no-keep", s.keep, base.keep);
  return args;
}

/**
 * The two optional questions after choosing who describes: something specific the
 * descriptions should take into account, and the documentation for the AI to read.
 * Also used by "screendocs describe", with what the capture already has filled in.
 */
export async function askBrief(initial = {}, opts = {}) {
  return { instructions: await askInstructions(initial.instructions, opts), docs: await askDocs(initial.docs, opts) };
}

async function askInstructions(initial = "", { t = T[uiLang()], a = ask(t) } = {}) {
  return String((await a(p.text({ message: t.instructions, placeholder: t.instructionsHint, initialValue: initial ?? "" }))) ?? "").trim();
}

async function askDocs(initial = "", { t = T[uiLang()], a = ask(t) } = {}) {
  const v = await a(p.text({
    message: `${t.docs}\n${pc.dim(t.docsTypes)}`,
    placeholder: t.docsHint,
    initialValue: initial ?? "",
    validate: (v) => {
      const f = unquote(v);
      if (!f) return undefined;
      if (!fs.existsSync(f)) return t.docsMissing;
      if (fs.statSync(f).isFile() && !DOC_TYPES.includes(path.extname(f).slice(1).toLowerCase())) return t.docsBadType(DOC_TYPES.join(", "));
    },
  }));
  return unquote(v);
}

/** Windows "Copy as path" wraps the path in quotes. */
const unquote = (v) => String(v ?? "").trim().replace(/^(["'])(.*)\1$/, "$2");

/**
 * "Who writes the descriptions?": an AI tool installed here, an API, an AI chat in the
 * browser (guided) or, in the capture menu, just the page scan for now. Also used by "screendocs describe".
 */
export async function chooseDescriber({ t = T[uiLang()], a = ask(t), later = false, initial } = {}) {
  // Every AI tool is listed; one that is missing can be installed from here
  for (;;) {
    const agents = installedAgents();
    const tool = await a(p.select({
      message: t.describe,
      initialValue: initial,
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

/** Which API, which model and, when needed, the key (found, typed or saved). */
async function askApi(t, a) {
  const id = await a(p.select({
    message: t.provider,
    options: [...PROVIDERS.map((pr) => ({ value: pr.id, label: pr.name })), { value: "", label: t.other }],
  }));
  const provider = providerById(id);
  const apiUrl = provider ? undefined : (await a(p.text({ message: t.apiUrl, placeholder: "https://.../v1", validate: (v) => ((v ?? "").trim() ? undefined : t.apiUrl) }))).trim();
  const typed = (await a(p.text({
    message: t.model,
    placeholder: t.modelHint(provider ? provider.example.replace(/^[^/]+\//, "") : "gpt-4o-mini"),
    validate: (v) => ((v ?? "").trim() ? undefined : t.model),
  }))).trim();
  // The name the command line understands: the provider in front when the name does not say it
  // Another server: the OpenAI way, its address in OPENAI_BASE_URL and the model as openai/<model>
  if (apiUrl) {
    process.env.OPENAI_BASE_URL = apiUrl;
    p.log.info(t.baseUrl(apiUrl));
  }
  // Always with the provider in front, the usual format
  const prefix = provider?.id ?? "openai";
  const model = typed.startsWith(`${prefix}/`) ? typed : `${prefix}/${typed}`;
  if (provider?.local) {
    const spin = p.spinner();
    spin.start(t.checkingLocal(provider.name));
    try {
      const r = resolveModel(model);
      await checkLocal(r.provider, r.url, r.model);
      spin.stop(t.localOk(provider.name));
    } catch (e) {
      spin.stop(pc.yellow(e.message));
      return null;
    }
  } else if (provider) {
    const found = findKey(provider);
    if (found) p.log.info(t.keyFound(provider.name, found.from === KEYS_FILE ? shortHome(KEYS_FILE) : found.from));
    else {
      process.env.SCREENDOCS_API_KEY = await askKey(provider, { t, a });
    }
  } else {
    const key = (await a(p.password({ message: t.apiKey }))) ?? "";
    if (key.trim()) process.env.SCREENDOCS_API_KEY = key.trim();
  }
  return { describe: "api", model };
}

const shortHome = (f) => f.replace(os.homedir(), "~");

/**
 * Asks for a provider's key without showing it and offers to save it in the user's folder.
 * Also used by the command line when no key is found and there is a terminal.
 */
export async function askKey(provider, { t = T[uiLang()], a, replace = false, save = false, check = true } = {}) {
  const run = a ?? (async (q) => {
    const v = await q;
    if (p.isCancel(v)) throw new Error("cancelled");
    return v;
  });
  let key;
  for (;;) {
    key = String(await run(p.password({ message: t.keyFor(provider.name), validate: (v) => ((v ?? "").trim() ? undefined : t.keyFor(provider.name)) }))).trim();
    // Tried before it is used or saved: a typo is fixed here, not after the capture.
    // A key that cannot be tried (no network) goes on as typed
    if (!check || (await checkKey(provider, provider.url, key)) !== "refused") break;
    p.log.warn(t.keyRefused(provider.name));
  }
  // Saved only when the person wants; a wrong saved key is the one case where replacing is the default
  if (save || await run(p.confirm({ message: replace ? t.keyReplace : t.keySave(shortHome(KEYS_FILE)), active: t.yes, inactive: t.no, initialValue: replace }))) {
    const where = storeOf(saveKey(provider.id, key));
    p.log.success(`${t.keySaved(shortHome(KEYS_FILE))} ${where === "file" ? `(${t.stores.file})` : t.keySafe(t.stores[where])}`);
  }
  return key;
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
      placeholder: { pt: "meusite.com.br", es: "misitio.com" }[lang] ?? "mysite.com",
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
