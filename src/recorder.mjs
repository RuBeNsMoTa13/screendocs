import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * Films a page in high quality. Playwright's own recording caps the video at about
 * 1 Mbit/s, which smears text while the page scrolls. Here the browser sends each
 * painted frame as a high-quality JPEG (Chrome's screencast), the frames are kept in a
 * folder with the time they were painted, and the video and the GIF are made from them
 * afterwards at a steady frame rate.
 */
export async function startRecording(page, dir, { width, height, scale = 1 } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  let end = null;
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    if (end) return;
    const file = path.join(dir, `${String(frames.length).padStart(6, "0")}.jpg`);
    fs.writeFileSync(file, Buffer.from(data, "base64"));
    frames.push({ t: metadata?.timestamp ? metadata.timestamp * 1000 : Date.now(), file });
  });
  // At the screen's real pixels: a phone (scale 2) is filmed twice as sharp
  const size = width && height ? { maxWidth: Math.round(width * scale), maxHeight: Math.round(height * scale) } : {};
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1, ...size });

  return {
    frames,
    /** Stops filming: the video ends here. */
    async stop() {
      end ??= Date.now();
      await cdp.send("Page.stopScreencast").catch(() => {});
      await cdp.detach().catch(() => {});
    },
    /** A sharp WebM video, at a steady frame rate. */
    async toWebm(out, { fps = 30 } = {}) {
      await pipe(ticks(frames, end, fps), [
        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
        "-c:v", "libvpx", "-crf", "6", "-b:v", "20M", "-qmin", "0", "-qmax", "20",
        "-deadline", "good", "-cpu-used", "2", "-an", out,
      ], fps);
    },
    /** The frames as PNG files (for the GIF), at most `width` wide. */
    async toPng(outDir, { fps = 25, width = 800 } = {}) {
      await pipe(ticks(frames, end, fps), ["-vf", `scale='min(${width},iw)':-2`, path.join(outDir, "%05d.png")], fps);
    },
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** For each step of a steady clock, the last frame painted by then. */
function ticks(frames, end, fps) {
  if (!frames.length) throw new Error("no frames were filmed");
  const start = frames[0].t;
  const stop = Math.max(end ?? frames.at(-1).t, frames.at(-1).t);
  const list = [];
  for (let t = start, i = 0; t <= stop; t += 1000 / fps) {
    while (i + 1 < frames.length && frames[i + 1].t <= t) i++;
    list.push(frames[i].file);
  }
  return list;
}

/** Sends the JPEG files to ffmpeg one after the other, as a video at `fps`. */
function pipe(files, args, fps) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath(), ["-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(fps), "-i", "pipe:0", ...args], {
      stdio: ["pipe", "ignore", "pipe"],
    });
    let err = "";
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.trim().split("\n").pop() || `ffmpeg exited with ${code}`))));
    child.stdin.on("error", () => {});
    (async () => {
      let last = null;
      let buf = null;
      for (const f of files) {
        if (f !== last) buf = fs.readFileSync((last = f));
        if (!child.stdin.write(buf)) await new Promise((r) => child.stdin.once("drain", r));
      }
      child.stdin.end();
    })().catch(reject);
  });
}

/** Playwright's ffmpeg (downloaded with the first video), else one on the PATH. */
export function ffmpegPath() {
  try {
    const { registry } = createRequire(import.meta.url)("playwright-core/lib/server/registry/index");
    const file = registry.findExecutable("ffmpeg")?.executablePath();
    if (file && fs.existsSync(file)) return file;
  } catch {}
  return "ffmpeg";
}
