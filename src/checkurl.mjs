/**
 * Checks that a web address answers before the capture starts and, when it does not,
 * looks for the address the person probably meant (missing www, missing .br, a typo).
 */

const TIMEOUT = 8000;

/** Address examples shown when the one typed does not work. */
export const EXAMPLES = {
  en: ["mysite.com", "www.mysite.com", "app.mysite.com/login", "http://localhost:3000"],
  pt: ["meusite.com.br", "www.meusite.com", "app.meusite.com/login", "http://localhost:3000"],
};

/**
 * { ok: true, final } when the site answered (final = where its redirects ended),
 * { ok: false, reason, suggestions: [url...] } when it did not.
 */
export async function checkUrl(url, { get = reach } = {}) {
  const first = await get(url);
  if (first.ok) return first;
  const tries = candidates(url);
  const answers = await Promise.all(tries.map((u) => get(u)));
  return { ok: false, reason: first.reason, suggestions: tries.filter((_, i) => answers[i].ok) };
}

/**
 * Any HTTP answer counts, even 403 or 500: the server exists and the browser may get
 * further than a bare request (sites that block bots, pages behind a login).
 */
async function reach(url) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { "user-agent": "Mozilla/5.0 screendocs" },
    });
    res.body?.cancel().catch(() => {});
    return { ok: true, final: res.url || url };
  } catch (e) {
    return { ok: false, reason: why(e) };
  }
}

function why(e) {
  const c = e?.cause?.code ?? e?.code ?? e?.name ?? "";
  if (c === "ENOTFOUND" || c === "EAI_AGAIN") return "notfound";
  if (c === "ECONNREFUSED") return "refused";
  if (c === "TimeoutError" || c === "AbortError" || c === "UND_ERR_CONNECT_TIMEOUT") return "timeout";
  if (/CERT|TLS|SSL/i.test(c) || /certificate|ssl|tls/i.test(String(e?.cause?.message ?? ""))) return "tls";
  return "other";
}

/** Addresses close to the one typed: www, .br, common typos, http. */
export function candidates(url) {
  const u = new URL(url);
  const host = u.hostname.toLowerCase();
  const local = host === "localhost" || /^[\d.]+$/.test(host) || host.includes(":");
  const hosts = new Set();
  if (!local) {
    let fixed = host
      .replace(/\.(con|cmo|ocm|vom|xom)$/, ".com")
      .replace(/\.(con|cmo|ocm|vom|xom)\.br$/, ".com.br")
      .replace(/\.com\.(b|bt|be)$/, ".com.br")
      .replace(/\.combr$/, ".com.br");
    // "radiobraba" alone: the ending is missing
    for (const f of fixed.includes(".") ? [fixed] : [`${fixed}.com.br`, `${fixed}.com`]) {
      const bare = f.replace(/^www\./, "");
      for (const h of [f, bare, `www.${bare}`]) {
        hosts.add(h);
        if (/\.(com|net|org)$/.test(h)) hosts.add(`${h}.br`);
        if (/\.(com|net|org)\.br$/.test(h)) hosts.add(h.replace(/\.br$/, ""));
      }
    }
  }
  const out = [];
  for (const h of hosts) {
    if (h === host || !h.includes(".")) continue;
    const v = new URL(u.href);
    v.hostname = h;
    out.push(v.href);
  }
  // The site may have no https (common on local servers)
  if (u.protocol === "https:") out.push(u.href.replace(/^https:/, "http:"));
  return [...new Set(out)].filter((x) => x !== u.href).slice(0, 8);
}

const REASON = {
  en: {
    notfound: "this address does not exist",
    refused: "the server refused the connection",
    timeout: "the site did not answer in time",
    tls: "the site's security certificate (https) failed",
    other: "it could not be opened",
  },
  pt: {
    notfound: "esse endereço não existe",
    refused: "o servidor recusou a conexão",
    timeout: "o site não respondeu a tempo",
    tls: "o certificado de segurança (https) do site falhou",
    other: "não consegui abrir",
  },
};

export const URL_TEXT = {
  en: {
    checking: "Checking the address...",
    ok: (h) => `${h} answered.`,
    moved: (h, to) => `${h} answered and sends to ${to}.`,
    fail: (h, r) => `${h} did not open: ${REASON.en[r] ?? REASON.en.other}.`,
    pick: "Did you mean one of these? (they answered)",
    noneFound: "Check the address. Examples of addresses that work:",
    retype: "Type it again",
    anyway: "Use it anyway",
    cliFail: (h, r, sug) =>
      `${h} did not open: ${REASON.en[r] ?? REASON.en.other}.` +
      (sug.length ? `\nThese answered, did you mean one of them?\n${sug.map((s) => `  ${s}`).join("\n")}` : "") +
      `\nExamples of addresses: ${EXAMPLES.en.join(", ")}` +
      `\nIf the address is right (a site that only opens on your network or VPN), add --no-url-check.`,
  },
  pt: {
    checking: "Conferindo o endereço...",
    ok: (h) => `${h} respondeu.`,
    moved: (h, to) => `${h} respondeu e manda para ${to}.`,
    fail: (h, r) => `${h} não abriu: ${REASON.pt[r] ?? REASON.pt.other}.`,
    pick: "Você quis dizer um destes? (eles responderam)",
    noneFound: "Confira o endereço. Exemplos de endereços que funcionam:",
    retype: "Digitar de novo",
    anyway: "Usar mesmo assim",
    cliFail: (h, r, sug) =>
      `${h} não abriu: ${REASON.pt[r] ?? REASON.pt.other}.` +
      (sug.length ? `\nEstes responderam, você quis dizer um deles?\n${sug.map((s) => `  ${s}`).join("\n")}` : "") +
      `\nExemplos de endereços: ${EXAMPLES.pt.join(", ")}` +
      `\nSe o endereço está certo (um site que só abre na sua rede ou VPN), adicione --no-url-check.`,
  },
};

/** "radiobraba.com.br" or "localhost:3000/app": the part a person recognizes. */
export function short(url) {
  const u = new URL(url);
  return (u.host + u.pathname).replace(/\/$/, "") + u.search;
}
