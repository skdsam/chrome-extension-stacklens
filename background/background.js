/**
 * StackLens - Background service worker
 * Author: SkdSam
 *
 * Responsibilities:
 *  - Detect technologies from main-document HTTP response headers
 *  - Detect technologies from cookie names (chrome.cookies — names only, values are never stored)
 *  - Run the main-world probe on request from the content script (JS globals, React/Vue runtime)
 *  - Merge all sources per tab, persist in chrome.storage.session, update the toolbar badge
 *
 * MV3 service workers are shut down when idle, so NO detection state lives in memory.
 */
try {
  importScripts("./data/technologies.js", "./lib/matcher.js", "./lib/main-world-probe.js");
} catch (e1) {
  try {
    importScripts("/data/technologies.js", "/lib/matcher.js", "/lib/main-world-probe.js");
  } catch (e2) {
    console.error("[StackLens] Failed to importScripts in service worker:", e2);
  }
}

const DB = (globalThis.STACKLENS_TECHNOLOGIES) || [];
const M = globalThis.StackLensMatcher || {
  detect: () => [],
  merge: () => [],
  finalize: () => [],
  buildMainWorldPlan: () => ({ paths: [], probes: [] })
};
const MAIN_WORLD_PLAN = M.buildMainWorldPlan ? M.buildMainWorldPlan(DB) : { paths: [], probes: [] };
const HEADER_CACHE_LIMIT = 5;
const BADGE_COLOR = "#6366f1";

// ───────────────────────── Per-tab state (chrome.storage.session) ─────────────────────────

const stateKey = (tabId) => `tab:${tabId}`;

function emptyState() {
  return {
    documentId: null, // document the page results belong to
    retiredDocumentId: null, // previous document — late messages from it are ignored
    url: "",
    headerUrl: "",
    header: [],
    page: [],
    cookie: [],
    headerCache: {}, // documentId -> header hits (restores results on back/forward cache)
    final: [],
    updatedAt: 0
  };
}

// Serialize read-modify-write per tab so concurrent events can't overwrite each other.
const queues = new Map();

function withTabState(tabId, mutator) {
  const prev = queues.get(tabId) || Promise.resolve();
  const next = prev
    .then(async () => {
      const key = stateKey(tabId);
      const stored = await chrome.storage.session.get(key);
      const state = stored[key] || emptyState();
      const changed = await mutator(state);
      if (changed) {
        await chrome.storage.session.set({ [key]: state });
        await updateBadge(tabId, state);
      }
      return state;
    })
    .catch((err) => {
      console.warn("[StackLens] state update failed:", err);
      return null;
    });

  queues.set(tabId, next);
  next.finally(() => {
    if (queues.get(tabId) === next) queues.delete(tabId);
  });
  return next;
}

function recompute(state) {
  state.final = M.finalize(DB, M.merge([state.header, state.page, state.cookie]));
  state.updatedAt = Date.now();
}

function cacheHeader(state, documentId, header) {
  if (!documentId) return;
  delete state.headerCache[documentId];
  state.headerCache[documentId] = header;
  const keys = Object.keys(state.headerCache);
  while (keys.length > HEADER_CACHE_LIMIT) delete state.headerCache[keys.shift()];
}

function sameOrigin(a, b) {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

async function updateBadge(tabId, state) {
  const count = state.final.length;
  try {
    await chrome.action.setBadgeText({ tabId, text: count ? String(count) : "" });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR });
  } catch {
    // Tab may have closed in the meantime.
  }
}

// ───────────────────────── Source 1: HTTP response headers ─────────────────────────

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.tabId < 0 || details.type !== "main_frame") return;

    const headers = (details.responseHeaders || []).map((h) => ({
      name: h.name.toLowerCase(),
      value: h.value || ""
    }));
    const hits = M.detect(DB, { headers });

    // A new main-document response means a navigation: drop the old page's results.
    withTabState(details.tabId, (s) => {
      if (s.documentId) s.retiredDocumentId = s.documentId;
      s.documentId = null;
      s.url = details.url;
      s.headerUrl = details.url;
      s.header = hits;
      s.page = [];
      s.cookie = [];
      recompute(s);
      return true;
    });
  },
  { urls: ["<all_urls>"], types: ["main_frame"] },
  ["responseHeaders"]
);

