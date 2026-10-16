import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawn, spawnSync } from "node:child_process";
import * as p from "@clack/prompts";
import pc from "./theme.mjs";
import { writeForAi } from "./report.mjs";
import { parseAnswer, applyItems } from "./answers.mjs";
import { uiLang } from "./i18n.mjs";

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
    back: (n) => `The AI should answer with ${n} description(s), one per image. Copy its whole answer, paste it here and press Enter. (Type skip to skip this part.)`,
    dups: (names) => `Came more than once: ${list(names)}. I kept the last one.`,
    unknown: (names) => `Not images of this capture, ignored: ${list(names)}.`,
    empty: (names) => `Came without a title or description: ${list(names)}.`,
    sameChat: "You can keep using the same chat.",
    got: (n, total) => `${n} of ${total} descriptions received.`,
    pastedPrompt: "What arrived here is the text for the AI, not its answer (screendocs copied that text when this part started, replacing what was in your clipboard). If the AI has already answered, copy its answer again in the chat and paste it here.",
    noJson: "I could not find the descriptions in that answer. Copy the AI's whole answer and paste it again (or type skip).",
    wrongFiles: (names) => `That answer does not mention any image of this capture. The images of this part are ${list(names)}. Check that you sent them and paste again (or type skip).`,
    otherParts: (n) => `(also ${n} from other parts)`,
    missing: (names) => `The AI did not describe ${list(names)}. Ask it in the chat to describe these too and paste the answer, or type skip to leave them with the text from the page.`,
    already: (i) => `Part ${i} was already answered.`,
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
    back: (n) => `A IA deve responder com ${n} descrição(ões), uma por imagem. Copie a resposta inteira, cole aqui e aperte Enter. (Digite pular para pular esta parte.)`,
    dups: (names) => `Vieram repetidas: ${list(names)}. Fiquei com a última.`,
    unknown: (names) => `Não são imagens desta captura, ignorei: ${list(names)}.`,
    empty: (names) => `Vieram sem título ou descrição: ${list(names)}.`,
    sameChat: "Pode continuar no mesmo chat.",
    got: (n, total) => `${n} de ${total} descrições recebidas.`,
    pastedPrompt: "O que chegou aqui é o texto para a IA, não a resposta dela (o screendocs copiou esse texto quando esta parte começou, no lugar do que estava na sua área de transferência). Se a IA já respondeu, copie a resposta de novo no chat e cole aqui.",
    noJson: "Não achei as descrições nessa resposta. Copie a resposta inteira da IA e cole de novo (ou digite pular).",
    wrongFiles: (names) => `Essa resposta não fala de nenhuma imagem desta captura. As imagens desta parte são ${list(names)}. Confira se enviou essas e cole de novo (ou digite pular).`,
    otherParts: (n) => `(e mais ${n} de outras partes)`,
    missing: (names) => `A IA não descreveu ${list(names)}. Peça no chat para descrever essas também e cole a resposta, ou digite pular para deixá-las com o texto da página.`,
    already: (i) => `A parte ${i} já foi respondida.`,
    skipped: "Parte pulada.",
    skip: ["pular", "skip"],
  },
  es: {
    intro: "Usa un chat con una IA que lea imágenes (ChatGPT, Gemini, Claude.ai...). Los planes gratuitos pueden limitar cuántas imágenes puedes enviar.",
    part: (i, n) => `Parte ${i} de ${n}`,
    drag: (n, dir) => `Abrí la carpeta ${dir}. Selecciona ${n > 1 ? `sus ${n} imágenes (${KEY}+A)` : "la imagen"} y arrástralas al chat.`,
    open: (n, dir) => `Abre la carpeta ${dir}, selecciona ${n > 1 ? `sus ${n} imágenes` : "la imagen"} y arrástralas al chat.`,
    copied: `El texto para la IA ya está copiado. Pégalo en el chat (${KEY}+V) y envíalo.`,
    notCopied: (f) => `Abre ${f}, cópialo todo, pégalo en el chat y envíalo.`,
    back: (n) => `La IA debe responder con ${n} descripción(es), una por imagen. Copia su respuesta completa, pégala aquí y presiona Enter. (Escribe saltar para saltar esta parte.)`,
    dups: (names) => `Llegaron repetidas: ${list(names)}. Me quedé con la última.`,
    unknown: (names) => `No son imágenes de esta captura, las ignoré: ${list(names)}.`,
    empty: (names) => `Llegaron sin título o descripción: ${list(names)}.`,
    sameChat: "Puedes seguir en el mismo chat.",
    got: (n, total) => `${n} de ${total} descripciones recibidas.`,
    pastedPrompt: "Lo que llegó aquí es el texto para la IA, no su respuesta (screendocs copió ese texto al empezar esta parte, en lugar de lo que había en tu portapapeles). Si la IA ya respondió, copia su respuesta de nuevo en el chat y pégala aquí.",
    noJson: "No encontré las descripciones en esa respuesta. Copia la respuesta completa de la IA y pégala de nuevo (o escribe saltar).",
    wrongFiles: (names) => `Esa respuesta no menciona ninguna imagen de esta captura. Las imágenes de esta parte son ${list(names)}. Revisa que las enviaste y pega de nuevo (o escribe saltar).`,
    otherParts: (n) => `(y ${n} más de otras partes)`,
    missing: (names) => `La IA no describió ${list(names)}. Pídele en el chat que describa estas también y pega la respuesta, o escribe saltar para dejarlas con el texto de la página.`,
    already: (i) => `La parte ${i} ya fue respondida.`,
    skipped: "Parte saltada.",
    skip: ["saltar", "skip"],
  },
};

