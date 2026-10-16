import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { primaryScreens, task } from "./report.mjs";
import { parseAnswer, applyItems, sameFile } from "./answers.mjs";
import { resolveModel, findKey, checkLocal, KEYS_FILE } from "./providers.mjs";

/**
 * Two ways to describe the screens automatically (the third, an AI chat in the browser, is chat.mjs):
 * - an AI tool already installed and logged in on the computer (Claude Code, Codex, Antigravity CLI), which
 *   runs on the person's own plan with no API key;
 * - "api": any provider with an OpenAI-compatible API (OpenAI, Gemini, OpenRouter, Anthropic,
 *   Ollama...), called with fetch, so no SDK is installed.
 */
export const AGENTS = {
  claude: {
    name: "Claude Code",
    bin: "claude",
    install: { win: "irm https://claude.ai/install.ps1 | iex", unix: "curl -fsSL https://claude.ai/install.sh | bash" },
    login: "claude",
  },
  codex: {
    name: "Codex",
    bin: "codex",
    install: { win: "npm install -g @openai/codex", unix: "npm install -g @openai/codex" },
    login: "codex login",
  },
  antigravity: {
    name: "Antigravity CLI",
    bin: "agy",
    install: { win: "irm https://antigravity.google/cli/install.ps1 | iex", unix: "curl -fsSL https://antigravity.google/cli/install.sh | bash" },
    login: "agy",
  },
};

/** The official install command of a tool, for this system (PowerShell on Windows). */
export const installCommand = (agent) => AGENTS[agent].install[WIN ? "win" : "unix"];

/**
 * Runs the official installer in this terminal, so the person sees it working. A new install
 * goes on the PATH of new terminals only, so the new PATH is read back here too.
 */
export function installAgent(agent) {
  const line = installCommand(agent);
  WIN
    ? spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", line], { stdio: "inherit" })
    : spawnSync("sh", ["-c", line], { stdio: "inherit" });
  pathRead = false;
  findInstalled();
  // Some installers exit with an error when the tool is already there: what counts is finding it
  return installedAgents().includes(agent);
}

/**
 * A tool installed in another terminal, or by the installer just now, is only on the PATH of
 * terminals opened afterwards. This adds the folders where the official installers put the
 * tools (Claude Code: ~/.local/bin; Codex: the npm folder; Antigravity CLI: %LOCALAPPDATA%\agy\bin)
 * and, on Windows, the PATH saved for new terminals.
 */
let pathRead = false;
function findInstalled() {
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const dirs = [path.join(home, ".local", "bin")];
  if (WIN) {
    if (process.env.LOCALAPPDATA) dirs.push(path.join(process.env.LOCALAPPDATA, "agy", "bin"));
    if (process.env.APPDATA) dirs.push(path.join(process.env.APPDATA, "npm"));
  }
  addToPath(dirs);
  if (pathRead) return;
  pathRead = true;
  if (WIN) {
    const r = spawnSync(
      "powershell",
      ["-NoProfile", "-Command", "[Environment]::GetEnvironmentVariable('Path','User'); [Environment]::GetEnvironmentVariable('Path','Machine')"],
      { encoding: "utf8", timeout: 20_000 },
    );
    addToPath(String(r.stdout ?? "").split(/[;\r\n]+/).map((d) => d.replace(/%([^%]+)%/g, (m, v) => process.env[v] ?? m)));
  } else {
    const npmPrefix = spawnSync("npm", ["prefix", "-g"], { encoding: "utf8", timeout: 20_000 }).stdout?.trim();
    if (npmPrefix) addToPath([path.join(npmPrefix, "bin")]);
  }
}

function addToPath(dirs) {
  const have = new Set(String(process.env.PATH ?? "").split(path.delimiter).map((d) => d.toLowerCase()));
  const add = dirs.filter((d) => d && !have.has(d.toLowerCase()) && fs.existsSync(d));
  if (add.length) process.env.PATH = [process.env.PATH, ...add].join(path.delimiter);
}

export { PROVIDERS } from "./providers.mjs";

const WIN = process.platform === "win32";
const BATCH = 10; // screens per run, so each run stays small
const TIMEOUT = 15 * 60_000;

/**
 * On Windows the tools are .cmd launchers that need a shell. Node warns (DEP0190) when an
 * argument list goes with shell: true, so there the command goes as one already-quoted line.
 */
function cmd(bin, args, opts) {
  return WIN ? [[bin, ...args].join(" "), [], { ...opts, shell: true }] : [bin, args, opts];
}

/** The AI tools found on this computer. */
export function installedAgents() {
  const found = () =>
    Object.keys(AGENTS).filter((k) => spawnSync(...cmd(AGENTS[k].bin, ["--version"], { stdio: "ignore", timeout: 20_000 })).status === 0);
  let list = found();
  if (list.length < Object.keys(AGENTS).length && !pathRead) {
    findInstalled();
    list = found();
  }
  return list;
}

