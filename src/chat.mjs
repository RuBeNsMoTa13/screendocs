import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawn, spawnSync } from "node:child_process";
import * as p from "@clack/prompts";
import pc from "./theme.mjs";
import { writeForAi } from "./report.mjs";
import { parseAnswer, applyItems } from "./answers.mjs";
import { uiLang } from "./interactive.mjs";

const MAC = process.platform === "darwin";
const WIN = process.platform === "win32";
const KEY = MAC ? "Cmd" : "Ctrl";

const T = {
  en: {
    intro: "Use a chat with an AI that reads images (ChatGPT, Gemini, Claude.ai...). Free plans may limit how many images you can send.",
    part: (i, n) => `Part ${i} of ${n}`,
    drag: (n, dir) => `I opened the folder ${dir}. Select ${n > 1 ? `its ${n} images (${KEY}+A)` : "the image"} and drag into the chat.`,
    open: (n, dir) => `Open the folder ${dir}, select ${n > 1 ? `its ${n} images` : "the image"} and drag into the chat.`,
    copied: `The text for the AI is already copied. Paste it in the chat (${KEY}+V) and send.`,
    notCopied: (f) => `Open ${f}, copy all of it, paste it in the chat and send.`,
    back: "Copy the AI's whole answer, paste it here and press Enter. (Type skip to skip this part.)",
    sameChat: "You can keep using the same chat.",
    got: (n, total) => `${n} of ${total} descriptions received.`,
    noJson: "I could not find the descriptions in that answer. Copy the AI's whole answer and paste it again (or type skip).",
    wrongFiles: "That answer is not about the images of this part. Check that you sent the right images and paste again (or type skip).",
    skipped: "Part skipped.",
    skip: ["skip"],
  },
  pt: {
    intro: "Use um chat com uma IA que leia imagens (ChatGPT, Gemini, Claude.ai...). Planos grátis podem limitar quantas imagens dá para enviar.",
    part: (i, n) => `Parte ${i} de ${n}`,
    drag: (n, dir) => `Abri a pasta ${dir}. Selecione ${n > 1 ? `as ${n} imagens (${KEY}+A)` : "a imagem"} e arraste para o chat.`,
    open: (n, dir) => `Abra a pasta ${dir}, selecione ${n > 1 ? `as ${n} imagens` : "a imagem"} e arraste para o chat.`,
    copied: `O texto para a IA já está copiado. Cole no chat (${KEY}+V) e envie.`,
    notCopied: (f) => `Abra ${f}, copie tudo, cole no chat e envie.`,
    back: "Copie a resposta inteira da IA, cole aqui e aperte Enter. (Digite pular para pular esta parte.)",
    sameChat: "Pode continuar no mesmo chat.",
    got: (n, total) => `${n} de ${total} descrições recebidas.`,
    noJson: "Não achei as descrições nessa resposta. Copie a resposta inteira da IA e cole de novo (ou digite pular).",
    wrongFiles: "Essa resposta não é das imagens desta parte. Confira se enviou as imagens certas e cole de novo (ou digite pular).",
    skipped: "Parte pulada.",
    skip: ["pular", "skip"],
  },
};

/**
 * Describing with an AI chat in the browser, guided step by step: for each part of
 * for-ai/ it opens the folder, copies the text for the AI and reads the answer pasted back.
 */
export async function chatFlow(root) {
  const t = T[uiLang()];
  const parts = writeForAi(root);
  p.log.info(t.intro);

  const items = [];
  for (const [i, part] of parts.entries()) {
    p.log.step(pc.bold(t.part(i + 1, parts.length)));
    const rel = shortPath(part.dir);
    const opened = openFolder(part.dir);
    const copied = copyFile(part.prompt);
    p.log.message(
      [
        `1. ${opened ? t.drag(part.names.length, rel) : t.open(part.names.length, rel)}`,
        `2. ${copied ? t.copied : t.notCopied(shortPath(part.prompt))}`,
        `3. ${t.back}`,
        ...(i ? [pc.dim(t.sameChat)] : []),
      ].join("\n"),
    );
    const got = await readAnswer(t, part.names);
    if (got) {
      items.push(...got);
      p.log.success(t.got(got.length, part.names.length));
    } else p.log.warn(t.skipped);
  }
  return applyItems(root, items, "AI chat");
}

/**
 * Reads lines until they hold a JSON array about this part's images. A paste arrives
 * as many lines, so it ends as soon as the array is complete; two empty lines in a row
 * mean the answer is not usable.
 */
function readAnswer(t, names) {
  const known = new Set(names);
  process.stdin.setRawMode?.(false);
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  process.stdout.write(pc.dim("> "));
  return new Promise((resolve) => {
    let buf = "";
    let blanks = 0;
    const done = (v) => {
      resolve(v); // before close(), whose "close" event would resolve with null
      rl.close();
    };
    rl.on("line", (line) => {
      if (!buf.trim() && t.skip.includes(line.trim().toLowerCase())) return done(null);
      buf += line + "\n";
      const items = parseAnswer(buf);
      const mine = items?.filter((it) => it && known.has(String(it.file ?? "").trim().split(/[\\/]/).pop()));
      if (mine?.length) return done(mine.map((it) => ({ ...it, file: String(it.file).trim().split(/[\\/]/).pop() })));
      blanks = line.trim() ? 0 : blanks + 1;
      if (blanks >= 2 && buf.trim()) {
        console.log(pc.yellow(items ? t.wrongFiles : t.noJson));
        process.stdout.write(pc.dim("> "));
        buf = "";
        blanks = 0;
      }
    });
    rl.on("close", () => resolve(null));
  });
}

/** Relative to where the command runs, unless that climbs out of it. */
function shortPath(p) {
  const rel = path.relative(process.cwd(), p);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel : p;
}

function openFolder(dir) {
  const [cmd, args] = WIN ? ["explorer", [dir]] : [MAC ? "open" : "xdg-open", [dir]];
  try {
    spawn(cmd, args, { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
    return WIN || MAC || spawnSync("which", ["xdg-open"], { stdio: "ignore" }).status === 0;
  } catch {
    return false;
  }
}

/** Copies a UTF-8 text file to the clipboard (accents included). */
function copyFile(file) {
  const tries = WIN
    ? [["powershell", ["-NoProfile", "-Command", `Get-Content -Raw -Encoding UTF8 -LiteralPath '${file.replace(/'/g, "''")}' | Set-Clipboard`]]]
    : MAC
      ? [["pbcopy", []]]
      : [["wl-copy", []], ["xclip", ["-selection", "clipboard"]], ["xsel", ["--clipboard", "--input"]]];
  const input = WIN ? undefined : fs.readFileSync(file);
  return tries.some(([cmd, args]) => {
    try {
      return spawnSync(cmd, args, { input, stdio: [input ? "pipe" : "ignore", "ignore", "ignore"], timeout: 15_000 }).status === 0;
    } catch {
      return false;
    }
  });
}
