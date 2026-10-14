import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { primaryScreens, task } from "./report.mjs";
import { parseAnswer, applyItems } from "./answers.mjs";

/**
 * Two ways to describe the screens automatically (the third, an AI chat in the browser, is chat.mjs):
 * - an AI tool already installed and logged in on the computer (Claude Code, Codex, Antigravity), which
 *   runs on the person's own plan with no API key;
 * - "api": any provider with an OpenAI-compatible API (OpenAI, Gemini, OpenRouter, Anthropic,
 *   Ollama...), called with fetch, so no SDK is installed.
 */
export const AGENTS = {
  claude: { name: "Claude Code", bin: "claude" },
  codex: { name: "Codex", bin: "codex" },
  antigravity: { name: "Antigravity", bin: "agy" },
};

/** OpenAI-compatible endpoints of common providers, offered in the menu. */
export const PROVIDERS = [
  { name: "OpenAI", url: "https://api.openai.com/v1" },
  { name: "Google Gemini", url: "https://generativelanguage.googleapis.com/v1beta/openai" },
  { name: "OpenRouter", url: "https://openrouter.ai/api/v1" },
  { name: "Anthropic", url: "https://api.anthropic.com/v1" },
  { name: "Ollama (local)", url: "http://localhost:11434/v1", local: true },
];

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
  return Object.keys(AGENTS).filter(
    (k) => spawnSync(...cmd(AGENTS[k].bin, ["--version"], { stdio: "ignore", timeout: 20_000 })).status === 0,
  );
}

export function checkAgent(agent, config = {}) {
  if (agent === "api") {
    if (!config.apiUrl || !config.model) throw new Error("--describe api needs --api-url and --model (the key goes in SCREENDOCS_API_KEY)");
    return;
  }
  if (agent === "chat") {
    if (!process.stdin.isTTY) throw new Error("--describe chat is step by step, so it needs a terminal you can type in");
    return;
  }
  if (!AGENTS[agent]) throw new Error(`--describe accepts ${[...Object.keys(AGENTS), "api", "chat"].join(", ")}`);
  if (!installedAgents().includes(agent)) {
    throw new Error(`${AGENTS[agent].name} was not found. Install it and log in, or use --describe chat (an AI chat in your browser).`);
  }
}

export async function describeWith(agent, root, config) {
  const data = JSON.parse(fs.readFileSync(path.join(root, "screens.json"), "utf8"));
  const screens = primaryScreens(data);
  if (agent === "api") return applyItems(root, await describeWithApi(data, root, screens, config), `${config.model} (API)`);

  const docsDir = config.docs ? path.resolve(config.docs) : "";
  console.log(`\nDescribing ${screens.length} screen(s) with ${AGENTS[agent].name}...`);

  const items = [];
  for (let i = 0; i < screens.length; i += BATCH) {
    const batch = screens.slice(i, i + BATCH);
    const file = `.screendocs-task-${i / BATCH + 1}.md`;
    fs.writeFileSync(path.join(root, file), task(data, batch, "image file listed below (open it from this folder)", docsDir));
    process.stdout.write(`  ${i + 1}-${i + batch.length} of ${screens.length}... `);
    try {
      const answer = parseAnswer(await run(agent, root, file, batch, docsDir));
      if (answer) items.push(...answer);
      console.log(answer ? "ok" : "no JSON in the answer, skipped");
    } catch (err) {
      console.log(`failed: ${err.message}`);
    } finally {
      fs.rmSync(path.join(root, file), { force: true });
    }
  }
  return applyItems(root, items, AGENTS[agent].name);
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
        : [...(docsDir ? ["--add-dir", q(docsDir)] : []), "--print-timeout", "15m", "-p", q(ask)];

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
      if (fs.existsSync(outFile)) {
        out = fs.readFileSync(outFile, "utf8");
        fs.rmSync(outFile, { force: true });
      }
      if (code === 0) resolve(out);
      else reject(new Error((err || out).trim().split("\n").slice(-1)[0] || `exit code ${code}`));
    });
  });
}

/** One request per screen, 4 at a time, to an OpenAI-compatible /chat/completions. */
async function describeWithApi(data, root, screens, config) {
  const key = config.apiKey || process.env.SCREENDOCS_API_KEY || "";
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
