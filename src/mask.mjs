/**
 * Blurs personal data before anything is captured, and takes it out of the text saved with
 * the capture (screens.json, the report, the text sent to an AI):
 * - emails, phone numbers (Brazilian, US and international formats) and card numbers;
 * - documents: CPF and CNPJ (Brazil, with or without punctuation), SSN (US), DNI and NIE
 *   (Spain), DNI (Argentina), CURP and RFC (Mexico), and IBAN bank accounts;
 * - filled email, phone and password fields, and any field whose value is one of the above;
 * - the CSS selectors the user passes with --mask.
 * It is a CSS blur, so screenshots and videos are both covered, and an observer keeps
 * blurring content that loads later.
 */

/**
 * Where the personal data is in a text: [start, end] pairs. Self-contained (no outside
 * names), because it also runs inside the page.
 */
export function sensitiveRanges(text) {
  const digits = (s) => s.replace(/\D/g, "");
  // The check digit of card numbers: random long numbers (orders, ids) rarely pass it
  const luhn = (s) => {
    let sum = 0;
    for (let i = 0; i < s.length; i++) {
      let d = Number(s[s.length - 1 - i]);
      if (i % 2) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
      sum += d;
    }
    return sum % 10 === 0;
  };
  const rules = [
    // email
    [/[\w.+-]+@[\w-]+\.[\w.-]+/g],
    // CPF and CNPJ (Brazil), with or without punctuation
    [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g],
    [/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g],
    // SSN (US)
    [/\b\d{3}-\d{2}-\d{4}\b/g],
    // DNI and NIE (Spain): 8 digits and a letter, or X/Y/Z, 7 digits and a letter
    [/\b[XYZ]?\d{7,8}[- ]?[A-Z]\b/g],
    // DNI (Argentina): 12.345.678
    [/\b\d{1,2}\.\d{3}\.\d{3}\b(?![.,]\d)/g],
    // CURP and RFC (Mexico)
    [/\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d\b/g],
    [/\b[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}\b/g],
    // IBAN: two letters, two check digits, then the account (Europe and others)
    [/\b[A-Z]{2}\d{2}(?: ?[A-Z\d]{4}){2,7}(?: ?[A-Z\d]{1,3})?\b/g],
    // card numbers: 13 to 19 digits in groups, that pass the check digit
    [/\b\d(?:[ -]?\d){12,18}\b/g, (m) => luhn(digits(m))],
    // phones: with a country code (+55 11 98765-4321, +1 555 123 4567, +34 612 345 678)
    [/\+\d{1,3}[\s.-]?(?:\(\d{1,4}\)[\s.-]?)?\d{2,4}(?:[\s.-]?\d{2,4}){1,3}\b/g, (m) => digits(m).length >= 8],
    // with the area code in parentheses: (11) 98765-4321, (555) 123-4567
    [/\(\d{2,3}\)\s?\d{3,5}[\s.-]?\d{4}\b/g],
    // Brazil without parentheses: 11 98765-4321, 11 3456-7890, 98765-4321 (not 2023-2024)
    [/\b\d{2}\s\d{4,5}-\d{4}\b/g],
    [/\b9\d{4}-\d{4}\b/g],
    // US: 555-123-4567, 555.123.4567
    [/\b\d{3}[-.]\d{3}[-.]\d{4}\b/g],
    // Spain: 612 345 678, 912 34 56 78
    [/\b[6-9]\d{2}(?: \d{3} \d{3}| \d{2} \d{2} \d{2})\b/g],
  ];
  const ranges = [];
  for (const [re, ok] of rules) {
    re.lastIndex = 0;
    for (let m; (m = re.exec(text)); ) if (!ok || ok(m[0])) ranges.push([m.index, m.index + m[0].length]);
  }
  return ranges.sort((a, b) => a[0] - b[0]);
}

/** The text with its personal data replaced by •••, for what is saved with the capture. */
export function hideText(text, { autoMask = true } = {}) {
  const s = String(text ?? "");
  if (!autoMask || !s) return s;
  let out = "";
  let at = 0;
  for (const [start, end] of sensitiveRanges(s)) {
    if (end <= at) continue;
    out += s.slice(at, Math.max(at, start)) + "•••";
    at = end;
  }
  return out + s.slice(at);
}

export async function applyMask(page, { autoMask, mask }) {
  if (!autoMask && !mask.length) return;
  // Sent as source: a site's Content-Security-Policy may forbid building functions from text
  // inside the page, but not what the browser itself is asked to run
  await page.evaluate(`(${inPage})(${JSON.stringify({ autoMask, selectors: mask })}, ${sensitiveRanges})`);
}

/** Runs inside the page. */
function inPage({ autoMask, selectors }, sensitiveRanges) {
  const ATTR = "data-screendocs-mask";
  if (!document.getElementById("screendocs-mask-style")) {
    const style = document.createElement("style");
    style.id = "screendocs-mask-style";
    style.textContent = `[${ATTR}]${selectors.length ? "," + selectors.join(",") : ""}{filter:blur(7px)!important;}`;
    document.head.appendChild(style);
  }
  if (!autoMask || window.__screendocsMask) return;

  const mark = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const hits = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const parent = n.parentElement;
      if (!parent || parent.closest(`[${ATTR}],script,style,noscript`)) continue;
      if (sensitiveRanges(n.data).length) hits.push(n);
    }
    // the whole text node's parent is blurred: simpler and safer for frameworks than splitting nodes
    for (const n of hits) n.parentElement.setAttribute(ATTR, "");
    for (const input of document.querySelectorAll("input, textarea")) {
      if (!input.value || input.hasAttribute(ATTR)) continue;
      if (["email", "tel", "password"].includes(input.type) || sensitiveRanges(input.value).length) input.setAttribute(ATTR, "");
    }
  };

  mark(document.body);
  let pending = false;
  const later = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      mark(document.body);
    });
  };
  new MutationObserver(later).observe(document.body, { childList: true, subtree: true, characterData: true });
  // Typing or a script filling a field changes its value without changing the page
  document.addEventListener("input", later, true);
  window.__screendocsMask = true;
}
