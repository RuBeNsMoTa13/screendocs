import fs from "node:fs";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.mjs";
import { discover } from "./discover.mjs";
import { capture } from "./capture.mjs";
import { writeReport, writeForAi, primaryScreens, aiName, langName } from "./report.mjs";
import { findCapture, applyItems } from "./answers.mjs";
import { launch, ensureVideoEncoder } from "./browser.mjs";
import { openLogin, saveLogin } from "./login.mjs";
import { authFile, normalizeUrl } from "./paths.mjs";
import { sessionStatus } from "./session.mjs";

/**
 * `screendocs mcp`: screendocs as tools for AI clients (Claude Code, Cursor, Claude Desktop,
 * VS Code...). The client's AI captures a site, looks at the screenshots and writes the
 * descriptions itself, so no API key is needed.
 *
 * stdout carries the protocol, so everything screendocs prints goes to stderr; while a
 * tool runs, those lines also go to the client as progress, which keeps long captures alive.
 */

const INSTRUCTIONS = `screendocs captures every screen of a website with the Chrome or Edge installed on this computer: one screenshot per section of each page, on desktop and mobile, plus a full-page image and a scrolling video, with emails, phones and form fields blurred. It writes a report (index.html) and screens.json.

To document a site: call capture_site, then get_capture to list the screens, look at them with view_screens (or read the image files directly if you can), and save a title and description for each screen with save_descriptions. Only the first viewport (usually desktop) is described; the other viewports get the same texts automatically.

For pages behind a login: call login, ask the person to log in in the window that opens, then call save_login once they say they are done. Later captures of that site reuse the session.`;

const MAX_IMAGES = 10;

