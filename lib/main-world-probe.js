/**
 * StackLens - Main-world probe
 * Author: SkdSam
 *
 * Executed by the service worker via chrome.scripting.executeScript({ world: "MAIN", func }).
 * The function is serialized, so it MUST be fully self-contained (no outer references).
 * Nothing is left behind on the page: no <script> tags, no listeners, no web-accessible files.
 *
 * @param {string[]} paths  Global property paths to read, e.g. "jQuery.fn.jquery"
 * @param {string[]} probes Runtime probes to run, e.g. "react", "vue"
 * @returns {{ globals: Object<string, string|true>, probes: Object<string, {version: string|null}> }}
 */
globalThis.stackLensMainWorldProbe = function stackLensMainWorldProbe(paths, probes) {
  const out = { globals: {}, probes: {} };

  function readPath(path) {
    let cur = window;
    for (const key of path.split(".")) {
      if (cur === null || cur === undefined) return undefined;
      const t = typeof cur;
      if (t !== "object" && t !== "function") return undefined;
      try {
        cur = cur[key];
      } catch {
        return undefined;
      }
    }
    return cur;
  }

  for (const path of paths || []) {
    const value = readPath(path);
    if (value === undefined || value === null) continue;
    if (typeof value === "string" || typeof value === "number") {
      out.globals[path] = String(value).slice(0, 64);
    } else {
      out.globals[path] = true;
    }
  }

  const wanted = new Set(probes || []);
  if (!wanted.size || !document.body) return out;

  const SAMPLE_LIMIT = 2000;
  const elements = [document.documentElement, document.body];
  const all = document.body.getElementsByTagName("*");
  for (let i = 0; i < all.length && i < SAMPLE_LIMIT; i++) elements.push(all[i]);

  if (wanted.has("react")) {
    let found = false;
    let version = null;

    // React registers its renderers with the DevTools hook (present only if React DevTools is installed).
    try {
      const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (hook && hook.renderers && hook.renderers.size) {
        found = true;
        for (const renderer of hook.renderers.values()) {
          if (renderer && renderer.version) {
            version = String(renderer.version);
            break;
          }
        }
      }
    } catch {
      /* ignore */
    }

    // React 16+ attaches internal keys to every DOM node it renders.
    if (!found) {
      outer: for (const el of elements) {
        let keys;
        try {
          keys = Object.keys(el);
        } catch {
          continue;
        }
        for (const k of keys) {
          if (
            k.startsWith("__reactFiber$") ||
            k.startsWith("__reactContainer$") ||
            k.startsWith("__reactInternalInstance$") ||
            k === "_reactRootContainer"
          ) {
            found = true;
            break outer;
          }
        }
      }
    }

    if (found) out.probes.react = { version };
  }

  if (wanted.has("vue")) {
    for (const el of elements) {
      try {
        if (el.__vue_app__) {
          out.probes.vue = { version: el.__vue_app__.version ? String(el.__vue_app__.version) : null };
          break;
        }
        if (el.__vue__) {
          let ctor = el.__vue__.constructor;
          while (ctor && ctor.super) ctor = ctor.super;
          out.probes.vue = { version: ctor && ctor.version ? String(ctor.version) : null };
          break;
        }
      } catch {
        /* ignore */
      }
    }
  }

  return out;
};
