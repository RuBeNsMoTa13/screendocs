import fs from "node:fs";
import path from "node:path";
import { USER_DIR } from "./userconfig.mjs";
import { protect, reveal, forget } from "./secrets.mjs";

/**
 * Describing with an API, the way tools like llm and aider do it: the person names only the
 * model with its provider in front (--model gemini/gemini-2.5-flash, ollama/llama3.2-vision).
 * For OpenAI, Gemini and Anthropic the prefix may be left out: the name says the provider. The key comes from the provider's usual environment variable, or
 * is saved once in the user's folder. Every provider is called through its OpenAI-compatible
 * endpoint, so no SDK is installed.
 */
export const PROVIDERS = [
  { id: "openai", name: "OpenAI", url: "https://api.openai.com/v1", env: ["OPENAI_API_KEY"], match: /^(gpt-|chatgpt-|o\d)/i, example: "openai/gpt-4o-mini" },
  {
    id: "gemini",
    name: "Google Gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/openai",
    env: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    match: /^gemini/i,
    example: "gemini/gemini-2.5-flash",
  },
  { id: "anthropic", name: "Anthropic", url: "https://api.anthropic.com/v1", env: ["ANTHROPIC_API_KEY"], match: /^claude/i, example: "anthropic/claude-sonnet-4-5" },
  { id: "openrouter", name: "OpenRouter", url: "https://openrouter.ai/api/v1", env: ["OPENROUTER_API_KEY"], example: "openrouter/qwen/qwen2.5-vl-72b-instruct" },
  { id: "ollama", name: "Ollama (local)", url: "http://localhost:11434/v1", env: [], local: true, example: "ollama/llama3.2-vision" },
  { id: "lmstudio", name: "LM Studio (local)", url: "http://localhost:1234/v1", env: [], local: true, example: "lmstudio/qwen2.5-vl-7b" },
];

const ALIASES = { google: "gemini", claude: "anthropic", "lm-studio": "lmstudio" };

export const providerById = (id) => PROVIDERS.find((p) => p.id === (ALIASES[String(id).toLowerCase()] ?? String(id).toLowerCase()));

/** Another OpenAI-compatible server, the usual way: OPENAI_BASE_URL (OPENAI_API_BASE in older tools). */
export function openaiBase() {
  const u = (process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || "").trim().replace(/\/+$/, "");
  return u || null;
}

/** Ollama's own variable: "127.0.0.1:11434", "http://192.168.0.10:11434" or just a host. */
function ollamaUrl() {
  const h = process.env.OLLAMA_HOST?.trim();
  if (!h) return null;
  const withScheme = /^https?:\/\//i.test(h) ? h : `http://${h}`;
  const u = new URL(withScheme);
  if (!u.port && !/^https?:\/\/[^/]+:\d+/i.test(withScheme)) u.port = "11434";
  // 0.0.0.0 is where Ollama listens, not an address to call
  if (u.hostname === "0.0.0.0") u.hostname = "127.0.0.1";
  return `${u.origin}/v1`;
}

/**
 * The provider, address and model id of --model.
 * { provider, url, model } or an Error explaining what to type.
 */
export function resolveModel(model) {
  const full = String(model ?? "").trim();
  if (!full) throw new Error("--model is missing: say which model describes the screens (e.g. gemini/gemini-2.5-flash, openai/gpt-4o-mini, ollama/llama3.2-vision)");
  const slash = full.indexOf("/");
  const prefixed = slash > 0 ? providerById(full.slice(0, slash)) : undefined;
  const id = prefixed ? full.slice(slash + 1) : full;
  const provider = prefixed ?? PROVIDERS.find((p) => p.match?.test(id));
  if (!provider) {
    throw new Error(
      `I do not know which provider "${full}" is from. Put the provider in front of the name: ` +
        PROVIDERS.filter((p) => !p.match).map((p) => `${p.id}/${full}`).join(", ") +
        `. For another OpenAI-compatible server, use openai/${full} and set OPENAI_BASE_URL to its address.`,
    );
  }
  const url = provider.id === "ollama" ? (ollamaUrl() ?? provider.url) : provider.id === "openai" ? (openaiBase() ?? provider.url) : provider.url;
  return { provider, url, model: id, custom: provider.id === "openai" && !!openaiBase() };
}

/** ~/.screendocs/keys.json: outside any project, so it never goes to Git. */
export const KEYS_FILE = path.join(USER_DIR, "keys.json");

