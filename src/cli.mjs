import { parseArgs } from "node:util";
import { loadConfig } from "./config.mjs";
import { login } from "./login.mjs";
import { discover } from "./discover.mjs";
import { capture } from "./capture.mjs";
import { describeWith, checkAgent } from "./agents.mjs";
import { writeReport, writeForAi } from "./report.mjs";
import { findCapture } from "./answers.mjs";
import { chatFlow } from "./chat.mjs";
import { launch, ensureVideoEncoder } from "./browser.mjs";
import { authFile, normalizeUrl } from "./paths.mjs";
import { checkUrl, URL_TEXT, short } from "./checkurl.mjs";
import { sessionStatus } from "./session.mjs";
import { interactive, banner, chooseDescriber, uiLang } from "./interactive.mjs";
import pc from "./theme.mjs";
import * as p from "@clack/prompts";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const HELP = `screendocs: screenshot, record and document every screen of a website.

Usage
  npx screendocs                       interactive menu
  npx screendocs <url> [options]       capture the site
  npx screendocs login <url>           log in once; later runs reuse the session
  npx screendocs describe <site>       describe the screens of a capture you already made
  npx screendocs mcp [--dir <folder>]  MCP server for AI clients (Claude Code, Cursor...); see the README

Options
  --max-pages <n>       pages to discover (default 20)
  --depth <n>           link depth from the start page (default 3)
  --pages <a,b,c>       capture exactly these paths instead of discovering
  --exclude <a,b>       skip URLs containing any of these texts
  --viewports <list>    desktop, mobile or both (default desktop,mobile)
  --no-video            do not record the scroll videos
  --out <dir>           output folder (default screendocs-output)
  --keep                keep the previous capture (renamed with its date) instead of replacing it
  --mask <selectors>    extra CSS selectors to hide, comma separated
  --no-auto-mask        do not hide emails, phones, CPF/CNPJ and form inputs
  --describe <how>      who writes the descriptions:
                          claude, codex, antigravity
                                an AI tool installed and logged in here (uses your plan)
                          api   any OpenAI-compatible API (needs --api-url and --model)
                          chat  an AI chat in your browser, step by step (ChatGPT, Gemini...)
  --api-url <url>       e.g. https://api.openai.com/v1, http://localhost:11434/v1 (Ollama)
  --model <id>          model for --describe api
  --api-key <key>       API key (better: the SCREENDOCS_API_KEY environment variable)
  --docs <dir>          project docs the AI reads when describing
  --lang <code>         description language (default en)
  --config <file>       config file (default screendocs.config.json if present)
  --headed              show the browser while capturing
  --no-url-check        do not check that the address opens before starting
  --open                open the report when done
  -v, --version         show the version
  -h, --help            show this help
`;

