/**
 * Blurs personal data before anything is captured: emails, phone numbers, CPF/CNPJ
 * found in the page text, filled email/phone/password inputs, and any extra CSS
 * selectors the user passes with --mask. It is a CSS blur, so screenshots and
 * videos are both covered, and an observer keeps blurring content that loads later.
 */
export async function applyMask(page, { autoMask, mask }) {
  if (!autoMask && !mask.length) return;
  await page.evaluate(
    ({ autoMask, selectors }) => {
      const ATTR = "data-screendocs-mask";
      if (!document.getElementById("screendocs-mask-style")) {
        const style = document.createElement("style");
        style.id = "screendocs-mask-style";
        style.textContent = `[${ATTR}]${selectors.length ? "," + selectors.join(",") : ""}{filter:blur(7px)!important;}`;
        document.head.appendChild(style);
      }
      if (!autoMask || window.__screendocsMask) return;

      const PATTERN = new RegExp(
        [
          "[\\w.+-]+@[\\w-]+\\.[\\w.-]+", // email
          "\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}", // CPF
          "\\d{2}\\.\\d{3}\\.\\d{3}/\\d{4}-\\d{2}", // CNPJ
          "(?:\\+\\d{1,3}[\\s-]?)?\\(?\\d{2,3}\\)?[\\s-]?\\d{4,5}[\\s-]\\d{4}", // phone
        ].join("|"),
        "g",
      );

      const mark = (root) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const hits = [];
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const parent = n.parentElement;
          if (!parent || parent.closest(`[${ATTR}],script,style,noscript`)) continue;
          PATTERN.lastIndex = 0;
          if (PATTERN.test(n.data)) hits.push(n);
        }
        for (const n of hits) {
          // the whole text node's parent is blurred: simpler and safer for frameworks than splitting nodes
          n.parentElement.setAttribute(ATTR, "");
        }
        for (const input of document.querySelectorAll("input[type=email],input[type=tel],input[type=password]")) {
          if (input.value) input.setAttribute(ATTR, "");
        }
      };

      mark(document.body);
      let pending = false;
      new MutationObserver(() => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
          pending = false;
          mark(document.body);
        });
      }).observe(document.body, { childList: true, subtree: true, characterData: true });
      window.__screendocsMask = true;
    },
    { autoMask, selectors: mask },
  );
}
