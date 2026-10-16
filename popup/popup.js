/**
 * StackLens - Popup Logic
 * Author: SkdSam
 *
 * Interacts with background service worker via GET_TAB_STATE and triggers in-place RESCAN.
 * Renders categorized technologies, logo badges, confidence indicators, extracted items
 * (e.g. WP Theme/Plugins), and expandable evidence drawers.
 */
document.addEventListener("DOMContentLoaded", async () => {
  const domainLabel = document.getElementById("domain-label");
  const techCount = document.getElementById("tech-count");
  const techList = document.getElementById("tech-list");
  const filterInput = document.getElementById("filter-input");
  const stateMessage = document.getElementById("state-message");
  const stateIcon = document.getElementById("state-icon");
  const stateText = document.getElementById("state-text");
  const rescanBtn = document.getElementById("rescan-btn");
  const themeToggleBtn = document.getElementById("theme-toggle-btn");

  const LOGOS = globalThis.STACKLENS_LOGOS || {};
  let allTechnologies = [];

  // ───────────────────────── Apple Mac Theme Engine ─────────────────────────
  async function getStoredTheme() {
    try {
      if (chrome?.storage?.local) {
        const data = await chrome.storage.local.get(["stacklens_theme"]);
        if (data && data.stacklens_theme) return data.stacklens_theme;
      }
    } catch {
      // Fallback
    }
    try {
      return localStorage.getItem("stacklens_theme");
    } catch {
      return null;
    }
  }

  async function setStoredTheme(theme) {
    try {
      if (chrome?.storage?.local) {
        await chrome.storage.local.set({ stacklens_theme: theme });
      }
    } catch {
      // Fallback
    }
    try {
      localStorage.setItem("stacklens_theme", theme);
    } catch {
      // ignore
    }
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === "light") {
      root.setAttribute("data-theme", "light");
      if (themeToggleBtn) {
        themeToggleBtn.setAttribute("title", "Current: Light theme (Click for Dark · Right-click for Auto)");
        themeToggleBtn.setAttribute("aria-label", "Switch to Dark theme");
      }
    } else if (theme === "dark") {
      root.setAttribute("data-theme", "dark");
      if (themeToggleBtn) {
        themeToggleBtn.setAttribute("title", "Current: Dark theme (Click for Light · Right-click for Auto)");
        themeToggleBtn.setAttribute("aria-label", "Switch to Light theme");
      }
    } else {
      // Auto / system default
      root.removeAttribute("data-theme");
      const isSystemLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
      if (themeToggleBtn) {
        const currentName = isSystemLight ? "Light (System)" : "Dark (System)";
        const nextName = isSystemLight ? "Dark" : "Light";
        themeToggleBtn.setAttribute("title", `Current: ${currentName} (Click for ${nextName})`);
        themeToggleBtn.setAttribute("aria-label", `Switch to ${nextName} theme`);
      }
    }
  }

  async function initTheme() {
    const saved = await getStoredTheme();
    if (saved === "light" || saved === "dark") {
      applyTheme(saved);
    } else {
      applyTheme("auto");
    }

    if (themeToggleBtn) {
      themeToggleBtn.addEventListener("click", async () => {
        const currentAttr = document.documentElement.getAttribute("data-theme");
        let nextTheme;

        if (currentAttr === "light") {
          nextTheme = "dark";
        } else if (currentAttr === "dark") {
          nextTheme = "light";
        } else {
          // Auto mode: toggle opposite of current system scheme
          const isSystemLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
          nextTheme = isSystemLight ? "dark" : "light";
        }

        applyTheme(nextTheme);
        await setStoredTheme(nextTheme);
      });

      // Right-click resets to system auto
      themeToggleBtn.addEventListener("contextmenu", async (e) => {
        e.preventDefault();
        applyTheme("auto");
        await setStoredTheme("auto");
      });
    }

    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
        const currentAttr = document.documentElement.getAttribute("data-theme");
        if (!currentAttr) {
          applyTheme("auto");
        }
      });
    }
  }

  initTheme();

  async function getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  }

  async function loadData() {
    const tab = await getActiveTab();
    if (!tab || !tab.url) {
      showState("⚠️", "No active page detected.");
      return;
    }

    if (
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("edge://") ||
      tab.url.startsWith("about:") ||
      tab.url.startsWith("chrome-extension://")
    ) {
      domainLabel.textContent = "Browser Internal Page";
      showState("🛡️", "Extensions cannot inspect internal browser pages.");
      return;
    }

    try {
      const urlObj = new URL(tab.url);
      domainLabel.textContent = urlObj.hostname;
    } catch {
      domainLabel.textContent = tab.url;
    }

    showState("🔍", "Detecting tech stack...");

    try {
      const resp = await chrome.runtime.sendMessage({
        action: "GET_TAB_STATE",
        tabId: tab.id
      });
      allTechnologies = (resp && resp.technologies) || [];
      renderList(allTechnologies);
    } catch (err) {
      showState("⚠️", "Could not connect to background service worker.");
    }
  }

  function getLogoHtml(tech) {
    const iconSlug = tech.icon;
    if (iconSlug && LOGOS[iconSlug]) {
      return `<div class="tech-logo-wrap">${LOGOS[iconSlug]}</div>`;
    }
    const letter = (tech.name || "?").charAt(0).toUpperCase();
    return `<div class="tech-logo-wrap"><div class="tech-logo-fallback">${letter}</div></div>`;
  }

  function getConfidenceClass(item) {
    if (item.implied) return "conf-implied";
    if (item.confidence >= 90) return "conf-high";
    return "conf-med";
  }

  function getConfidenceText(item) {
    if (item.implied) return "Implied";
    if (item.confidence >= 90) return "High";
    if (item.confidence >= 70) return "Medium";
    return "Low";
  }

  function renderList(list) {
    techList.innerHTML = "";
    techCount.textContent = list.length;

    if (list.length === 0) {
      showState("🤔", "No known technologies detected on this page yet.");
      return;
    }

    hideState();

    const grouped = {};
    for (const tech of list) {
      const cat = tech.category || "Other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(tech);
    }

    const categories = Object.keys(grouped).sort();
    for (const cat of categories) {
      const groupEl = document.createElement("div");
      groupEl.className = "tech-category-group";

      const titleEl = document.createElement("div");
      titleEl.className = "category-title";
      titleEl.textContent = cat;
      groupEl.appendChild(titleEl);

      const itemsEl = document.createElement("div");
      itemsEl.className = "category-items";

      for (const item of grouped[cat]) {
        const card = document.createElement("div");
        card.className = "tech-card";

        // Header row
        const header = document.createElement("div");
        header.className = "tech-card-header";

        const info = document.createElement("div");
        info.className = "tech-info";
        info.innerHTML = `${getLogoHtml(item)}<span class="tech-name">${item.name}</span>`;

        const meta = document.createElement("div");
        meta.className = "tech-meta";

        if (item.version) {
          const ver = document.createElement("span");
          ver.className = "version-tag";
          ver.textContent = `v${item.version}`;
          meta.appendChild(ver);
        }

        const conf = document.createElement("span");
        conf.className = `confidence-tag ${getConfidenceClass(item)}`;
        conf.textContent = getConfidenceText(item);
        meta.appendChild(conf);

        const chevron = document.createElement("div");
        chevron.className = "chevron-icon";
        chevron.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        `;
        meta.appendChild(chevron);

        header.appendChild(info);
        header.appendChild(meta);

        // Details drawer
        const drawer = document.createElement("div");
        drawer.className = "tech-details-drawer";

        let drawerContent = `<div class="evidence-header">Detection Evidence</div><ul class="evidence-list">`;
        if (item.evidence && item.evidence.length) {
          for (const ev of item.evidence) {
            drawerContent += `
              <li class="evidence-item">
                <span class="evidence-badge">${ev.type}</span>
                <span>${escapeHtml(ev.detail)}</span>
              </li>
            `;
          }
        } else {
          drawerContent += `<li class="evidence-item">No detailed evidence recorded.</li>`;
        }
        drawerContent += `</ul>`;

        // Extracted items (e.g. WP Theme / Plugins)
        if (item.details && Object.keys(item.details).length) {
          drawerContent += `<div class="extracted-section">`;
          for (const [key, detail] of Object.entries(item.details)) {
            drawerContent += `
              <div class="extracted-label">${escapeHtml(detail.label || key)}:</div>
              <div class="extracted-tags">
                ${detail.values.map((v) => `<span class="extracted-pill">${escapeHtml(v)}</span>`).join("")}
              </div>
            `;
          }
          drawerContent += `</div>`;
        }

        if (item.website) {
          drawerContent += `
            <a class="drawer-footer-link" href="${item.website}" target="_blank" rel="noopener noreferrer">
              Official Website &rarr;
            </a>
          `;
        }

        drawer.innerHTML = drawerContent;

        // Toggle drawer on click
        header.addEventListener("click", () => {
          card.classList.toggle("expanded");
        });

        card.appendChild(header);
        card.appendChild(drawer);
        itemsEl.appendChild(card);
      }

      groupEl.appendChild(itemsEl);
      techList.appendChild(groupEl);
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const clearSearchBtn = document.getElementById("clear-search-btn");

  filterInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (query.length > 0) {
      clearSearchBtn.classList.remove("hidden");
    } else {
      clearSearchBtn.classList.add("hidden");
    }

    if (!query) {
      renderList(allTechnologies);
      return;
    }

    const filtered = allTechnologies.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        (t.category && t.category.toLowerCase().includes(query)) ||
        (t.version && t.version.toLowerCase().includes(query)) ||
        (t.evidence && t.evidence.some((ev) => ev.detail.toLowerCase().includes(query)))
    );
    renderList(filtered);
  });

  clearSearchBtn.addEventListener("click", () => {
    filterInput.value = "";
    clearSearchBtn.classList.add("hidden");
    filterInput.focus();
    renderList(allTechnologies);
  });

  function showState(icon, text) {
    stateIcon.textContent = icon;
    stateText.textContent = text;
    stateMessage.classList.remove("hidden");
    techList.innerHTML = "";
    techCount.textContent = "0";
  }

  function hideState() {
    stateMessage.classList.add("hidden");
  }

  // In-place rescan without full page reload
  rescanBtn.addEventListener("click", async () => {
    const tab = await getActiveTab();
    if (!tab || !tab.id) return;

    rescanBtn.classList.add("spinning");
    try {
      await chrome.tabs.sendMessage(tab.id, { action: "RESCAN" });
    } catch {
      // Content script may not have injected; request manual re-inject
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["data/technologies.js", "lib/matcher.js", "content/content.js"]
        });
      } catch (e) {
        // Restricted tab
      }
    }

    setTimeout(async () => {
      await loadData();
      rescanBtn.classList.remove("spinning");
    }, 600);
  });

  loadData();
});
