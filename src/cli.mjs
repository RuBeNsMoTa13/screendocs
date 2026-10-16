import { parseArgs } from "node:util";
import { loadConfig } from "./config.mjs";
import { login } from "./login.mjs";
import { discover } from "./discover.mjs";
import { capture } from "./capture.mjs";
import { describeWith, checkAgent } from "./agents.mjs";
import { writeReport, writeForAi } from "./report.mjs";
import { locateCapture, listCaptures } from "./answers.mjs";
import { chatFlow } from "./chat.mjs";
import { saveBrief, docsSummary, DOC_TYPES } from "./docs.mjs";
import { launch, ensureVideoEncoder } from "./browser.mjs";
import { authFile, normalizeUrl } from "./paths.mjs";
import { checkUrl, URL_TEXT, short } from "./checkurl.mjs";
import { sessionStatus } from "./session.mjs";
import { interactive, banner, chooseDescriber, askBrief, askKey } from "./interactive.mjs";
import { tr, languageChosen } from "./i18n.mjs";
import { USER_CONFIG } from "./userconfig.mjs";
import { configCommand, askLanguage } from "./configcmd.mjs";
import { PROVIDERS, providerById, savedKeys, removeKey, KEYS_FILE } from "./providers.mjs";
import { storeOf } from "./secrets.mjs";
import pc from "./theme.mjs";
import * as p from "@clack/prompts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const shortHome = (f) => f.replace(os.homedir(), "~");

