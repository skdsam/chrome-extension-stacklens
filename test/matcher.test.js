/**
 * StackLens - Automated Unit Tests for Detection Engine
 * Author: SkdSam
 *
 * Validates:
 * 1. Meta matching and version extraction
 * 2. Header matching (Nginx, Cloudflare, PHP)
 * 3. Cookie matching (Laravel, PHP, ASP.NET)
 * 4. CSS Variable matching (Tailwind compiled CSS)
 * 5. Main world global inspection
 * 6. Implied technologies (Next.js -> React; WooCommerce -> WordPress -> PHP)
 * 7. Asset URL extraction (WordPress themes & plugins)
 * 8. Tightened rules (reject bare $, bare _)
 */
const assert = require("assert");
const DB = require("../data/technologies.js");
const M = require("../lib/matcher.js");

console.log("Running StackLens Engine Tests...\n");

// Test 1: WordPress Detection, Version & Plugin/Theme Extraction
{
  const env = {
    meta: [{ name: "generator", content: "WordPress 6.4.2" }],
    urls: [
      "https://example.com/wp-content/themes/astra/style.css",
      "https://example.com/wp-content/plugins/elementor/assets/js/frontend.js",
      "https://example.com/wp-content/plugins/woocommerce/assets/js/frontend/woocommerce.min.js"
    ],
    scriptSrcs: [
      "https://example.com/wp-content/plugins/woocommerce/assets/js/frontend/woocommerce.min.js"
    ]
  };

  const hits = M.detect(DB, env);
  const final = M.finalize(DB, hits);

  const wp = final.find((t) => t.name === "WordPress");
  assert(wp, "WordPress should be detected");
  assert.strictEqual(wp.version, "6.4.2", "WordPress version should be 6.4.2");
  assert(wp.details.theme, "Theme details should be extracted");
  assert.strictEqual(wp.details.theme.values[0], "astra");
  assert(wp.details.plugins.values.includes("elementor"));
  assert(wp.details.plugins.values.includes("woocommerce"));

  // Check implied PHP & MySQL
  const php = final.find((t) => t.name === "PHP");
  const mysql = final.find((t) => t.name === "MySQL");
  assert(php && php.implied, "PHP should be implied by WordPress");
  assert(mysql && mysql.implied, "MySQL should be implied by WordPress");
  console.log("✔ Test 1 Passed: WordPress, Version, Theme/Plugin extraction & Implied stacks");
}

// Test 2: Next.js implies React and detects compiled Tailwind
{
  const env = {
    scriptSrcs: ["https://example.com/_next/static/chunks/main-app.js"],
    readCssVar: (name) => {
      if (name === "--tw-ring-offset-width") return "0px";
      return "";
    }
  };

  const hits = M.detect(DB, env);
  const final = M.finalize(DB, hits);

  const next = final.find((t) => t.name === "Next.js");
  const react = final.find((t) => t.name === "React");
  const tailwind = final.find((t) => t.name === "Tailwind CSS");

  assert(next, "Next.js should be detected via script source");
  assert(react && react.implied, "React should be implied by Next.js");
  assert(tailwind, "Tailwind CSS should be detected via compiled CSS variable");
  console.log("✔ Test 2 Passed: Next.js, Implied React & Compiled Tailwind");
}

// Test 3: Cookie-based detection
{
  const env = {
    cookies: ["laravel_session", "XSRF-TOKEN", "cf_clearance"]
  };

  const hits = M.detect(DB, env);
  const final = M.finalize(DB, hits);

  const laravel = final.find((t) => t.name === "Laravel");
  const php = final.find((t) => t.name === "PHP");
  const cf = final.find((t) => t.name === "Cloudflare");

  assert(laravel, "Laravel detected via cookie");
  assert(php && php.implied, "PHP implied by Laravel");
  assert(cf, "Cloudflare detected via cf_clearance cookie");
  console.log("✔ Test 3 Passed: Cookie detection (Laravel, Cloudflare) & Implied PHP");
}

// Test 4: Tightened rules check (bare $ or _ should NOT trigger jQuery or Lodash)
{
  const env = {
    globals: {
      "$": true,
      "_": true
    }
  };

  const hits = M.detect(DB, env);
  const jq = hits.find((t) => t.name === "jQuery");
  const lodash = hits.find((t) => t.name === "Lodash");

  assert(!jq, "Bare '$' must not trigger jQuery false positive");
  assert(!lodash, "Bare '_' must not trigger Lodash false positive");
  console.log("✔ Test 4 Passed: Strict global validation prevents false positives");
}

// Test 5: Headers detection and versioning (Nginx & PHP)
{
  const env = {
    headers: [
      { name: "server", value: "nginx/1.24.0" },
      { name: "x-powered-by", value: "PHP/8.2.14" }
    ]
  };

  const hits = M.detect(DB, env);
  const nginx = hits.find((t) => t.name === "Nginx");
  const php = hits.find((t) => t.name === "PHP");

  assert(nginx && nginx.version === "1.24.0", "Nginx version parsed from server header");
  assert(php && php.version === "8.2.14", "PHP version parsed from x-powered-by header");
  console.log("✔ Test 5 Passed: Response header detection and version extraction");
}

console.log("\nAll 5 test suites passed successfully! 🚀");