export async function run(argv) {
  // Before anything prints: under an AI client, stdout carries the MCP protocol
  if (argv[0] === "mcp") {
    const { values } = parseArgs({ args: argv.slice(1), options: { dir: { type: "string" } } });
    const { startMcp } = await import("./mcp.mjs");
    return startMcp(values);
  }
  // No arguments in a real terminal: show the menu instead of the help
  const fromMenu = argv.length === 0 && process.stdin.isTTY && process.stdout.isTTY;
  if (fromMenu) argv = await interactive();
  else if (process.stdout.isTTY && !argv.some((x) => ["-h", "--help", "-v", "--version"].includes(x))) banner();
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
      out: { type: "string" },
      keep: { type: "boolean" },
      mask: { type: "string" },
      "no-auto-mask": { type: "boolean" },
      "no-url-check": { type: "boolean" },
      describe: { type: "string" },
      docs: { type: "string" },
      "api-url": { type: "string" },
      "api-key": { type: "string" },
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
    console.log(HELP);
    return;
  }

  if (positionals[0] === "apply") throw new Error("apply was replaced by: screendocs describe <site> (choose \"A chat in your browser\")");

  if (positionals[0] === "describe") {
    if (!positionals[1]) throw new Error("use: screendocs describe <site>");
    const root = findCapture(positionals[1], values.out);
    const data = JSON.parse(fs.readFileSync(path.join(root, "screens.json"), "utf8"));
    let open = values.open;
    if (!values.describe) {
      if (!process.stdin.isTTY) throw new Error("choose who describes: --describe claude, codex, antigravity, api or chat");
      p.intro(`${data.site} · ${new Date(data.createdAt).toLocaleString()}`);
      const how = await chooseDescriber();
      Object.assign(values, { describe: how.describe, "api-url": how.apiUrl, model: how.model });
      open = true;
    }
    const config = loadConfig(data.url, { ...values, lang: values.lang ?? data.lang });
    if (values.lang && values.lang !== data.lang) {
      data.lang = values.lang;
      fs.writeFileSync(path.join(root, "screens.json"), JSON.stringify(data, null, 2) + "\n");
    }
    checkAgent(config.describe, config);
    const r = await describe(config, root);
    console.log(`Report: ${r.report}`);
    if (open) openFile(r.report);
    return;
  }

  if (positionals[0] === "login") {
    if (!positionals[1]) throw new Error("use: screendocs login <url>");
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
  console.log(`screendocs ${start.href}${storageState ? " (using saved login)" : ""}`);

  if (config.describe) checkAgent(config.describe, config);
  const browser = await launch({ headless: !config.headed });
  try {
    if (storageState) {
      const s = await sessionStatus(browser, start.host);
      if (s.state === "expired") {
        console.log(
          `\n! The saved login for ${start.host} has expired: ${s.checkUrl} now opens ${s.landed}.` +
            `\n  Pages behind the login will be missed. To log in again: screendocs login ${start.host}\n`,
        );
      }
    }
    const pages = await discover(browser, config, storageState);
    if (!pages.length) {
      throw new Error(
        `no pages found at ${start.href}. Open it in your browser and check that it loads without a login or a "verify you are human" check.` +
          (storageState ? "" : " If it needs a login, run: screendocs login " + start.host),
      );
    }
    console.log(`\n${pages.length} page(s) to capture`);
    if (config.video) await ensureVideoEncoder(browser);
    // The report is rewritten after every page, so stopping halfway still leaves one
    const result = await capture(browser, config, pages, storageState, (partial) => writeReport(partial, config));
    let report = writeReport(result, config);
    writeForAi(result.root);
    // Closed first: the chat step can take a while and does not need it
    await browser.close();
    console.log(`\nDone: ${result.screens.length} screenshots.`);
    if (config.describe) report = (await describe(config, result.root)).report;
    console.log(`Report: ${report}`);
    if (!config.describe) {
      console.log(`To have an AI describe the screens: npx screendocs describe ${start.host}`);
    }
    if (values.open) openFile(report);
  } finally {
    await browser.close();
  }
}

/** Describes a capture with the chosen AI and says how it went. */
async function describe(config, root) {
  const r = config.describe === "chat" ? await chatFlow(root) : await describeWith(config.describe, root, config);
  printDescribed(r);
  return r;
}

/** "Claude Code described 18 of 20 screens", plus the screens still without an AI description. */
function printDescribed(r) {
  console.log(`\n${r.by} described ${r.updated} of ${r.total} screens.`);
  if (r.missing.length) {
    const shown = r.missing.slice(0, 10).join(", ") + (r.missing.length > 10 ? ` and ${r.missing.length - 10} more` : "");
    console.log(`Still with the text from the page (marked "page text" in the report): ${shown}`);
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
    if (to !== new URL(url).host) console.log(pc.dim(URL_TEXT[uiLang()].moved(short(url), to)));
    return;
  }
  throw new Error(URL_TEXT[uiLang()].cliFail(short(url), r.reason, r.suggestions.map((s) => s.replace(/^https:\/\//, "").replace(/\/$/, ""))));
}