const HELP = {
  en: `screendocs: screenshot, record and document every screen of a website.

Usage
  npx screendocs                       interactive menu
  npx screendocs <url> [options]       capture the site
  npx screendocs login <url>           log in once; later runs reuse the session
  npx screendocs describe [<site>]     describe the screens of a capture you already made (no site: pick from a list)
  npx screendocs config                your own defaults and the language of screendocs (menu); also:
                                       config list, config set <setting> <value>, config unset <setting>, config reset, config path
  npx screendocs keys set <provider>   save an API key once (openai, gemini, anthropic, openrouter); also: keys list, keys remove <provider>
  npx screendocs mcp [--dir <folder>]  MCP server for AI clients (Claude Code, Cursor...); see the README

  <url> examples: mysite.com, www.mysite.com.br, app.mysite.io/login, http://localhost:3000
  (https:// is added when missing; the address is checked before the capture starts)

  With only <url>, every option below uses its default. To change the defaults:
    - for you, everywhere: npx screendocs config (saved in ${shortHome(USER_CONFIG)})
    - for one folder: screendocs.config.json there (wins over your defaults)
    - for one run: type the option (wins over both)

Options
  --max-pages <n>       pages to discover (default 20)
  --depth <n>           link depth from the start page (default 3)
  --pages <a,b,c>       capture exactly these paths instead of discovering
  --exclude <a,b>       skip URLs containing any of these texts
  --viewports <list>    desktop, mobile or both (default desktop,mobile)
  --no-video            do not record the scroll videos (--video records them)
  --out <dir>           output folder (default screendocs-output)
  --keep                keep the previous capture (renamed with its date) instead of replacing it
  --mask <selectors>    extra CSS selectors to hide, comma separated
  --no-auto-mask        do not hide emails, phones, documents (CPF, SSN, DNI...), cards and filled fields
  --describe <how>      who writes the descriptions:
                          claude, codex, antigravity
                                an AI tool installed and logged in here (uses your plan)
                          chat  an AI chat in your browser, step by step (ChatGPT, Gemini...)
                          none  no AI this time, even when your defaults name one
  --model <provider/model>  describe with an API (a model that reads images).
                        The key comes from the provider's usual variable:
                          openai/gpt-4o-mini             OPENAI_API_KEY
                          gemini/gemini-2.5-flash        GEMINI_API_KEY
                          anthropic/claude-sonnet-4-5    ANTHROPIC_API_KEY
                          openrouter/<model>             OPENROUTER_API_KEY
                          ollama/llama3.2-vision         Ollama on this computer, no key
                          lmstudio/<model>               LM Studio on this computer, no key
                        No key set: it asks once (hidden) and can save it (screendocs keys set).
  --instructions <text> what else the descriptions should take into account,
                        e.g. "focus on what the customer gains"
  --docs <path>         the project's documentation for the AI to read: a folder or one file
                        (${DOC_TYPES.join(", ")})
  --lang <code>         description language (default: the language of screendocs)
  --config <file>       config file (default screendocs.config.json if present)
  --headed              show the browser while capturing
  --no-url-check        do not check that the address opens before starting
  --open                open the report when done
  -v, --version         show the version
  -h, --help            show this help
`,
  pt: `screendocs: fotos, vídeos e documentação de todas as telas de um site.

Uso
  npx screendocs                       menu interativo
  npx screendocs <url> [opções]        captura o site
  npx screendocs login <url>           faz login uma vez; as próximas execuções usam a sessão
  npx screendocs describe [<site>]     descreve as telas de uma captura já feita (sem site: escolha numa lista)
  npx screendocs config                os seus padrões e o idioma do screendocs (menu); também:
                                       config list, config set <opção> <valor>, config unset <opção>, config reset, config path
  npx screendocs keys set <provedor>   guarda uma chave de API uma vez (openai, gemini, anthropic, openrouter); também: keys list, keys remove <provedor>
  npx screendocs mcp [--dir <pasta>]   servidor MCP para clientes de IA (Claude Code, Cursor...); veja o README

  Exemplos de <url>: meusite.com.br, www.meusite.com, app.meusite.io/login, http://localhost:3000
  (o https:// é adicionado se faltar; o endereço é conferido antes da captura)

  Só com a <url>, todas as opções abaixo usam o padrão. Para mudar os padrões:
    - para você, em qualquer pasta: npx screendocs config (guardado em ${shortHome(USER_CONFIG)})
    - para uma pasta: screendocs.config.json nela (ganha dos seus padrões)
    - para uma execução: digite a opção (ganha dos dois)

Opções
  --max-pages <n>       páginas para encontrar (padrão 20)
  --depth <n>           profundidade dos links a partir da página inicial (padrão 3)
  --pages <a,b,c>       captura exatamente estes caminhos em vez de procurar
  --exclude <a,b>       pula endereços que contêm algum destes textos
  --viewports <lista>   desktop, mobile ou os dois (padrão desktop,mobile)
  --no-video            não grava os vídeos rolando as páginas (--video grava)
  --out <pasta>         pasta da captura (padrão screendocs-output)
  --keep                guarda a captura anterior (renomeada com a data) em vez de substituir
  --mask <seletores>    seletores CSS a mais para esconder, separados por vírgula
  --no-auto-mask        não esconde e-mails, telefones, documentos (CPF, SSN, DNI...), cartões e campos preenchidos
  --describe <como>     quem escreve as descrições:
                          claude, codex, antigravity
                                uma ferramenta de IA instalada e logada aqui (usa o seu plano)
                          chat  um chat de IA no navegador, passo a passo (ChatGPT, Gemini...)
                          none  sem IA desta vez, mesmo que os seus padrões escolham uma
  --model <provedor/modelo>  descreve com uma API (um modelo que leia imagens).
                        A chave vem da variável de costume do provedor:
                          openai/gpt-4o-mini             OPENAI_API_KEY
                          gemini/gemini-2.5-flash        GEMINI_API_KEY
                          anthropic/claude-sonnet-4-5    ANTHROPIC_API_KEY
                          openrouter/<modelo>            OPENROUTER_API_KEY
                          ollama/llama3.2-vision         Ollama neste computador, sem chave
                          lmstudio/<modelo>              LM Studio neste computador, sem chave
                        Sem chave: pergunta uma vez (escondida) e pode guardar (screendocs keys set).
  --instructions <texto> o que mais as descrições devem levar em conta,
                        ex.: "foque no que o cliente ganha"
  --docs <caminho>      a documentação do projeto para a IA ler: uma pasta ou um arquivo
                        (${DOC_TYPES.join(", ")})
  --lang <código>       idioma das descrições (padrão: o idioma do screendocs)
  --config <arquivo>    arquivo de configuração (padrão screendocs.config.json, se existir)
  --headed              mostra o navegador durante a captura
  --no-url-check        não confere se o endereço abre antes de começar
  --open                abre o relatório no final
  -v, --version         mostra a versão
  -h, --help            mostra esta ajuda
`,
  es: `screendocs: capturas, videos y documentación de todas las pantallas de un sitio web.

Uso
  npx screendocs                       menú interactivo
  npx screendocs <url> [opciones]      captura el sitio
  npx screendocs login <url>           inicia sesión una vez; las siguientes ejecuciones usan la sesión
  npx screendocs describe [<sitio>]    describe las pantallas de una captura ya hecha (sin sitio: elige de una lista)
  npx screendocs config                tus valores predeterminados y el idioma de screendocs (menú); también:
                                       config list, config set <opción> <valor>, config unset <opción>, config reset, config path
  npx screendocs keys set <proveedor>  guarda una clave de API una vez (openai, gemini, anthropic, openrouter); también: keys list, keys remove <proveedor>
  npx screendocs mcp [--dir <carpeta>] servidor MCP para clientes de IA (Claude Code, Cursor...); ver el README

  Ejemplos de <url>: misitio.com, www.misitio.es, app.misitio.io/login, http://localhost:3000
  (se agrega https:// si falta; la dirección se revisa antes de la captura)

  Solo con la <url>, todas las opciones de abajo usan su valor predeterminado. Para cambiarlos:
    - para ti, en cualquier carpeta: npx screendocs config (guardado en ${shortHome(USER_CONFIG)})
    - para una carpeta: screendocs.config.json en ella (gana sobre tus valores)
    - para una ejecución: escribe la opción (gana sobre los dos)

Opciones
  --max-pages <n>       páginas a encontrar (predeterminado 20)
  --depth <n>           profundidad de enlaces desde la página inicial (predeterminado 3)
  --pages <a,b,c>       captura exactamente estas rutas en lugar de buscar
  --exclude <a,b>       salta direcciones que contienen alguno de estos textos
  --viewports <lista>   desktop, mobile o las dos (predeterminado desktop,mobile)
  --no-video            no graba los videos desplazándose por las páginas (--video los graba)
  --out <carpeta>       carpeta de la captura (predeterminado screendocs-output)
  --keep                guarda la captura anterior (renombrada con su fecha) en lugar de reemplazarla
  --mask <selectores>   selectores CSS extra para ocultar, separados por comas
  --no-auto-mask        no oculta correos, teléfonos, documentos (CPF, SSN, DNI...), tarjetas ni campos completados
  --describe <cómo>     quién escribe las descripciones:
                          claude, codex, antigravity
                                una herramienta de IA instalada y con sesión aquí (usa tu plan)
                          chat  un chat de IA en tu navegador, paso a paso (ChatGPT, Gemini...)
                          none  sin IA esta vez, aunque tus valores predeterminados elijan una
  --model <proveedor/modelo>  describe con una API (un modelo que lea imágenes).
                        La clave viene de la variable habitual del proveedor:
                          openai/gpt-4o-mini             OPENAI_API_KEY
                          gemini/gemini-2.5-flash        GEMINI_API_KEY
                          anthropic/claude-sonnet-4-5    ANTHROPIC_API_KEY
                          openrouter/<modelo>            OPENROUTER_API_KEY
                          ollama/llama3.2-vision         Ollama en esta computadora, sin clave
                          lmstudio/<modelo>              LM Studio en esta computadora, sin clave
                        Sin clave: la pide una vez (oculta) y puede guardarla (screendocs keys set).
  --instructions <texto> qué más deben tener en cuenta las descripciones,
                        ej.: "enfócate en lo que gana el cliente"
  --docs <ruta>         la documentación del proyecto para que la IA lea: una carpeta o un archivo
                        (${DOC_TYPES.join(", ")})
  --lang <código>       idioma de las descripciones (predeterminado: el idioma de screendocs)
  --config <archivo>    archivo de configuración (predeterminado screendocs.config.json, si existe)
  --headed              muestra el navegador durante la captura
  --no-url-check        no revisa que la dirección abra antes de empezar
  --open                abre el informe al terminar
  -v, --version         muestra la versión
  -h, --help            muestra esta ayuda
`,
};

