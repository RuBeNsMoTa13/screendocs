import pc from "picocolors";

/**
 * Rubens Crimson in the terminal: #e11d1d for highlights, #b91c1c for answered questions.
 * The menu library colors with this same picocolors instance, so swapping its cyan and
 * green here recolors every prompt too.
 */
const hex = (h, bg = false) => {
  const [r, g, b] = h.match(/\w\w/g).map((x) => parseInt(x, 16));
  return bg ? (s) => `\x1b[48;2;${r};${g};${b}m${s}\x1b[49m` : (s) => `\x1b[38;2;${r};${g};${b}m${s}\x1b[39m`;
};

export const crimson = pc.isColorSupported ? hex("e11d1d") : (s) => s;
export const bgCrimson = pc.isColorSupported ? hex("e11d1d", true) : (s) => s;
export const crimsonDark = pc.isColorSupported ? hex("b91c1c") : (s) => s;

if (pc.isColorSupported) {
  pc.cyan = crimson;
  pc.green = crimsonDark;
}

export default pc;