/**
 * Describing with an AI chat in the browser, guided step by step: for each part of
 * for-ai/ it opens the folder, copies the text for the AI and reads the answer pasted back.
 */
export async function chatFlow(root) {
  const t = T[uiLang()] ?? T.en;
  const parts = writeForAi(root);
  p.log.info(t.intro);

  // Answers are accepted for any part, so images sent out of order are not lost
  const all = new Set(parts.flatMap((part) => part.names));
  const input = lineReader();
  const received = new Map();
  for (const [i, part] of parts.entries()) {
    if (part.names.every((n) => received.has(n))) {
      p.log.success(t.already(i + 1));
      continue;
    }
    p.log.step(pc.bold(t.part(i + 1, parts.length)));
    const rel = shortPath(part.dir);
    const opened = openFolder(part.dir);
    const copied = copyFile(part.prompt);
    p.log.message(
      [
        `1. ${opened ? t.drag(part.names.length, rel) : t.open(part.names.length, rel)}`,
        `2. ${copied ? t.copied : t.notCopied(shortPath(part.prompt))}`,
        `3. ${t.back(part.names.length)}`,
        ...(i ? [pc.dim(t.sameChat)] : []),
      ].join("\n"),
    );
    // Until every image of the part has a description, or the person skips the rest
    for (;;) {
      const answer = await readAnswer(input, t, all, part.names);
      if (!answer) {
        p.log.warn(t.skipped);
        break;
      }
      const { dups, unknown, empty } = answer;
      if (dups.length) p.log.warn(t.dups(dups));
      if (unknown.length) p.log.warn(t.unknown(unknown));
      if (empty.length) p.log.warn(t.empty(empty));
      const got = answer.items;
      for (const it of got) received.set(it.file, it);
      const mine = part.names.filter((n) => received.has(n));
      const other = got.filter((it) => !part.names.includes(it.file)).length;
      p.log.success(t.got(mine.length, part.names.length) + (other ? ` ${t.otherParts(other)}` : ""));
      const missing = part.names.filter((n) => !received.has(n));
      if (!missing.length) break;
      p.log.warn(t.missing(missing));
    }
    // The part is done: its folder window would only pile up with the next one
    if (opened) closeFolder(part.dir);
  }
  input.close();
  return applyItems(root, [...received.values()], "AI chat");
}

/**
 * One reader for the whole flow. Closing it and opening another for each part paused and
 * resumed the terminal in between, and on Windows the second part could then never be read.
 */