export async function run(argv) {
  // Before anything prints: under an AI client, stdout carries the MCP protocol
  if (argv[0] === "mcp") {
    const { values } = parseArgs({ args: argv.slice(1), options: { dir: { type: "string" } } });
    const { startMcp } = await import("./mcp.mjs");
    return startMcp(values);
  }
  const tty = process.stdin.isTTY && process.stdout.isTTY;
  const quick = argv.some((x) => ["-h", "--help", "-v", "--version"].includes(x));
  // The first run in a terminal asks which language screendocs talks in ("config" sets it itself)
  if (tty && !quick && argv[0] !== "config" && !languageChosen()) await askLanguage();
  if (argv[0] === "config") return configCommand(argv[1], argv.slice(2));
  // No arguments in a real terminal: show the menu instead of the help
  const fromMenu = argv.length === 0 && tty;
  if (fromMenu) argv = await interactive();
  else if (process.stdout.isTTY && !quick) banner();
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      "max-pages": { type: "string" },
      depth: { type: "string" },
      pages: { type: "string" },
      exclude: { type: "string" },
      viewports: { type: "string" },
      video: { type: "boolean" },
      "no-video": { type: "boolean" },
      "no-keep": { type: "boolean" },
      "auto-mask": { type: "boolean" },
      "no-headed": { type: "boolean" },
      out: { type: "string" },
      keep: { type: "boolean" },
      mask: { type: "string" },
      "no-auto-mask": { type: "boolean" },
      "no-url-check": { type: "boolean" },
      describe: { type: "string" },
      docs: { type: "string" },
      instructions: { type: "string" },
      model: { type: "string" },
      lang: { type: "string" },
      config: { type: "string" },
      headed: { type: "boolean" },
      open: { type: "boolean" },
      version: { type: "boolean", short: "v" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.version) {
    const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    console.log(pkg.version);
    return;
  }

  if (values.help || positionals.length === 0) {
    console.log(tr(HELP));
    return;
  }

  if (positionals[0] === "apply")
    throw new Error(tr({ en: 'apply was replaced by: screendocs describe <site> (choose "A chat in your browser")', pt: 'o apply foi trocado por: screendocs describe <site> (escolha "Um chat no navegador")', es: 'apply fue reemplazado por: screendocs describe <sitio> (elige "Un chat en tu navegador")' }));

  if (positionals[0] === "keys") return keysCommand(positionals[1], positionals[2]);

  if (positionals[0] === "describe") {
    const root = locateCapture(positionals[1], values.out) ?? (await pickCapture(positionals[1], values.out));
    const data = JSON.parse(fs.readFileSync(path.join(root, "screens.json"), "utf8"));
    let open = values.open;
    if (!values.describe && !values.model) {
      if (!process.stdin.isTTY)
        throw new Error(
          tr({
            en: "choose who describes: --describe claude, codex, antigravity or chat, or --model <model> for an API",
            pt: "escolha quem descreve: --describe claude, codex, antigravity ou chat, ou --model <modelo> para uma API",
            es: "elige quién describe: --describe claude, codex, antigravity o chat, o --model <modelo> para una API",
          }),
        );
      p.intro(`${data.site} · ${new Date(data.createdAt).toLocaleString()}`);
      const how = await chooseDescriber();
      Object.assign(values, how.describe === "api" ? { model: how.model } : { describe: how.describe });
      // What the capture already has comes filled in
      const brief = await askBrief({ instructions: values.instructions ?? data.instructions, docs: values.docs ?? data.docs });
      Object.assign(values, brief);
      open = true;
    }
    const config = loadConfig(data.url, { ...values, lang: values.lang ?? data.lang });
    if (values.lang && values.lang !== data.lang) {
      data.lang = values.lang;
      fs.writeFileSync(path.join(root, "screens.json"), JSON.stringify(data, null, 2) + "\n");
    }
    await checkAgent(config.describe, config);
    await brief(root, config);
    const r = await describe(config, root);
    console.log(`${T().report}: ${r.report}`);
    if (open) openFile(r.report);
    return;
  }

  if (positionals[0] === "login") {
    if (!positionals[1]) throw new Error(tr({ en: "use: screendocs login <url>", pt: "use: screendocs login <url>", es: "uso: screendocs login <url>" }));
    const url = normalizeUrl(positionals[1]);
    if (!values["no-url-check"]) await mustOpen(url);
    await login(url);
    return;
  }

  // The menu already checked the address (and may have picked a fix with the person)
  if (!fromMenu && !values["no-url-check"]) await mustOpen(normalizeUrl(positionals[0]));
  const config = loadConfig(normalizeUrl(positionals[0]), values);
  const start = new URL(config.url);
  const auth = authFile(start.host);
  const storageState = fs.existsSync(auth) ? auth : undefined;
  const t = T();
  console.log(`screendocs ${start.href}${storageState ? ` ${t.usingLogin}` : ""}`);
  console.log(pc.dim(t.saving(path.resolve(config.out))));

  if (config.describe) await checkAgent(config.describe, config);
  const browser = await launch({ headless: !config.headed });
  try {
    if (storageState) {
      const s = await sessionStatus(browser, start.host);
      if (s.state === "expired") {
        console.log(t.expired(start.host, s.checkUrl, s.landed));
      }
    }
    const pages = await discover(browser, config, storageState);
    if (!pages.length) {
      throw new Error(t.noPages(start.href) + (storageState ? "" : t.needsLogin(start.host)));
    }
    console.log(t.toCapture(pages.length));
    if (config.video) await ensureVideoEncoder(browser);
    // The report is rewritten after every page, so stopping halfway still leaves one
    const result = await capture(browser, config, pages, storageState, (partial) => writeReport(partial, config));
    let report = writeReport(result, config);
    await brief(result.root, config);
    writeForAi(result.root);
    // Closed first: the chat step can take a while and does not need it
    await browser.close();
    console.log(t.done(result.screens.length));
    if (config.describe) report = (await describe(config, result.root)).report;
    console.log(`${t.report}: ${report}`);
    if (!config.describe) console.log(t.later(start.host));
    if (values.open) openFile(report);
  } finally {
    await browser.close();
  }
}

