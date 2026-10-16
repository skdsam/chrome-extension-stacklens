/**
 * StackLens - Shared detection engine
 * Author: SkdSam
 *
 * Pure functions with no browser dependencies, so the same file runs in:
 *   - the content script (isolated world)
 *   - the background service worker (via importScripts)
 *   - Node.js unit tests (via require)
 *
 * Flow: detect(db, env) -> hits  |  merge([hits...]) -> hits  |  finalize(db, hits) -> display list
 */
(function (root) {
  "use strict";

  /** How much each kind of evidence contributes to confidence (summed per distinct type, capped at 100). */
  const WEIGHTS = {
    meta: 100,
    header: 100,
    global: 100,
    probe: 100,
    cssVar: 90,
    cookie: 80,
    scriptSrc: 75,
    linkHref: 75,
    dom: 75,
    attrPrefix: 70,
    classPattern: 60
  };

  const MAX_EVIDENCE_PER_TYPE = 3;
  const MAX_EXTRACTED_ITEMS = 40;

  const regexCache = new Map();

  function toRegex(pattern) {
    let re = regexCache.get(pattern);
    if (!re) {
      try {
        re = new RegExp(pattern, "i");
      } catch {
        re = /(?!)/; // never matches
      }
      regexCache.set(pattern, re);
    }
    return re;
  }

  function asPatternRule(rule) {
    return typeof rule === "string" ? { pattern: rule } : rule;
  }

  function pickVersion(match, rule) {
    if (!match || !rule.versionGroup) return null;
    const v = match[rule.versionGroup];
    return v ? String(v).trim() : null;
  }

  function truncate(str, max = 140) {
    const s = String(str);
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
  }

  function createCollector() {
    const hits = new Map();
    return {
      add(tech, type, detail, version) {
        let entry = hits.get(tech.name);
        if (!entry) {
          entry = { name: tech.name, version: null, evidence: [], details: {} };
          hits.set(tech.name, entry);
        }
        if (version && !entry.version) entry.version = version;
        const sameType = entry.evidence.filter((e) => e.type === type);
        if (sameType.length < MAX_EVIDENCE_PER_TYPE && !sameType.some((e) => e.detail === detail)) {
          entry.evidence.push({ type, detail: truncate(detail) });
        }
      },
      get(name) {
        return hits.get(name);
      },
      list() {
        return Array.from(hits.values());
      }
    };
  }

  // ---------- Individual rule matchers ----------

  function matchMeta(tech, rules, metas, c) {
    for (const rule of rules) {
      const wanted = rule.name.toLowerCase();
      for (const m of metas) {
        if (m.name !== wanted) continue;
        const match = m.content.match(toRegex(rule.pattern || ".+"));
        if (match) c.add(tech, "meta", `meta[${m.name}] = "${m.content}"`, pickVersion(match, rule));
      }
    }
  }

  function matchHeaders(tech, rules, headers, c) {
    for (const rule of rules) {
      const wanted = rule.name.toLowerCase();
      for (const h of headers) {
        if (h.name !== wanted) continue;
        const match = h.value.match(toRegex(rule.pattern || ".+"));
        if (match) c.add(tech, "header", `${h.name}: ${h.value}`, pickVersion(match, rule));
      }
    }
  }

  function matchCookies(tech, rules, cookieNames, c) {
    for (const raw of rules) {
      const re = toRegex(asPatternRule(raw).pattern);
      for (const name of cookieNames) {
        if (re.test(name)) c.add(tech, "cookie", name, null);
      }
    }
  }

  function matchUrls(tech, rules, urls, type, c) {
    for (const raw of rules) {
      const rule = asPatternRule(raw);
      const re = toRegex(rule.pattern);
      for (const url of urls) {
        const match = url.match(re);
        if (match) {
          c.add(tech, type, url, pickVersion(match, rule));
          break; // one URL per rule is enough evidence
        }
      }
    }
  }

  function matchDom(tech, rules, query, c) {
    for (const raw of rules) {
      const rule = typeof raw === "string" ? { selector: raw } : raw;
      const el = query(rule.selector);
      if (!el) continue;

      if (!rule.attribute) {
        c.add(tech, "dom", rule.selector, null);
        continue;
      }

      const value = el.getAttribute(rule.attribute);
      if (value === null || value === undefined) continue;

      let version = null;
      if (rule.pattern) {
        const match = value.match(toRegex(rule.pattern));
        if (!match) continue;
        version = pickVersion(match, rule);
      } else if (rule.version) {
        version = value || null;
      }
      c.add(tech, "dom", `${rule.selector} [${rule.attribute}="${value}"]`, version);
    }
  }

  function matchAttrPrefix(tech, prefixes, attrNames, c) {
    for (const prefix of prefixes) {
      for (const name of attrNames) {
        if (name.startsWith(prefix)) {
          c.add(tech, "attrPrefix", `attribute ${name}`, null);
          break;
        }
      }
    }
  }

  function matchClassPattern(tech, patterns, classNames, c) {
    for (const pattern of patterns) {
      const re = toRegex(pattern);
      for (const cls of classNames) {
        if (re.test(cls)) {
          c.add(tech, "classPattern", `class .${cls}`, null);
          break;
        }
      }
    }
  }

  function matchCssVars(tech, rules, readCssVar, c) {
    for (const name of rules) {
      const value = readCssVar(name);
      if (value && String(value).trim()) {
        c.add(tech, "cssVar", `${name}: ${String(value).trim()}`, null);
      }
    }
  }

  function isPresent(value) {
    return value !== undefined && value !== null && value !== false;
  }

  function matchGlobals(tech, rules, globals, c) {
    for (const raw of rules) {
      const rule = typeof raw === "string" ? { path: raw } : raw;
      if (!isPresent(globals[rule.path])) continue;

      let version = null;
      if (rule.versionPath) {
        const v = globals[rule.versionPath];
        if (typeof v === "string" || typeof v === "number") version = String(v);
      }
      c.add(tech, "global", version ? `window.${rule.path} (${version})` : `window.${rule.path}`, version);
    }
  }

  function matchProbes(tech, probeNames, probes, c) {
    for (const name of probeNames) {
      const result = probes[name];
      if (!result) continue;
      const version = result.version ? String(result.version) : null;
      c.add(tech, "probe", `${name} runtime found on page elements`, version);
    }
  }

  function runExtractors(entry, extractors, urls) {
    for (const ex of extractors) {
      const re = new RegExp(ex.pattern, "i");
      const found = [];
      for (const url of urls) {
        const m = url.match(re);
        if (!m || !m[1]) continue;
        let value = m[1];
        try {
          value = decodeURIComponent(value);
        } catch {
          /* keep raw */
        }
        if (!found.includes(value)) found.push(value);
        if (found.length >= MAX_EXTRACTED_ITEMS) break;
      }
      if (!found.length) continue;
      entry.details[ex.key] = { label: ex.label, values: ex.multiple ? found.sort() : [found[0]] };
    }
  }

  // ---------- Public API ----------

  /**
   * Run every rule whose signal is present in `env`.
   * env keys are all optional: meta, headers, cookies, scriptSrcs, linkHrefs, urls,
   * query(selector), attrNames, classNames, readCssVar(name), globals, probes.
   */
  function detect(db, env) {
    const c = createCollector();

    for (const tech of db) {
      const r = tech.rules || {};
      if (env.meta && r.meta) matchMeta(tech, r.meta, env.meta, c);
      if (env.headers && r.headers) matchHeaders(tech, r.headers, env.headers, c);
      if (env.cookies && r.cookies) matchCookies(tech, r.cookies, env.cookies, c);
      if (env.scriptSrcs && r.scriptSrc) matchUrls(tech, r.scriptSrc, env.scriptSrcs, "scriptSrc", c);
      if (env.linkHrefs && r.linkHref) matchUrls(tech, r.linkHref, env.linkHrefs, "linkHref", c);
      if (env.query && r.dom) matchDom(tech, r.dom, env.query, c);
      if (env.attrNames && r.attrPrefix) matchAttrPrefix(tech, r.attrPrefix, env.attrNames, c);
      if (env.classNames && r.classPattern) matchClassPattern(tech, r.classPattern, env.classNames, c);
      if (env.readCssVar && r.cssVars) matchCssVars(tech, r.cssVars, env.readCssVar, c);
      if (env.globals && r.window) matchGlobals(tech, r.window, env.globals, c);
      if (env.probes && r.probes) matchProbes(tech, r.probes, env.probes, c);

      const entry = c.get(tech.name);
      if (entry && tech.extract && env.urls) runExtractors(entry, tech.extract, env.urls);
    }

    return c.list();
  }

  /** Combine hit lists from different sources (page, headers, cookies). */
  function merge(lists) {
    const map = new Map();
    for (const list of lists) {
      for (const hit of list || []) {
        let entry = map.get(hit.name);
        if (!entry) {
          entry = { name: hit.name, version: null, evidence: [], details: {} };
          map.set(hit.name, entry);
        }
        if (hit.version && !entry.version) entry.version = hit.version;
        for (const ev of hit.evidence || []) {
          if (!entry.evidence.some((e) => e.type === ev.type && e.detail === ev.detail)) {
            entry.evidence.push({ type: ev.type, detail: ev.detail });
          }
        }
        for (const [key, detail] of Object.entries(hit.details || {})) {
          const existing = entry.details[key];
          if (!existing) {
            entry.details[key] = { label: detail.label, values: [...detail.values] };
          } else {
            for (const v of detail.values) if (!existing.values.includes(v)) existing.values.push(v);
          }
        }
      }
    }
    return Array.from(map.values());
  }

  /** Resolve implied technologies, compute confidence, attach catalog data, and sort. */
  function finalize(db, hits) {
    const byName = new Map(db.map((t) => [t.name, t]));
    const map = new Map();
    for (const h of hits) {
      map.set(h.name, {
        name: h.name,
        version: h.version || null,
        evidence: h.evidence.map((e) => ({ ...e })),
        details: JSON.parse(JSON.stringify(h.details || {}))
      });
    }

    const queue = Array.from(map.keys());
    while (queue.length) {
      const parentName = queue.shift();
      const parent = byName.get(parentName);
      if (!parent || !parent.implies) continue;
      for (const impliedName of parent.implies) {
        if (!byName.has(impliedName)) continue;
        let entry = map.get(impliedName);
        if (!entry) {
          entry = { name: impliedName, version: null, evidence: [], details: {} };
          map.set(impliedName, entry);
          queue.push(impliedName);
        }
        if (!entry.evidence.some((e) => e.type === "implied" && e.detail === parentName)) {
          entry.evidence.push({ type: "implied", detail: parentName });
        }
      }
    }

    return Array.from(map.values())
      .map((entry) => {
        const tech = byName.get(entry.name) || {};
        const direct = entry.evidence.filter((e) => e.type !== "implied");
        const types = new Set(direct.map((e) => e.type));
        let score = 0;
        for (const t of types) score += WEIGHTS[t] || 50;
        return {
          ...entry,
          category: tech.category || "Other",
          website: tech.website || null,
          icon: tech.icon || null,
          implied: direct.length === 0,
          confidence: Math.min(100, score)
        };
      })
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }

  function confidenceLabel(item) {
    if (item.implied) return "Implied";
    if (item.confidence >= 90) return "High";
    if (item.confidence >= 70) return "Medium";
    return "Low";
  }

  /** Global paths and probes the main-world script must read. */
  function buildMainWorldPlan(db) {
    const paths = new Set();
    const probes = new Set();
    for (const tech of db) {
      const r = tech.rules || {};
      for (const raw of r.window || []) {
        const rule = typeof raw === "string" ? { path: raw } : raw;
        paths.add(rule.path);
        if (rule.versionPath) paths.add(rule.versionPath);
      }
      for (const p of r.probes || []) probes.add(p);
    }
    return { paths: Array.from(paths), probes: Array.from(probes) };
  }

  const api = {
    WEIGHTS,
    detect,
    merge,
    finalize,
    confidenceLabel,
    buildMainWorldPlan
  };

  root.StackLensMatcher = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
