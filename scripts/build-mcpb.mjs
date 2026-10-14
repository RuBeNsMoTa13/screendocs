#!/usr/bin/env node
/**
 * Builds dist/screendocs.mcpb, the one-click installer for Claude Desktop: the code,
 * its production dependencies and mcpb/manifest.json (with the version of package.json).
 * Run with: npm run build:mcpb
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = path.join(root, "dist");
const stage = path.join(dist, "mcpb");
const out = path.join(dist, "screendocs.mcpb");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });

fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
for (const f of ["bin", "src", "package.json", "package-lock.json", "LICENSE", "README.md"]) {
  fs.cpSync(path.join(root, f), path.join(stage, f), { recursive: true });
}
fs.copyFileSync(path.join(root, "mcpb", "icon.png"), path.join(stage, "icon.png"));

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "mcpb", "manifest.json"), "utf8"));
manifest.version = pkg.version;
fs.writeFileSync(path.join(stage, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

run(npm, ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], stage);
const mcpb = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "mcpb.cmd" : "mcpb");
run(mcpb, ["validate", path.join(stage, "manifest.json")], root);
fs.rmSync(out, { force: true });
run(mcpb, ["pack", stage, out], root);
fs.rmSync(stage, { recursive: true, force: true });
console.log(`\n${out}`);