const MESSAGES = {
  en: {
    usingLogin: "(using saved login)",
    saving: (dir) => `Saving to ${dir} (change it with --out)`,
    expired: (host, url, landed) =>
      `\n! The saved login for ${host} has expired: ${url} now opens ${landed}.\n  Pages behind the login will be missed. To log in again: screendocs login ${host}\n`,
    noPages: (url) => `no pages found at ${url}. Open it in your browser and check that it loads without a login or a "verify you are human" check.`,
    needsLogin: (host) => ` If it needs a login, run: screendocs login ${host}`,
    toCapture: (n) => `\n${n} page(s) to capture`,
    done: (n) => `\nDone: ${n} screenshots.`,
    report: "Report",
    later: (host) => `To have an AI describe the screens: npx screendocs describe ${host}`,
    described: (by, n, total) => `\n${by} described ${n} of ${total} screens.`,
    more: (n) => ` and ${n} more`,
    pageText: (list) => `Still with the text from the page (marked "page text" in the report): ${list}`,
  },
  pt: {
    usingLogin: "(usando o login salvo)",
    saving: (dir) => `Salvando em ${dir} (mude com --out)`,
    expired: (host, url, landed) =>
      `\n! O login salvo de ${host} expirou: ${url} agora abre ${landed}.\n  As páginas que exigem login vão ficar de fora. Para entrar de novo: screendocs login ${host}\n`,
    noPages: (url) => `não achei páginas em ${url}. Abra no navegador e confira se carrega sem login e sem um teste de "verifique que você é humano".`,
    needsLogin: (host) => ` Se precisa de login, rode: screendocs login ${host}`,
    toCapture: (n) => `\n${n} página(s) para capturar`,
    done: (n) => `\nPronto: ${n} capturas.`,
    report: "Relatório",
    later: (host) => `Para uma IA descrever as telas: npx screendocs describe ${host}`,
    described: (by, n, total) => `\n${by} descreveu ${n} de ${total} telas.`,
    more: (n) => ` e mais ${n}`,
    pageText: (list) => `Ainda com o texto da página (marcadas "texto da página" no relatório): ${list}`,
  },
  es: {
    usingLogin: "(usando la sesión guardada)",
    saving: (dir) => `Guardando en ${dir} (cámbialo con --out)`,
    expired: (host, url, landed) =>
      `\n! La sesión guardada de ${host} expiró: ${url} ahora abre ${landed}.\n  Las páginas que piden iniciar sesión quedarán fuera. Para entrar de nuevo: screendocs login ${host}\n`,
    noPages: (url) => `no encontré páginas en ${url}. Ábrelo en tu navegador y revisa que cargue sin iniciar sesión y sin una prueba de "verifica que eres humano".`,
    needsLogin: (host) => ` Si pide iniciar sesión, ejecuta: screendocs login ${host}`,
    toCapture: (n) => `\n${n} página(s) para capturar`,
    done: (n) => `\nListo: ${n} capturas.`,
    report: "Informe",
    later: (host) => `Para que una IA describa las pantallas: npx screendocs describe ${host}`,
    described: (by, n, total) => `\n${by} describió ${n} de ${total} pantallas.`,
    more: (n) => ` y ${n} más`,
    pageText: (list) => `Todavía con el texto de la página (marcadas "texto de la página" en el informe): ${list}`,
  },
};
const T = () => tr(MESSAGES);

