import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import gifenc from "gifenc";
import UPNG from "upng-js";

const { GIFEncoder, quantize, applyPalette } = gifenc;

/**
 * Makes an animated GIF from a recording (see recorder.mjs), with no extra download:
 * Playwright's own ffmpeg turns the filmed frames into PNG files at a steady frame rate,
 * and the GIF is encoded here in JavaScript, since that ffmpeg has no GIF encoder.
 * The blank frames before the page paints are left out, and frames that repeat the one
 * before (the page standing still) become a longer delay instead of a new frame.
 */
export async function recordingToGif(recording, out, { width = 800, fps = 25 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "screendocs-gif-"));
  try {
    await recording.toPng(dir, { fps, width });
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
    const gif = GIFEncoder();
    const step = Math.round(1000 / fps);
    let pending = null;
    let painted = false;
    const flush = () => {
      if (!pending) return;
      const { rgba, w, h, delay } = pending;
      const palette = quantize(rgba, 256);
      gif.writeFrame(applyPalette(rgba, palette), w, h, { palette, delay });
      pending = null;
    };
    for (const f of files) {
      const png = UPNG.decode(fs.readFileSync(path.join(dir, f)));
      const rgba = new Uint8Array(UPNG.toRGBA8(png)[0]);
      if (!painted && plain(rgba)) continue;
      painted = true;
      if (pending && pending.w === png.width && pending.h === png.height && same(pending.rgba, rgba)) {
        pending.delay += step;
        continue;
      }
      flush();
      pending = { rgba, w: png.width, h: png.height, delay: step };
    }
    if (!pending) throw new Error("the recording has no frames");
    // The last frame (the bottom of the page) stays a moment before the GIF starts over
    pending.delay += 1500;
    flush();
    gif.finish();
    fs.writeFileSync(out, gif.bytes());
    return out;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** A frame of one color: the blank page before anything is painted. */
function plain(rgba) {
  for (let i = 4; i < rgba.length; i += 4 * 97) {
    if (Math.abs(rgba[i] - rgba[0]) + Math.abs(rgba[i + 1] - rgba[1]) + Math.abs(rgba[i + 2] - rgba[2]) > 12) return false;
  }
  return true;
}

/** Two frames are the same when almost no pixel changed (video noise aside). */
function same(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24 && ++diff > a.length / 4 / 1000) return false;
  }
  return true;
}
