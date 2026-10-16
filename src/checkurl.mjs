/**
 * Checks that a web address answers before the capture starts and, when it does not,
 * looks for the address the person probably meant (missing www, another ending, a typo).
 */

const TIMEOUT = 8000;

/** Address examples shown when the one typed does not work. */
export const EXAMPLES = {
  en: ["mysite.com", "www.mysite.net", "mysite.io", "app.mysite.dev/login", "http://localhost:3000"],
  pt: ["meusite.com.br", "www.meusite.com", "meusite.net.br", "meusite.app", "app.meusite.io/login", "http://localhost:3000"],
  es: ["misitio.com", "www.misitio.es", "misitio.com.mx", "misitio.app", "app.misitio.io/login", "http://localhost:3000"],
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
  const ok = tries.filter((_, i) => answers[i].ok);
  // site.net and www.site.net both answering are the same site: show it once
  const suggestions = ok.filter((t) => !(t.includes("://www.") && ok.includes(t.replace("://www.", "://"))));
  return { ok: false, reason: first.reason, suggestions };
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

/** Endings tried when the one typed does not answer, most common first. */
const ENDINGS = ["com.br", "com", "net.br", "net", "org.br", "org", "io", "app", "dev"];
const KNOWN = [...ENDINGS, "gov.br", "edu.br", "br"].sort((x, y) => y.length - x.length);

/** Addresses close to the one typed: www, another ending (.com.br, .net, .io...), typos, http. */
export function candidates(url) {
  const u = new URL(url);
  const host = u.hostname.toLowerCase();
  const local = host === "localhost" || /^[\d.]+$/.test(host) || host.includes(":");
  const hosts = new Set();
  if (!local) {
    const fixed = host
      .replace(/\.(con|cmo|ocm|vom|xom)$/, ".com")
      .replace(/\.(con|cmo|ocm|vom|xom)\.br$/, ".com.br")
      .replace(/\.com\.(b|bt|be)$/, ".com.br")
      .replace(/\.combr$/, ".com.br");
    // "www.radiobraba.com.br" -> name "radiobraba", ending "com.br"; "radiobraba" alone has no ending
    const bare = fixed.replace(/^www\./, "");
    const end = KNOWN.find((e) => bare.endsWith(`.${e}`)) ?? (bare.includes(".") ? bare.split(".").pop() : "");
    const name = end ? bare.slice(0, -end.length - 1) : bare;
    const toggled = end.endsWith(".br") ? end.slice(0, -3) : `${end}.br`;
    // A government or university address keeps its ending: prefeitura.sp.com.br would be someone else
    const swap = !/^(gov|edu)\.br$/.test(end);
    const ends = [...new Set([end, ...(ENDINGS.includes(toggled) ? [toggled] : []), ...(swap ? ENDINGS : [])].filter(Boolean))];
    for (const e of ends) {
      hosts.add(`${name}.${e}`);
      // www only on a plain name: app.site.com does not become www.app.site.com
      if (!name.includes(".")) hosts.add(`www.${name}.${e}`);
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
  return [...new Set(out)].filter((x) => x !== u.href);
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
  es: {
    notfound: "esta dirección no existe",
    refused: "el servidor rechazó la conexión",
    timeout: "el sitio no respondió a tiempo",
    tls: "falló el certificado de seguridad (https) del sitio",
    other: "no se pudo abrir",
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
  es: {
    checking: "Revisando la dirección...",
    ok: (h) => `${h} respondió.`,
    moved: (h, to) => `${h} respondió y lleva a ${to}.`,
    fail: (h, r) => `${h} no abrió: ${REASON.es[r] ?? REASON.es.other}.`,
    pick: "¿Quisiste decir una de estas? (respondieron)",
    noneFound: "Revisa la dirección. Ejemplos de direcciones que funcionan:",
    retype: "Escribirla de nuevo",
    anyway: "Usarla de todos modos",
    cliFail: (h, r, sug) =>
      `${h} no abrió: ${REASON.es[r] ?? REASON.es.other}.` +
      (sug.length ? `\nEstas respondieron, ¿quisiste decir una de ellas?\n${sug.map((s) => `  ${s}`).join("\n")}` : "") +
      `\nEjemplos de direcciones: ${EXAMPLES.es.join(", ")}` +
      `\nSi la dirección es correcta (un sitio que solo abre en tu red o VPN), agrega --no-url-check.`,
  },
};

/** "radiobraba.com.br" or "localhost:3000/app": the part a person recognizes. */
export function short(url) {
  const u = new URL(url);
  return (u.host + u.pathname).replace(/\/$/, "") + u.search;
}