export async function checkAgent(agent, config = {}) {
  if (agent === "api") return prepareApi(config);
  if (agent === "chat") {
    if (!process.stdin.isTTY) throw new Error("--describe chat is step by step, so it needs a terminal you can type in");
    return;
  }
  if (!AGENTS[agent]) throw new Error(`--describe accepts ${[...Object.keys(AGENTS), "api", "chat"].join(", ")}`);
  if (!installedAgents().includes(agent)) {
    throw new Error(
      `${AGENTS[agent].name} was not found. Install it with: ${installCommand(agent)}` +
        `\nthen log in by running: ${AGENTS[agent].login}` +
        `\n(or use --describe chat, an AI chat in your browser)`,
    );
  }
}

/**
 * --model to an address, a model id and a key, before anything is captured. Without a key
 * and with a terminal, asks for it (hidden) and offers to save it.
 */
async function prepareApi(config) {
  if (config.provider !== undefined) return;
  const { provider, url, model, custom } = resolveModel(config.model, config.apiUrl);
  Object.assign(config, { provider, apiUrl: url, model });
  if (provider?.local) return checkLocal(provider, url, model);
  const found = findKey(provider, config.apiKey);
  if (found) {
    config.apiKey = found.key;
    return;
  }
  // A server of its own (OPENAI_BASE_URL) may have no key
  if (!provider || custom) return;
  if (process.stdin.isTTY && process.stdout.isTTY) {
    const { askKey } = await import("./interactive.mjs");
    config.apiKey = await askKey(provider);
    return;
  }
  throw new Error(
    `no API key for ${provider.name}. Set ${provider.env[0]}, or save it once with: npx screendocs keys set ${provider.id}` +
      ` (it goes to ${KEYS_FILE}, outside the project).`,
  );
}

export async function describeWith(agent, root, config) {
  const data = JSON.parse(fs.readFileSync(path.join(root, "screens.json"), "utf8"));
  const screens = primaryScreens(data);
  if (agent === "api") return applyItems(root, await describeWithApi(data, root, screens, config), `${config.model} (API)`);

  const docsDir = config.docs ? path.resolve(config.docs) : "";
  console.log(`\nDescribing ${screens.length} screen(s) with ${AGENTS[agent].name}...`);
  fs.rmSync(path.join(root, LOG), { force: true });

  const items = [];
  for (let i = 0; i < screens.length; i += BATCH) {
    const batch = screens.slice(i, i + BATCH);
    const file = `.screendocs-task-${i / BATCH + 1}.md`;
    fs.writeFileSync(path.join(root, file), task(data, batch, "image file listed below (open it from this folder)", docsDir));
    process.stdout.write(`  ${i + 1}-${i + batch.length} of ${screens.length}... `);
    try {
      const answer = parseAnswer(await run(agent, root, file, batch, docsDir)) ?? [];
      const mine = answer.filter((it) => batch.some((s) => sameFile(it?.file, s.file)));
      items.push(...mine);
      console.log(
        mine.length
          ? `ok (${mine.length} of ${batch.length})`
          : answer.length
            ? `the answer did not name the images of this batch, skipped (what it answered is in ${LOG})`
            : `no JSON in the answer, skipped (what it answered is in ${LOG})`,
      );
    } catch (err) {
      console.log(`failed: ${err.message}`);
    } finally {
      fs.rmSync(path.join(root, file), { force: true });
    }
  }
  return applyItems(root, items, AGENTS[agent].name);
}

/** The last answer of an AI tool, kept in the capture folder to see what went wrong. */
export const LOG = "screendocs-agent-log.txt";

/**
 * Antigravity CLI with --output-format json answers { status, response, ... }. An error
 * (not logged in, no quota) comes as a status, which is shown instead of "no JSON".
 */
function envelope(out, err) {
  // One JSON object, or one per line (the last one has the answer)
  const lines = out.trim().split(/\r?\n/).reverse();
  const e = [out.trim(), ...lines].map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  }).find((o) => o && typeof o === "object" && !Array.isArray(o) && ("response" in o || "status" in o || "result" in o));
  try {
    if (!e) throw null;
    if (typeof e.result === "string" && e.result.trim()) return e.result;
    if (typeof e.response === "string" && e.response.trim()) return e.response;
    if (e.status && !/^(ok|success|completed?)$/i.test(String(e.status))) throw new Error(`Antigravity CLI: ${e.error?.message ?? e.error ?? e.status}`);
  } catch (x) {
    if (x?.message?.startsWith("Antigravity CLI:")) throw x;
  }
  if (!out.trim() && err.trim()) throw new Error(err.trim().split("\n").slice(-1)[0]);
  return out;
}

