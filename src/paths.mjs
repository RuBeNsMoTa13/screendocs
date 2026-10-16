import path from "node:path";
import { USER_DIR } from "./userconfig.mjs";

/**
 * Where the login session for a host is saved: ~/.screendocs/auth/, next to the defaults and
 * keys, so it works from any folder and the folder where screendocs runs only gets the output.
 * Holds account access: never share it.
 */
export function authFile(host) {
  return path.join(USER_DIR, "auth", `${host.replace(/[^a-z0-9.-]/gi, "_")}.json`);
}

/** "/" -> "home", "/app/settings?tab=1" -> "app-settings-tab-1" */
export function slugOf(url) {
  const u = new URL(url);
  const s = (u.pathname + (u.search ? `-${u.search.slice(1)}` : ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return s || "home";
}

/** "mysite.com" -> "https://mysite.com/" */
export function normalizeUrl(raw) {
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return new URL(withProto).href;
}
