/**
 * StackLens - Content script (isolated world)
 * Author: SkdSam
 *
 * Collects page signals (meta, script/link URLs, DOM, attributes, classes, CSS variables),
 * asks the service worker for main-world globals, runs the shared matcher, and reports results.
 * Rescans automatically while the page is still changing (SPAs, lazy-loaded scripts).
 */
(() => {
  // Guard against double injection (manifest + popup fallback via chrome.scripting).
  if (globalThis.__stackLensContentLoaded) return;
  globalThis.__stackLensContentLoaded = true;

  const DB = globalThis.STACKLENS_TECHNOLOGIES;
  const M = globalThis.StackLensMatcher;
  if (!DB || !M) return;

  const ELEMENT_SAMPLE_LIMIT = 3000;
  const CLASS_LIMIT = 8000;
  const IMG_LIMIT = 300;
  const OBSERVE_WINDOW_MS = 60000;
  const MUTATION_DEBOUNCE_MS = 1500;

  let lastKey = "";
  let lastUrl = "";
  let scanning = false;
  let rescanQueued = false;
  let debounceTimer = null;
  let observeUntil = Date.now() + OBSERVE_WINDOW_MS;
  let contextAlive = true;

  // ───────────── Signal collection ─────────────

  function unique(list) {
    return Array.from(new Set(list.filter(Boolean)));
  }

  function collectEnv(main) {
    const meta = Array.from(document.querySelectorAll("meta[name], meta[property], meta[http-equiv]")).map((m) => ({
      name: (m.getAttribute("name") || m.getAttribute("property") || m.getAttribute("http-equiv") || "").toLowerCase(),
      content: m.getAttribute("content") || ""
    }));

    const scriptSrcs = unique(Array.from(document.scripts, (s) => s.src));
    const linkHrefs = unique(Array.from(document.querySelectorAll("link[href]"), (l) => l.href));
    const imgSrcs = unique(Array.from(document.images).slice(0, IMG_LIMIT).map((i) => i.currentSrc || i.src));

    const attrNames = new Set();
    const classNames = new Set();
    const all = document.getElementsByTagName("*");
    for (let i = 0; i < all.length && i < ELEMENT_SAMPLE_LIMIT; i++) {
      const el = all[i];
      for (const attr of el.attributes) attrNames.add(attr.name);
      if (classNames.size < CLASS_LIMIT && el.classList) {
        for (const cls of el.classList) classNames.add(cls);
      }
    }

    const htmlStyle = getComputedStyle(document.documentElement);
    const bodyStyle = document.body ? getComputedStyle(document.body) : null;

    return {
      meta,
      scriptSrcs,
      linkHrefs,
      urls: [...scriptSrcs, ...linkHrefs, ...imgSrcs],
      attrNames,
      classNames,
      query: (selector) => {
        try {
          return document.querySelector(selector);
        } catch {
          return null;
        }
      },
      readCssVar: (name) =>
        htmlStyle.getPropertyValue(name) || (bodyStyle ? bodyStyle.getPropertyValue(name) : ""),
      globals: (main && main.globals) || {},
      probes: (main && main.probes) || {}
    };
  }

  // ───────────── Messaging helpers ─────────────

  async function send(message) {
    if (!contextAlive) return undefined;
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (err) {
      // Extension was reloaded/updated: this content script is orphaned, so stop working.
      if (String(err && err.message).includes("Extension context invalidated")) {
        contextAlive = false;
        observer.disconnect();
      }
      return undefined;
    }
  }

  // ───────────── Scanning ─────────────

  async function scan({ force = false, restored = false } = {}) {
    if (scanning) {
      rescanQueued = true;
      return null;
    }
    scanning = true;
    try {
      const main = await send({ action: "PROBE_MAIN_WORLD" });
      const technologies = M.detect(DB, collectEnv(main));
      const key = JSON.stringify(technologies);

      if (force || restored || key !== lastKey || location.href !== lastUrl) {
        lastKey = key;
        lastUrl = location.href;
        await send({ action: "PAGE_SIGNALS", url: location.href, technologies, restored });
      }
      return technologies;
    } finally {
      scanning = false;
      if (rescanQueued) {
        rescanQueued = false;
        scheduleScan(300);
      }
    }
  }

  function scheduleScan(delay) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => scan(), delay);
  }

  // Rescan while the DOM keeps changing — for 60s after load, and again after SPA navigations.
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) observeUntil = Date.now() + OBSERVE_WINDOW_MS;
    if (Date.now() > observeUntil) return;
    scheduleScan(MUTATION_DEBOUNCE_MS);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Restored from back/forward cache: resend so the service worker re-adopts this document.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) scan({ restored: true });
  });

  // Popup actions.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return false;
    if (msg.action === "PING") {
      sendResponse({ ok: true });
      return false;
    }
    if (msg.action === "RESCAN") {
      observeUntil = Date.now() + OBSERVE_WINDOW_MS;
      scan({ force: true }).then(() => sendResponse({ ok: true }));
      return true;
    }
    return false;
  });

  // Initial scan plus two delayed passes for late-loading scripts.
  scan();
  setTimeout(() => scan(), 2000);
  setTimeout(() => scan(), 6000);
})();