function run(agent, root, file, batch, docsDir) {
  const outName = ".screendocs-answer.txt";
  const outFile = path.join(root, outName);
  // Antigravity's print mode has lost stdout when run by another program in some versions, so it also saves the answer to a file
  const ask =
    `Read ${file} in this folder and do what it says. Reply with only the JSON array.` +
    (agent === "antigravity" ? ` Also save that JSON array to ${outName} in this folder.` : "");
  // With shell (needed for the .cmd launchers on Windows) arguments with spaces must be quoted
  const q = (s) => (WIN && /[\s"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s);
  const args =
    agent === "claude"
      ? ["-p", q(ask), "--allowedTools", "Read", ...(docsDir ? ["--add-dir", q(docsDir)] : [])]
      : agent === "codex"
        ? ["exec", "--skip-git-repo-check", "--ephemeral", "-i", q(batch.map((s) => s.file).join(",")), "-o", q(outFile), q(ask)]
        : [...(docsDir ? ["--add-dir", q(docsDir)] : []), "--print-timeout", "15m", "--output-format", "json", "-p", q(ask)];

  return new Promise((resolve, reject) => {
    const child = spawn(...cmd(AGENTS[agent].bin, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] }));
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    const timer = setTimeout(() => child.kill(), TIMEOUT);
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      // Codex (and Antigravity, when asked) also write the answer to a file, which is cleaner than stdout
      // What the tool said, to see why an answer had no descriptions
      fs.appendFileSync(path.join(root, LOG), `\n$ ${AGENTS[agent].bin} ${args.join(" ")}\nexit code: ${code}\n\n--- output ---\n${out}\n\n--- errors ---\n${err}\n`);
      try {
        if (fs.existsSync(outFile)) {
          out = fs.readFileSync(outFile, "utf8");
          fs.rmSync(outFile, { force: true });
        } else if (agent === "antigravity") out = envelope(out, err);
      } catch (e) {
        return reject(e);
      }
      if (code === 0) resolve(out);
      else reject(new Error((err || out).trim().split("\n").slice(-1)[0] || `exit code ${code}`));
    });
  });
}

/** One request per screen, 4 at a time, to an OpenAI-compatible /chat/completions. */
async function describeWithApi(data, root, screens, config) {
  await prepareApi(config);
  const key = config.apiKey || "";
  const url = `${config.apiUrl.replace(/\/+$/, "")}/chat/completions`;
  const docs = config.docs ? readDocs(config.docs) : "";
  console.log(`\nDescribing ${screens.length} screen(s) with ${config.model}...`);

  const items = [];
  let done = 0;
  const queue = [...screens];
  const worker = async () => {
    for (let s; (s = queue.shift()); ) {
      const image = fs.readFileSync(path.join(root, s.file)).toString("base64");
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: "system", content: task(data, [s], "screenshot") + (docs ? `\n<documentation>\n${docs}\n</documentation>` : "") },
              {
                role: "user",
                content: [
                  { type: "text", text: `Screenshot: ${s.file}` },
                  { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } },
                ],
              },
            ],
          }),
          signal: AbortSignal.timeout(120_000),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = body.error?.message || body.message || `HTTP ${res.status}`;
          // A model that only reads text rejects the screenshot; say so in plain words
          if (/image|vision|multimodal|modalit/i.test(msg) && !/401|403/.test(String(res.status)))
            throw new Error(`${config.model} does not seem to read images. Pick a model that does (e.g. gpt-4o-mini, gemini-2.5-flash). API said: ${msg}`);
          // A wrong key fails every screen: say so once, with how to fix it
          if (res.status === 401 || res.status === 403)
            throw new Error(
              `the API refused the key (HTTP ${res.status}: ${msg}).` +
                (config.provider && !config.provider.local ? ` Save the right one with: npx screendocs keys set ${config.provider.id}` : ""),
            );
          throw new Error(msg);
        }
        const text = body.choices?.[0]?.message?.content ?? "";
        const answer = parseAnswer(text) ?? parseObject(text);
        if (answer?.length) items.push(...answer.map((a) => ({ ...a, file: s.file })));
        else console.log(`  ${s.file}: no JSON in the answer`);
      } catch (err) {
        console.log(`  ${s.file}: ${err.message}`);
        // a bad key or a model that does not read images fails every screen
        if (/401|403|api key|unauthorized|does not seem to read images/i.test(err.message)) queue.length = 0;
      }
      process.stdout.write(`\r  ${++done}/${screens.length}`);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  process.stdout.write("\n");
  return items;
}

/** Some models answer with a single object instead of an array. */
function parseObject(text) {
  try {
    const o = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    return o && typeof o === "object" ? [o] : null;
  } catch {
    return null;
  }
}

/** Markdown and text files from the docs folder, up to ~150 KB. */
function readDocs(dir) {
  if (!fs.existsSync(dir)) throw new Error(`docs folder not found: ${dir}`);
  const out = [];
  let size = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(md|mdx|txt)$/i.test(e.name) && size < 150_000) {
        const t = fs.readFileSync(p, "utf8").slice(0, 150_000 - size);
        size += t.length;
        out.push(`## ${path.relative(dir, p)}\n${t}`);
      }
    }
  };
  walk(dir);
  return out.join("\n\n");
}