export async function startMcp({ dir } = {}) {
  console.log = console.info = (...args) => console.error(...args);
  if (dir) {
    // The Claude Desktop extension suggests a folder that may not exist yet
    fs.mkdirSync(path.resolve(dir), { recursive: true });
    process.chdir(path.resolve(dir));
  }

  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const server = new McpServer({ name: "screendocs", version: pkg.version }, { instructions: INSTRUCTIONS });

  server.registerTool(
    "capture_site",
    {
      title: "Capture a website",
      description:
        "Finds the pages of a website by following its links (or uses the given paths) and captures each one: a screenshot per section, a full-page image and a scrolling video, on desktop and mobile. Uses the saved login of the site, if any. Takes from one to several minutes. Replaces the previous capture of the same site unless keep is true. Returns the capture folder and the screens to describe.",
      inputSchema: {
        url: z.string().describe("The site, e.g. mysite.com or https://mysite.com/app"),
        pages: z.array(z.string()).optional().describe("Capture exactly these paths (e.g. ['/', '/pricing']) instead of following links"),
        exclude: z.array(z.string()).optional().describe("Skip URLs containing any of these texts, e.g. ['/admin']"),
        viewports: z.array(z.enum(["desktop", "mobile"])).optional().describe("Default: desktop and mobile"),
        maxPages: z.number().int().positive().optional().describe("Pages to discover (default 20)"),
        depth: z.number().int().nonnegative().optional().describe("Link depth from the start page (default 3)"),
        video: z.boolean().optional().describe("Record a video scrolling each page (default true; false is faster)"),
        keep: z.boolean().optional().describe("Keep the previous capture, renamed with its date"),
        mask: z.array(z.string()).optional().describe("Extra CSS selectors to blur"),
        autoMask: z.boolean().optional().describe("Blur emails, phones, CPF/CNPJ and form fields (default true)"),
        lang: z.string().optional().describe("Language of the descriptions, e.g. en, pt (default en)"),
        out: z.string().optional().describe("Output folder (default screendocs-output)"),
      },
    },
    tool(async (args, extra) => {
      if (busy) throw new Error("a capture is already running; wait for it to finish");
      busy = true;
      try {
        return await captureSite(args, extra);
      } finally {
        busy = false;
      }
    }),
  );

  server.registerTool(
    "list_captures",
    {
      title: "List captures",
      description: "Lists the sites already captured in the output folder, with their date and how many screens are described.",
      inputSchema: { out: z.string().optional().describe("Output folder (default screendocs-output)") },
    },
    tool(async ({ out = "screendocs-output" }) => {
      const base = path.resolve(out);
      const dirs = fs.existsSync(base) ? fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()) : [];
      const list = dirs
        .map((d) => path.join(base, d.name))
        .filter((d) => fs.existsSync(path.join(d, "screens.json")))
        .map((root) => {
          const data = readData(root);
          const screens = primaryScreens(data);
          return {
            site: data.site,
            folder: root,
            capturedAt: data.createdAt,
            pages: data.pages.length,
            screens: screens.length,
            described: screens.filter((s) => s.describedBy).length,
            report: path.join(root, "index.html"),
          };
        });
      return list.length ? list : `No captures in ${base}. Capture a site with capture_site.`;
    }),
  );

  server.registerTool(
    "get_capture",
    {
      title: "Get the screens of a capture",
      description:
        "The pages and screens of a capture: for each screen to describe, its file (relative, used by view_screens and save_descriptions), the absolute path of the image, the page, the section heading and the current title and description (taken from the page until an AI describes it).",
      inputSchema: {
        site: z.string().describe("The site (e.g. mysite.com), its URL or the capture folder"),
        onlyMissing: z.boolean().optional().describe("Only the screens no AI has described yet"),
        out: z.string().optional().describe("Output folder (default screendocs-output)"),
      },
    },
    tool(async ({ site, onlyMissing, out }) => {
      const root = findCapture(site, out);
      return captureInfo(root, readData(root), { onlyMissing });
    }),
  );

  server.registerTool(
    "view_screens",
    {
      title: "View screenshots",
      description: `Returns the images of up to ${MAX_IMAGES} screens of a capture, to look at before describing them. Use the file names from get_capture (e.g. desktop/home/01.jpg). full.jpg of a page folder also works.`,
      inputSchema: {
        site: z.string().describe("The site, its URL or the capture folder"),
        files: z.array(z.string()).min(1).max(MAX_IMAGES).describe("File names from get_capture"),
        out: z.string().optional().describe("Output folder (default screendocs-output)"),
      },
    },
    async ({ site, files, out }) => {
      try {
        const root = findCapture(site, out);
        const content = [];
        for (const f of files) {
          const file = path.resolve(root, relative(root, f));
          if (!file.startsWith(root + path.sep) || !/\.jpe?g$/i.test(file) || !fs.existsSync(file)) {
            content.push({ type: "text", text: `${f}: not found in this capture` });
            continue;
          }
          content.push({ type: "text", text: relative(root, file) });
          content.push({ type: "image", data: fs.readFileSync(file).toString("base64"), mimeType: "image/jpeg" });
        }
        return { content };
      } catch (err) {
        return failure(err);
      }
    },
  );

  server.registerTool(
    "save_descriptions",
    {
      title: "Save screen descriptions",
      description:
        "Saves a title and a description for screens of a capture into screens.json and the report (index.html). Describe what the user sees and can do on each screen, based only on what is visible. Can be called several times, a few screens at a time. Mobile screens of the same section get the same text automatically.",
      inputSchema: {
        site: z.string().describe("The site, its URL or the capture folder"),
        items: z
          .array(
            z.object({
              file: z.string().describe("File name from get_capture, e.g. desktop/home/01.jpg"),
              title: z.string().describe("2 to 6 words"),
              description: z.string().describe("One or two sentences"),
            }),
          )
          .min(1),
        describedBy: z.string().optional().describe("Who wrote them, shown in the report, e.g. Claude Code, Cursor (default: the AI client's name)"),
        out: z.string().optional().describe("Output folder (default screendocs-output)"),
      },
    },
    tool(async ({ site, items, describedBy, out }) => {
      const root = findCapture(site, out);
      const by = describedBy || clientName(server) || "AI (MCP)";
      const r = applyItems(root, items.map((i) => ({ ...i, file: relative(root, i.file) })), by);
      const known = new Set(primaryScreens(readData(root)).map((s) => s.file));
      const named = new Set([...known].map(aiName));
      const unknown = items.map((i) => relative(root, i.file)).filter((f) => !known.has(f) && !named.has(f));
      return {
        saved: r.updated,
        ...(unknown.length ? { notFound: unknown } : {}),
        described: r.total - r.missing.length,
        total: r.total,
        stillMissing: r.missing,
        report: r.report,
      };
    }),
  );

  server.registerTool(
    "login",
    {
      title: "Log in to a site",
      description:
        "Opens a browser window on the site for the person to log in (Google login works). After calling it, ask the person to log in in that window and tell you when they are done, then call save_login. Needed only for sites with pages behind a login.",
      inputSchema: { url: z.string().describe("The login page or the site, e.g. mysite.com/login") },
    },
    tool(async ({ url }) => {
      if (pendingLogin) await pendingLogin.browser.close().catch(() => {});
      pendingLogin = await openLogin(normalizeUrl(url));
      return `A browser window is open on ${pendingLogin.url}. Ask the person to log in there and tell you when they are done, then call save_login. Do not ask for their password.`;
    }),
  );

  server.registerTool(
    "save_login",
    {
      title: "Save the login",
      description: "Saves the session of the window opened by login and closes it. Later captures of that site reuse it.",
      inputSchema: {},
    },
    tool(async () => {
      if (!pendingLogin) throw new Error("no login window is open; call login first");
      const session = pendingLogin;
      pendingLogin = null;
      const file = await saveLogin(session).catch((err) => {
        session.browser.close().catch(() => {});
        throw /closed/i.test(err.message) ? new Error("the login window was closed before saving; call login again") : err;
      });
      return `Session for ${session.host} saved to ${path.resolve(file)}. It gives access to the account: keep it private. Captures of ${session.host} now include the pages behind the login.`;
    }),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  const close = async () => {
    await pendingLogin?.browser.close().catch(() => {});
    process.exit(0);
  };
  process.stdin.on("close", close);
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
  console.error(`screendocs MCP server running (folder: ${process.cwd()})`);
}

