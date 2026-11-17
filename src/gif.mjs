import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import gifenc from "gifenc";
import UPNG from "upng-js";

const { GIFEncoder, quantize, applyPalette } = gifenc;

/**
 * Turns a recorded video into an animated GIF, with no extra download: Playwright's own
 * ffmpeg (the one that records the videos) cuts the video into PNG frames, and the GIF is
 * encoded here in JavaScript, since that ffmpeg has no GIF encoder.
 *
 * The GIF goes from the page loading to the bottom of the page, without what the video
 * shows after (the jump back to the top, the screenshots). The video's clock runs a little
 * behind the real one, so the end is found by looking: `bottom` is a screenshot taken at
 * the bottom, and the GIF stops when the video leaves that view. `around` (ms from the
 * start of the video) says roughly where that is.
 * The blank frames before the page paints are left out, and frames that repeat the one
 * before (the page standing still) become a longer delay instead of a new frame.
 */
export async function videoToGif(video, out, { around, bottom, width = 800, fps = 10 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "screendocs-gif-"));
  try {
    // Room for the video's clock running behind
    const end = around ? around * 1.25 + 4000 : null;
    const filters = [end ? `trim=end=${(end / 1000).toFixed(2)}` : null, `scale='min(${width},iw)':-2`].filter(Boolean).join(",");
    await run(ffmpegPath(), ["-hide_banner", "-loglevel", "error", "-y", "-i", video, "-vf", filters, "-r", String(fps), path.join(dir, "%05d.png")]);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
    if (!files.length) throw new Error("the video has no frames");

    const target = bottom ? signature(UPNG.decode(bottom)) : null;
    // Before this the page is still scrolling, so it cannot be the bottom yet
    const earliest = around ? Math.floor(((around - 2000) / 1000) * fps) : 0;
    const gif = GIFEncoder();
    const step = Math.round(1000 / fps);
    let pending = null;
    let painted = false;
    let atBottom = false;
    const flush = () => {
      if (!pending) return;
      const { rgba, w, h, delay } = pending;
      const palette = quantize(rgba, 256);
      gif.writeFrame(applyPalette(rgba, palette), w, h, { palette, delay });
      pending = null;
    };
    for (const [i, f] of files.entries()) {
      const png = UPNG.decode(fs.readFileSync(path.join(dir, f)));
      const rgba = new Uint8Array(UPNG.toRGBA8(png)[0]);
      if (!painted && plain(rgba)) continue;
      painted = true;
      if (target && i >= earliest) {
        const near = distance(signature(png), target) < 10;
        if (atBottom && !near) break;
        atBottom ||= near;
      }
      if (pending && pending.w === png.width && pending.h === png.height && same(pending.rgba, rgba)) {
        pending.delay += step;
        continue;
      }
      flush();
      pending = { rgba, w: png.width, h: png.height, delay: step };
    }
    if (!pending) throw new Error("the video has no frames");
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

/** A small grid of average colors, to compare a frame with a screenshot of another size. */
const GRID = 24;
function signature(png) {
  const rgba = new Uint8Array(UPNG.toRGBA8(png)[0]);
  const { width: w, height: h } = png;
  const sum = new Float64Array(GRID * GRID * 3);
  const count = new Float64Array(GRID * GRID);
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const cell = Math.min(GRID - 1, Math.floor((y / h) * GRID)) * GRID + Math.min(GRID - 1, Math.floor((x / w) * GRID));
      const i = (y * w + x) * 4;
      sum[cell * 3] += rgba[i];
      sum[cell * 3 + 1] += rgba[i + 1];
      sum[cell * 3 + 2] += rgba[i + 2];
      count[cell]++;
    }
  }
  return sum.map((v, i) => v / (count[Math.floor(i / 3)] || 1));
}

/** Average difference of two signatures, from 0 (same) to 255. */
function distance(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]);
  return d / a.length;
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

/** Playwright's ffmpeg (downloaded with the first video), else one on the PATH. */
function ffmpegPath() {
  try {
    const { registry } = createRequire(import.meta.url)("playwright-core/lib/server/registry/index");
    const file = registry.findExecutable("ffmpeg")?.executablePath();
    if (file && fs.existsSync(file)) return file;
  } catch {}
  return "ffmpeg";
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.trim().split("\n").pop() || `ffmpeg exited with ${code}`))));
  });
}