// ───────────────────────── Source 2: page signals from the content script ─────────────────────────

async function handlePageSignals(msg, sender) {
  const tabId = sender.tab && sender.tab.id;
  if (tabId === undefined || tabId === null || sender.frameId !== 0) return { ok: false };

  const documentId = sender.documentId || null;
  let adoptedNewDocument = false;

  await withTabState(tabId, (s) => {
    // Same document: replace its page results with the latest full scan.
    if (documentId && documentId === s.documentId) {
      s.page = msg.technologies || [];
      s.url = msg.url;
      recompute(s);
      return true;
    }

    // Late message from the page we just navigated away from.
    if (documentId && documentId === s.retiredDocumentId && !msg.restored) return false;

    // A new document. If it follows a fresh header reset on the same origin, keep those headers;
    // otherwise (e.g. back/forward cache restore) recover headers cached for that document.
    const followsHeaderReset = s.documentId === null && sameOrigin(s.headerUrl, msg.url);
    if (!followsHeaderReset) {
      if (s.documentId) cacheHeader(s, s.documentId, s.header);
      s.header = (documentId && s.headerCache[documentId]) || [];
    }
    if (s.documentId && s.documentId !== documentId) s.retiredDocumentId = s.documentId;

    s.documentId = documentId;
    s.url = msg.url;
    s.page = msg.technologies || [];
    s.cookie = [];
    cacheHeader(s, documentId, s.header);
    recompute(s);
    adoptedNewDocument = true;
    return true;
  });

  if (adoptedNewDocument) await refreshCookies(tabId, documentId, msg.url);
  return { ok: true };
}

// ───────────────────────── Source 3: cookie names ─────────────────────────

async function refreshCookies(tabId, documentId, url) {
  let names;
  try {
    const cookies = await chrome.cookies.getAll({ url });
    names = [...new Set(cookies.map((c) => c.name))];
  } catch {
    return;
  }
  const hits = M.detect(DB, { cookies: names });

  await withTabState(tabId, (s) => {
    if (s.documentId !== documentId) return false;
    s.cookie = hits;
    recompute(s);
    return true;
  });
}

// ───────────────────────── Main-world probe (JS globals) ─────────────────────────

async function runMainWorldProbe(sender) {
  const tabId = sender.tab && sender.tab.id;
  if (tabId === undefined || tabId === null) return { globals: {}, probes: {} };

  const target = sender.documentId ? { tabId, documentIds: [sender.documentId] } : { tabId, frameIds: [0] };
  try {
    const [result] = await chrome.scripting.executeScript({
      target,
      world: "MAIN",
      func: globalThis.stackLensMainWorldProbe,
      args: [MAIN_WORLD_PLAN.paths, MAIN_WORLD_PLAN.probes]
    });
    return (result && result.result) || { globals: {}, probes: {} };
  } catch (err) {
    console.warn("[StackLens] main-world probe failed:", err && err.message);
    return { globals: {}, probes: {} };
  }
}

// ───────────────────────── Messaging ─────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return false;

  if (msg.action === "PROBE_MAIN_WORLD") {
    runMainWorldProbe(sender).then(sendResponse);
    return true;
  }

  if (msg.action === "PAGE_SIGNALS") {
    handlePageSignals(msg, sender).then(sendResponse);
    return true;
  }

  if (msg.action === "GET_TAB_STATE") {
    withTabState(msg.tabId, () => false).then((s) => {
      const state = s || emptyState();
      sendResponse({ url: state.url, technologies: state.final, updatedAt: state.updatedAt });
    });
    return true;
  }

  return false;
});

// ───────────────────────── Cleanup ─────────────────────────

chrome.tabs.onRemoved.addListener((tabId) => {
  queues.delete(tabId);
  chrome.storage.session.remove(stateKey(tabId));
});