let busy = false;
let pendingLogin = null;
/** Set while a tool runs: lines printed by screendocs become progress notifications. */
let report = null;

async function captureSite(args, extra) {
  const config = loadConfig(normalizeUrl(args.url), {
    pages: args.pages?.join(","),
    exclude: args.exclude?.join(","),
    viewports: args.viewports?.join(","),
    "max-pages": args.maxPages,
    depth: args.depth,
    video: args.video,
    keep: args.keep,
    mask: args.mask?.join(","),
    "no-auto-mask": args.autoMask === false,
    lang: args.lang,
    out: args.out,
  });
  const start = new URL(config.url);
  const auth = authFile(start.host);
  const storageState = fs.existsSync(auth) ? auth : undefined;
  const notes = [];

  const browser = await launch({ headless: true });
  const stop = () => browser.close().catch(() => {});
  extra.signal?.addEventListener("abort", stop);
  report = progress(extra);
  try {
    if (storageState) {
      const s = await sessionStatus(browser, start.host);
      if (s.state === "expired") notes.push(`The saved login for ${start.host} has expired (${s.checkUrl} now opens ${s.landed}), so pages behind it were missed. Call login to log in again.`);
      else notes.push(`Used the saved login for ${start.host}.`);
    }
    const pages = await discover(browser, config, storageState);
    if (!pages.length) throw new Error(`no pages found at ${config.url}`);
    console.log(`${pages.length} page(s) to capture`);
    if (config.video) await ensureVideoEncoder(browser);
    const result = await capture(browser, config, pages, storageState, (partial) => writeReport(partial, config));
    writeReport(result, config);
    writeForAi(result.root);
    return { ...captureInfo(result.root, readData(result.root)), ...(notes.length ? { notes } : {}) };
  } finally {
    report = null;
    extra.signal?.removeEventListener("abort", stop);
    await stop();
  }
}

/** Sends each line screendocs prints as a progress notification, when the client asked for progress. */
function progress(extra) {
  const token = extra._meta?.progressToken;
  if (token === undefined) return null;
  let n = 0;
  return (message) =>
    extra.sendNotification({ method: "notifications/progress", params: { progressToken: token, progress: ++n, message } }).catch(() => {});
}

const toStderr = console.error.bind(console);
console.error = (...args) => {
  toStderr(...args);
  const line = args.join(" ").trim();
  if (report && line) report(line);
};

function captureInfo(root, data, { onlyMissing = false } = {}) {
  const screens = primaryScreens(data);
  const toDescribe = screens.filter((s) => !onlyMissing || !s.describedBy);
  return {
    site: data.site,
    url: data.url,
    capturedAt: data.createdAt,
    folder: root,
    report: path.join(root, "index.html"),
    language: data.lang,
    viewports: data.viewports,
    described: screens.length - screens.filter((s) => !s.describedBy).length,
    total: screens.length,
    pages: data.pages.map((p) => ({
      url: p.url,
      title: p.title,
      full: Object.fromEntries(Object.entries(p.viewports).filter(([, v]) => v.full).map(([vp, v]) => [vp, v.full])),
      video: Object.fromEntries(Object.entries(p.viewports).filter(([, v]) => v.video).map(([vp, v]) => [vp, path.join(root, v.video)])),
    })),
    screens: toDescribe.map((s) => ({
      file: s.file,
      path: path.join(root, s.file),
      page: s.page,
      heading: s.heading || undefined,
      title: s.title,
      description: s.description,
      describedBy: s.describedBy,
    })),
    next: `Look at each screen (view_screens, or read its path) and save a title and description in ${langName(data.lang)} with save_descriptions.`,
  };
}

const readData = (root) => JSON.parse(fs.readFileSync(path.join(root, "screens.json"), "utf8"));

/** "C:\...\mysite.com\desktop\home\01.jpg" or "desktop\home\01.jpg" -> "desktop/home/01.jpg" */
function relative(root, file) {
  const f = String(file).trim();
  return (path.isAbsolute(f) ? path.relative(root, f) : f).replace(/\\/g, "/").replace(/^\.\//, "");
}

/** "Claude Code", "Cursor"... from the client's handshake, for the report badge. */
function clientName(server) {
  const n = server.server.getClientVersion()?.name ?? "";
  const known = { "claude-code": "Claude Code", "claude-ai": "Claude", cursor: "Cursor", "cursor-vscode": "Cursor", "Visual Studio Code": "VS Code" };
  return known[n] ?? n;
}

/** Wraps a handler: its result becomes text (JSON for objects), an error becomes an error result. */
function tool(handler) {
  return async (args, extra) => {
    try {
      const out = await handler(args, extra);
      return { content: [{ type: "text", text: typeof out === "string" ? out : JSON.stringify(out, null, 2) }] };
    } catch (err) {
      return failure(err);
    }
  };
}

const failure = (err) => ({ isError: true, content: [{ type: "text", text: `screendocs: ${err.message}` }] });
