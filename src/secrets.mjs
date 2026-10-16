import { spawnSync } from "node:child_process";

/**
 * Saved API keys go to the system's own safe place when there is one, so keys.json holds no
 * key in plain text:
 * - macOS: the Keychain (security);
 * - Windows: encrypted with the Windows account (DPAPI), so only this user on this
 *   computer can read it back, not another user and not a copy of the file elsewhere;
 * - Linux: the desktop keyring (secret-tool), when installed and unlocked.
 * Without any of them the key stays in keys.json, readable only by this user.
 * The key always goes through stdin, never as an argument other programs could list.
 */
const WIN = process.platform === "win32";
const MAC = process.platform === "darwin";
const SERVICE = "screendocs";

const run = (cmd, args, input) => {
  try {
    const r = spawnSync(cmd, args, { input, encoding: "utf8", timeout: 20_000, windowsHide: true });
    return r.status === 0 ? { ok: true, out: String(r.stdout ?? "") } : { ok: false };
  } catch {
    return { ok: false };
  }
};

const ps = (script, input) => run("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], input);

/** Where a saved key lives, for "keys list": keychain, encrypted or file. */
export function storeOf(entry) {
  if (entry && typeof entry === "object") return entry.keychain ? "keychain" : entry.dpapi ? "encrypted" : "file";
  return "file";
}

/** Saves the key in the safest place available and returns what goes in keys.json. */
export function protect(id, key) {
  if (MAC) {
    // security -i reads its commands from stdin
    const line = `add-generic-password -U -a ${SERVICE} -s ${SERVICE}-${id} -w ${JSON.stringify(key)}\n`;
    if (run("security", ["-i"], line).ok && reveal(id, { keychain: true }) === key) return { keychain: true };
  } else if (WIN) {
    const r = ps("$k = [Console]::In.ReadToEnd().Trim(); ConvertTo-SecureString $k -AsPlainText -Force | ConvertFrom-SecureString", key);
    const blob = r.ok && r.out.trim();
    if (blob && /^[0-9a-f]+$/i.test(blob) && reveal(id, { dpapi: blob }) === key) return { dpapi: blob };
  } else if (run("secret-tool", ["store", `--label=screendocs ${id} API key`, "service", SERVICE, "provider", id], key).ok) {
    if (reveal(id, { keychain: true }) === key) return { keychain: true };
  }
  return key;
}

/** The key of a keys.json entry, or null when it can no longer be read. */
export function reveal(id, entry) {
  if (typeof entry === "string") return entry;
  if (!entry || typeof entry !== "object") return null;
  if (entry.dpapi) {
    const r = ps(
      "$s = ConvertTo-SecureString ([Console]::In.ReadToEnd().Trim()); " +
        "[Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))",
      entry.dpapi,
    );
    return r.ok ? r.out.replace(/\r?\n$/, "") || null : null;
  }
  if (entry.keychain) {
    const r = MAC
      ? run("security", ["find-generic-password", "-a", SERVICE, "-s", `${SERVICE}-${id}`, "-w"])
      : run("secret-tool", ["lookup", "service", SERVICE, "provider", id]);
    return r.ok ? r.out.replace(/\r?\n$/, "") || null : null;
  }
  return null;
}

/** Removes the key from the keychain too, when it was there. */
export function forget(id, entry) {
  if (storeOf(entry) !== "keychain") return;
  if (MAC) run("security", ["delete-generic-password", "-a", SERVICE, "-s", `${SERVICE}-${id}`]);
  else run("secret-tool", ["clear", "service", SERVICE, "provider", id]);
}
