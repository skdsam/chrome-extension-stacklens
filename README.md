# StackLens - Web Tech Detector

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-indigo.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)

**StackLens** is a lightning-fast, privacy-first Google Chrome extension that instantly reveals the frameworks, CMS, libraries, analytics, web servers, and hosting providers powering any website you visit.

Repository: **[github.com/skdsam/chrome-extension-stacklens](https://github.com/skdsam/chrome-extension-stacklens)**

---

## ⚡ Key Highlights

- **Multi-Surface Detection Engine:**
  - **DOM & Meta Tags:** Identifies CMS platforms (WordPress, Webflow, Ghost, Drupal, Shopify) and framework root markers (`#__next`, `[ng-version]`, etc.).
  - **Zero-Footprint Main-World Inspection:** Uses Chrome's isolated script runner to inspect deep JavaScript runtimes (`window.React`, `window.__NEXT_DATA__`, `window.Shopify`, `Vue 3`, etc.) without leaving injected tags on the target page.
  - **Compiled CSS Custom Property Sniffing:** Detects modern utility frameworks like **Tailwind CSS** directly from computed CSS variables (`--tw-*`), even when bundled into custom stylesheets.
  - **HTTP Response Headers:** Captures server signatures (`nginx`, `Apache`, `Cloudflare`, `Vercel`, `Netlify`, `AWS`, `PHP`).
  - **Cookie-Based Fingerprinting:** Identifies back-end frameworks like **Laravel** (`laravel_session`), **ASP.NET** (`ASP.NET_SessionId`), **PHP** (`PHPSESSID`), and **Java** (`JSESSIONID`) by cookie names only without ever reading cookie contents.
- **WordPress Theme & Plugin Extractor:** Automatically pulls active theme and plugin slugs from script and stylesheet asset paths.
- **Evidence & Confidence Transparency:** Click on any technology to expand an evidence drawer revealing exactly why it was detected, along with a Confidence Score (High, Medium, Implied).
- **Implied Stack Graph:** Automatically deduces underlying stacks (e.g. Next.js implies React; WooCommerce implies WordPress & PHP).
- **In-Place Rescan:** Rescan single-page apps (SPAs) and dynamic web pages on demand without reloading the whole page.
- **100% Private & Offline:** Operates entirely client-side. Zero external API calls, zero telemetry, zero data collected.

---

## 📦 Installation & Setup

1. Clone or download this repository:
   ```bash
   git clone https://github.com/skdsam/chrome-extension-stacklens.git
   ```
2. Open Google Chrome and navigate to:
   ```
   chrome://extensions/
   ```
3. Enable **Developer mode** via the toggle in the top-right corner.
4. Click the **Load unpacked** button.
5. Select the project folder:
   ```
   D:\scratch\Chrome extension new
   ```
6. Pin **StackLens** to your browser toolbar.
7. Visit any site (e.g. [wordpress.org](https://wordpress.org), [nextjs.org](https://nextjs.org), or [tailwindcss.com](https://tailwindcss.com)) and click the StackLens icon!

---

## 🧪 Testing

Run the automated test suite verifying detection rules, version extraction, and implied stacks:

```bash
pnpm test
# or
node test/matcher.test.js
```

---

## 🛠️ Project Structure

```
├── manifest.json            # Chrome Manifest V3 configuration
├── background/
│   └── background.js        # Persistent service worker (Headers, Cookies, Session state)
├── content/
│   └── content.js           # Isolated DOM, Meta, and CSS scanner with SPA observer
├── lib/
│   ├── matcher.js           # Universal detection engine (shared between content, worker, tests)
│   ├── main-world-probe.js  # Clean JavaScript runtime inspector
│   └── tech-logos.js        # Bundled SVG logos for top technologies
├── data/
│   └── technologies.js      # Fingerprint database (~75 technologies)
├── popup/
│   ├── popup.html           # Popup interface
│   ├── popup.css            # Dark theme styles & evidence drawer
│   └── popup.js             # Categorization, search filter, and interactive UI
├── test/
│   └── matcher.test.js      # Automated unit tests
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 👤 Author

Crafted with care by **SkdSam**  
GitHub: [@skdsam](https://github.com/skdsam)