/** Saves the extra request and the documentation text with the capture, and says what was read. */
async function brief(root, config) {
  const read = await saveBrief(root, { instructions: config.instructions ?? undefined, docs: config.docs ?? undefined });
  if (read) console.log(docsSummary(read));
}

/** Describes a capture with the chosen AI and says how it went. */
async function describe(config, root) {
  const r = config.describe === "chat" ? await chatFlow(root) : await describeWith(config.describe, root, config);
  printDescribed(r);
  return r;
}

/** "Claude Code described 18 of 20 screens", plus the screens still without an AI description. */
function printDescribed(r) {
  const t = T();
  console.log(t.described(r.by, r.updated, r.total));
  if (r.missing.length) {
    const shown = r.missing.slice(0, 10).join(", ") + (r.missing.length > 10 ? t.more(r.missing.length - 10) : "");
    console.log(t.pageText(shown));
  }
}

function openFile(file) {
  const [cmd, args] =
    process.platform === "win32" ? ["cmd", ["/c", "start", "", file]] : [process.platform === "darwin" ? "open" : "xdg-open", [file]];
  spawn(cmd, args, { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
}

/** Stops before opening the browser when the address does not answer, saying what may be missing. */
async function mustOpen(url) {
  const r = await checkUrl(url);
  if (r.ok) {
    const to = new URL(r.final).host;
    if (to !== new URL(url).host) console.log(pc.dim(tr(URL_TEXT).moved(short(url), to)));
    return;
  }
  throw new Error(tr(URL_TEXT).cliFail(short(url), r.reason, r.suggestions.map((s) => s.replace(/^https:\/\//, "").replace(/\/$/, ""))));
}

/**
 * "describe" with a site that has no capture (or none at all): lists the captures there are.
 * In a terminal the person picks one; otherwise the list goes in the error.
 */
async function pickCapture(target, out = "screendocs-output") {
  const all = listCaptures(out);
  const t = tr({
    en: {
      none: (x) => (x ? `No capture found for "${x}".` : "Which capture should be described?"),
      empty: `There are no captures in ${out} yet. Capture a site first: npx screendocs <site>`,
      pick: "Which capture should be described?",
      list: "Captures there are:",
      screens: (n) => `${n} screen(s)`,
    },
    pt: {
      none: (x) => (x ? `Não achei captura de "${x}".` : "Qual captura descrever?"),
      empty: `Ainda não há capturas em ${out}. Capture um site primeiro: npx screendocs <site>`,
      pick: "Qual captura descrever?",
      list: "Capturas que existem:",
      screens: (n) => `${n} tela(s)`,
    },
    es: {
      none: (x) => (x ? `No encontré una captura de "${x}".` : "¿Qué captura describir?"),
      empty: `Todavía no hay capturas en ${out}. Captura un sitio primero: npx screendocs <sitio>`,
      pick: "¿Qué captura describir?",
      list: "Capturas que hay:",
      screens: (n) => `${n} pantalla(s)`,
    },
  });
  if (!all.length) throw new Error(`${target ? t.none(target) + " " : ""}${t.empty}`);
  const label = (c) => `${c.name}  ${pc.dim(`${new Date(c.createdAt).toLocaleString()} · ${t.screens(c.screens)}`)}`;
  if (!process.stdin.isTTY) {
    throw new Error(`${t.none(target)}\n${t.list}\n${all.map((c) => `  ${c.name}  (${new Date(c.createdAt).toLocaleString()})`).join("\n")}`);
  }
  if (target) p.log.warn(t.none(target));
  const root = await p.select({ message: t.pick, options: all.map((c) => ({ value: c.root, label: label(c) })) });
  if (p.isCancel(root)) process.exit(0);
  return root;
}

/** screendocs keys set|list|remove: API keys kept in the user's folder, outside any project. */
async function keysCommand(action, id) {
  const names = PROVIDERS.filter((x) => !x.local).map((x) => x.id).join(", ");
  const t = tr({
    en: {
      saved: (list) => `Saved keys (${KEYS_FILE}): ${list}`,
      none: `No saved keys. Save one with: npx screendocs keys set <${names}>`,
      use: `use: screendocs keys set <provider>, keys remove <provider> or keys list. Providers: ${names}`,
      removed: (n) => `${n} key removed.`,
      notThere: (n) => `There was no saved ${n} key.`,
      tty: "keys set asks for the key without showing it, so it needs a terminal",
      stores: { keychain: "system keychain", encrypted: "encrypted with your Windows account", file: "in the file" },
    },
    pt: {
      saved: (list) => `Chaves guardadas (${KEYS_FILE}): ${list}`,
      none: `Nenhuma chave guardada. Guarde uma com: npx screendocs keys set <${names}>`,
      use: `use: screendocs keys set <provedor>, keys remove <provedor> ou keys list. Provedores: ${names}`,
      removed: (n) => `Chave do ${n} removida.`,
      notThere: (n) => `Não havia chave do ${n} guardada.`,
      tty: "o keys set pede a chave sem mostrá-la, então precisa de um terminal",
      stores: { keychain: "cofre de senhas do sistema", encrypted: "criptografada com a sua conta do Windows", file: "no arquivo" },
    },
    es: {
      saved: (list) => `Claves guardadas (${KEYS_FILE}): ${list}`,
      none: `No hay claves guardadas. Guarda una con: npx screendocs keys set <${names}>`,
      use: `uso: screendocs keys set <proveedor>, keys remove <proveedor> o keys list. Proveedores: ${names}`,
      removed: (n) => `Clave de ${n} eliminada.`,
      notThere: (n) => `No había una clave de ${n} guardada.`,
      tty: "keys set pide la clave sin mostrarla, así que necesita una terminal",
      stores: { keychain: "llavero del sistema", encrypted: "cifrada con tu cuenta de Windows", file: "en el archivo" },
    },
  });
  if (action === "list") {
    const saved = Object.entries(savedKeys());
    console.log(saved.length ? t.saved(saved.map(([id, entry]) => `${id} (${t.stores[storeOf(entry)]})`).join(", ")) : t.none);
    return;
  }
  const provider = id && providerById(id);
  if (!["set", "remove"].includes(action) || !provider || provider.local) throw new Error(t.use);
  if (action === "remove") {
    console.log(removeKey(provider.id) ? t.removed(provider.name) : t.notThere(provider.name));
    return;
  }
  if (!process.stdin.isTTY) throw new Error(t.tty);
  await askKey(provider, { save: true });
}