export function savedKeys() {
  try {
    return JSON.parse(fs.readFileSync(KEYS_FILE, "utf8"));
  } catch {
    return {};
  }
}

/** Saves a key in the system's keychain (or encrypted on Windows) when it can; see secrets.mjs. Returns the keys.json entry. */
export function saveKey(providerId, key) {
  const old = savedKeys()[providerId];
  const entry = protect(providerId, key);
  // A key that moved out of the keychain (or never got there) leaves nothing behind
  if (old && typeof entry === "string") forget(providerId, old);
  const keys = { ...savedKeys(), [providerId]: entry };
  fs.mkdirSync(path.dirname(KEYS_FILE), { recursive: true });
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2) + "\n", { mode: 0o600 });
  // mode only counts when the file is created; an older file may be open to others
  try {
    fs.chmodSync(KEYS_FILE, 0o600);
  } catch {}
  return entry;
}

export function removeKey(providerId) {
  const keys = savedKeys();
  if (!(providerId in keys)) return false;
  forget(providerId, keys[providerId]);
  delete keys[providerId];
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2) + "\n", { mode: 0o600 });
  return true;
}

/**
 * The key, in this order: the provider's usual variable, SCREENDOCS_API_KEY, the
 * key saved with "screendocs keys set". { key, from } or null; never printed.
 */
export function findKey(provider) {
  for (const v of provider?.env ?? []) if (process.env[v]) return { key: process.env[v], from: v };
  if (process.env.SCREENDOCS_API_KEY) return { key: process.env.SCREENDOCS_API_KEY, from: "SCREENDOCS_API_KEY" };
  const entry = provider && savedKeys()[provider.id];
  const saved = entry && reveal(provider.id, entry);
  if (saved) return { key: saved, from: KEYS_FILE };
  return null;
}

/**
 * Before the capture: does the provider accept the key? "refused" only for a clear 401/403;
 * anything else (no network, a server without the check) is "unknown" and the run goes on.
 */
export async function checkKey(provider, url, key, { get = fetch } = {}) {
  if (!provider || provider.local || !key) return "unknown";
  const headers = { authorization: `Bearer ${key}` };
  // Anthropic's own header; OpenRouter lists its models to anyone, so its key has its own endpoint
  if (provider.id === "anthropic") Object.assign(headers, { "x-api-key": key, "anthropic-version": "2023-06-01" });
  const at = provider.id === "openrouter" ? `${url}/key` : `${url}/models`;
  try {
    const res = await get(at, { headers, signal: AbortSignal.timeout(10_000) });
    if (res.status === 401) return "refused";
    // Gemini answers a wrong key with 400 "API key not valid"; a 403 may also be a proxy, so its text must say so
    if (res.status === 400 || res.status === 403) {
      const text = await res.text().catch(() => "");
      if (/api[ _-]?key|unauthori|authenticat|permission/i.test(text)) return "refused";
      return "unknown";
    }
    res.body?.cancel?.().catch(() => {});
    return res.ok ? "ok" : "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Before the capture: a local server (Ollama, LM Studio) must be open, and on Ollama the model
 * must be downloaded. Better to know now than after photographing the whole site.
 */
export async function checkLocal(provider, url, model, { get = fetch } = {}) {
  if (!provider?.local) return;
  const base = url.replace(/\/v1$/, "");
  const fail = () =>
    new Error(
      `${provider.name.replace(" (local)", "")} did not answer at ${base}. Open ${provider.id === "ollama" ? "Ollama" : "LM Studio and start its server (Developer tab)"} and try again.` +
        (provider.id === "ollama" ? " If it runs on another address, set OLLAMA_HOST (e.g. OLLAMA_HOST=http://192.168.0.10:11434)." : ""),
    );
  let res;
  try {
    res = await get(provider.id === "ollama" ? `${base}/api/tags` : `${url}/models`, { signal: AbortSignal.timeout(5000) });
  } catch {
    throw fail();
  }
  if (!res.ok) throw fail();
  if (provider.id !== "ollama") return;
  const names = ((await res.json().catch(() => ({}))).models ?? []).map((m) => m.name ?? m.model);
  const want = model.includes(":") ? model : `${model}:latest`;
  if (!names.includes(model) && !names.includes(want)) {
    throw new Error(
      `the model ${model} is not downloaded in Ollama. Download it with: ollama pull ${model}` +
        (names.length ? `\n(models it has: ${names.join(", ")})` : ""),
    );
  }
}
