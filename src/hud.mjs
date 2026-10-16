import { Prompt, SelectPrompt, ConfirmPrompt } from "@clack/core";
import pc from "./theme.mjs";
import { uiLang } from "./interactive.mjs";

/**
 * A line of key hints on the bottom bar of every question ("↑↓ choose · Enter confirm ·
 * Esc back"), so the person always knows what each key does. Clack has no footer option,
 * so each question's frame gets the line added to its last bar while it waits for an answer.
 */
let back = false;

/** Esc goes back a question (the capture menu) instead of quitting. */
export function setBack(on) {
  back = on;
}

const T = {
  en: { move: "↑↓ choose", toggle: "←→ choose", enter: "Enter confirm", back: "Esc back", quit: "Ctrl+C quit", esc: "Esc/Ctrl+C quit" },
  pt: { move: "↑↓ escolher", toggle: "←→ escolher", enter: "Enter confirmar", back: "Esc voltar", quit: "Ctrl+C sair", esc: "Esc/Ctrl+C sair" },
};

function hints(prompt) {
  const t = T[uiLang()];
  const keys = prompt instanceof SelectPrompt ? [t.move] : prompt instanceof ConfirmPrompt ? [t.toggle] : [];
  return [...keys, t.enter, ...(back ? [t.back, t.quit] : [t.esc])].join(" · ");
}

const plain = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
const original = Prompt.prototype.prompt;

Prompt.prototype.prompt = function () {
  const render = this._render;
  this._render = (...args) => {
    const frame = render(...args);
    if (typeof frame !== "string" || !["initial", "active"].includes(this.state)) return frame;
    const lines = frame.replace(/\n$/, "").split("\n");
    // The bottom bar alone ("└", or "—" where the terminal has no box characters)
    if (!/^\s*[└—]\s*$/.test(plain(lines.at(-1)))) return frame;
    lines[lines.length - 1] += `  ${pc.dim(hints(this))}`;
    return lines.join("\n") + (frame.endsWith("\n") ? "\n" : "");
  };
  return original.call(this);
};