function lineReader() {
  process.stdin.setRawMode?.(false);
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  let onLine = null;
  let onClose = null;
  let closed = false;
  rl.on("line", (line) => onLine?.(line));
  rl.on("close", () => {
    closed = true;
    onClose?.();
  });
  return {
    listen(line, close) {
      onLine = line;
      onClose = close;
      // The input already ended (Ctrl+D, or a pipe that ran out): nothing more will come
      if (closed) close?.();
    },
    close: () => rl.close(),
  };
}

/**
 * Reads what is pasted. A paste arrives as many lines in a burst, so it is read once the
 * lines stop coming for a moment: the whole answer at once, with any text around it.
 */
const QUIET = 800;

function readAnswer(input, t, known, expected) {
  process.stdout.write(pc.dim("> "));
  return new Promise((resolve) => {
    let buf = "";
    let timer;
    const done = (v) => {
      clearTimeout(timer);
      // Lines that still arrive (the end of a long paste) are dropped, not read as the next answer
      input.listen(null, null);
      resolve(v);
    };
    const again = (msg) => {
      console.log(pc.yellow(msg));
      process.stdout.write(pc.dim("> "));
      buf = "";
    };
    const check = () => {
      if (!buf.trim()) return;
      if (t.skip.includes(buf.trim().toLowerCase())) return done(null);
      const items = parseAnswer(buf);
      // A slow paste stopped halfway through the list: wait for the rest
      if (!items && unfinished(buf)) return;
      const named = (items ?? [])
        .filter((it) => it && typeof it === "object" && !/^2 to 6 words$/i.test(String(it.title ?? "").trim()))
        .map((it) => ({ ...it, file: String(it.file ?? "").trim().split(/[\\/]/).pop() }));
      const mine = named.filter((it) => known.has(it.file));
      if (!mine.length) {
        // Only the text for the AI, pasted here by mistake (it is still in the clipboard)
        if (/You are documenting the screens of the website/.test(buf)) return again(t.pastedPrompt);
        return again(items ? t.wrongFiles(expected) : t.noJson);
      }
      const count = new Map();
      for (const it of mine) count.set(it.file, (count.get(it.file) ?? 0) + 1);
      const filled = mine.filter((it) => String(it.title ?? "").trim() || String(it.description ?? "").trim());
      done({
        items: filled,
        dups: [...count].filter(([, n]) => n > 1).map(([f]) => f),
        unknown: [...new Set(named.filter((it) => !known.has(it.file)).map((it) => it.file || "?"))],
        empty: [...new Set(mine.filter((it) => !filled.includes(it)).map((it) => it.file))],
      });
    };
    input.listen(
      (line) => {
        buf += line + "\n";
        clearTimeout(timer);
        timer = setTimeout(check, QUIET);
      },
      () => done(null),
    );
  });
}

/**
 * True while the list that was started is not closed yet. Brackets inside the text (like
 * the "[cite: 9]" some chats add) do not count. On Windows the last line of a paste ("]")
 * only arrives when Enter is pressed, so the answer must wait for it.
 */
export function unfinished(text) {
  const start = text.indexOf("[");
  if (start < 0) return false;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") depth--;
    if (depth === 0) return false;
  }
  return true;
}

/** "a.jpg, b.jpg, c.jpg and 4 more" */
function list(names) {
  return names.slice(0, 3).join(", ") + (names.length > 3 ? ` (+${names.length - 3})` : "");
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

/**
 * Closes the file explorer window that openFolder opened, if it is still open. Best effort:
 * on Linux each file manager is different, so the window stays.
 */
function closeFolder(dir) {
  const quote = (x) => x.replace(/'/g, "''");
  const run = WIN
    ? [
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `$d = [IO.Path]::GetFullPath('${quote(dir)}').TrimEnd('\\'); (New-Object -ComObject Shell.Application).Windows() | ` +
            `Where-Object { try { $_.Document.Folder.Self.Path.TrimEnd('\\') -eq $d } catch { $false } } | ForEach-Object { $_.Quit() }`,
        ],
      ]
    : MAC
      ? ["osascript", ["-e", `tell application "Finder" to close (every window whose target is (POSIX file ${JSON.stringify(dir)} as alias))`]]
      : null;
  if (!run) return;
  try {
    spawn(run[0], run[1], { detached: true, stdio: "ignore", windowsHide: true }).on("error", () => {}).unref();
  } catch {}
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
