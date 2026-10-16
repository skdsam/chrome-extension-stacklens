/**
 * StackLens - Technology fingerprint database
 * Author: SkdSam
 *
 * Loaded synchronously by the service worker (importScripts), the content script, and Node tests.
 *
 * Rule types (all optional; patterns are case-insensitive regex strings):
 *   meta:         [{ name, pattern, versionGroup }]          <meta name|property|http-equiv>
 *   headers:      [{ name, pattern, versionGroup }]          HTTP response headers (main document)
 *   cookies:      ["^name$"]                                  cookie names only — values are never read
 *   scriptSrc:    ["pattern" | { pattern, versionGroup }]     <script src>
 *   linkHref:     ["pattern" | { pattern, versionGroup }]     <link href>
 *   dom:          ["selector" | { selector, attribute, pattern?, versionGroup?, version? }]
 *   attrPrefix:   ["data-v-"]                                 attribute names starting with prefix
 *   classPattern: ["^svelte-[a-z0-9]{5,}$"]                   class tokens
 *   cssVars:      ["--tw-ring-offset-width"]                  computed CSS custom properties
 *   window:       ["path" | { path, versionPath }]            JS globals (read in the page's main world)
 *   probes:       ["react" | "vue"]                           runtime checks on DOM nodes (main world)
 *   implies:      ["Tech name"]                               add these when this tech is found
 *   extract:      [{ key, label, pattern, multiple }]         pull details (group 1) from asset URLs
 *
 * `icon` is a Simple Icons slug (https://simpleicons.org). Missing icons fall back to a letter avatar.
 */
(function (root) {
  "use strict";

  const TECHNOLOGIES = [
    // ───────────────────────── CMS & Site Builders ─────────────────────────
    {
      name: "WordPress",
      category: "CMS",
      website: "https://wordpress.org",
      icon: "wordpress",
      implies: ["PHP", "MySQL"],
      rules: {
        meta: [{ name: "generator", pattern: "^WordPress(?:\\s+([\\d.]+))?", versionGroup: 1 }],
        headers: [{ name: "link", pattern: "api\\.w\\.org" }],
        scriptSrc: ["/wp-(?:content|includes)/"],
        linkHref: ["/wp-(?:content|includes)/"],
        dom: ["link[rel='https://api.w.org/']"]
      },
      extract: [
        { key: "theme", label: "Theme", pattern: "/wp-content/themes/([^/?#]+)/", multiple: false },
        { key: "plugins", label: "Plugins", pattern: "/wp-content/plugins/([^/?#]+)/", multiple: true }
      ]
    },
    {
      name: "WooCommerce",
      category: "Ecommerce",
      website: "https://woocommerce.com",
      icon: "woocommerce",
      implies: ["WordPress"],
      rules: {
        meta: [{ name: "generator", pattern: "^WooCommerce(?:\\s+([\\d.]+))?", versionGroup: 1 }],
        scriptSrc: ["/wp-content/plugins/woocommerce/"],
        window: ["woocommerce_params", "wc_add_to_cart_params"],
        dom: ["body.woocommerce", "body.woocommerce-page"]
      }
    },
    {
      name: "Shopify",
      category: "Ecommerce",
      website: "https://www.shopify.com",
      icon: "shopify",
      rules: {
        window: ["Shopify.shop", "ShopifyAnalytics"],
        scriptSrc: ["cdn\\.shopify\\.com"],
        linkHref: ["cdn\\.shopify\\.com"],
        headers: [{ name: "x-shopid", pattern: ".+" }, { name: "x-shopify-stage", pattern: ".+" }],
        cookies: ["^_shopify_y$", "^_shopify_s$"]
      }
    },
    {
      name: "Webflow",
      category: "Site Builder",
      website: "https://webflow.com",
      icon: "webflow",
      rules: {
        meta: [{ name: "generator", pattern: "Webflow" }],
        dom: ["html[data-wf-page]", "html[data-wf-site]"]
      }
    },
    {
      name: "Squarespace",
      category: "Site Builder",
      website: "https://www.squarespace.com",
      icon: "squarespace",
      rules: {
        window: ["Static.SQUARESPACE_CONTEXT"],
        scriptSrc: ["(?:static1|assets)\\.squarespace\\.com"],
        linkHref: ["(?:static1|assets)\\.squarespace\\.com"],
        headers: [{ name: "server", pattern: "Squarespace" }]
      }
    },
    {
      name: "Wix",
      category: "Site Builder",
      website: "https://www.wix.com",
      icon: "wix",
      rules: {
        meta: [{ name: "generator", pattern: "Wix\\.com Website Builder" }],
        headers: [{ name: "x-wix-request-id", pattern: ".+" }],
        scriptSrc: ["static\\.parastorage\\.com"]
      }
    },
    {
      name: "Ghost",
      category: "CMS",
      website: "https://ghost.org",
      icon: "ghost",
      implies: ["Node.js"],
      rules: {
        meta: [{ name: "generator", pattern: "^Ghost(?:\\s+([\\d.]+))?", versionGroup: 1 }],
        scriptSrc: ["/ghost/portal", "/ghost/sodo-search"]
      }
    },
    {
      name: "Drupal",
      category: "CMS",
      website: "https://www.drupal.org",
      icon: "drupal",
      implies: ["PHP"],
      rules: {
        meta: [{ name: "generator", pattern: "^Drupal(?:\\s+([\\d.]+))?", versionGroup: 1 }],
        headers: [
          { name: "x-generator", pattern: "Drupal(?:\\s+([\\d.]+))?", versionGroup: 1 },
          { name: "x-drupal-cache", pattern: ".+" }
        ],
        window: ["Drupal", "drupalSettings"],
        scriptSrc: ["/core/misc/drupal\\.js", "/sites/(?:default|all)/"]
      }
    },
    {
      name: "Joomla",
      category: "CMS",
      website: "https://www.joomla.org",
      icon: "joomla",
      implies: ["PHP"],
      rules: {
        meta: [{ name: "generator", pattern: "Joomla!?(?:\\s+([\\d.]+))?", versionGroup: 1 }],
        scriptSrc: ["/media/jui/js/", "/media/system/js/"]
      }
    },

    // ───────────────────────── JavaScript frameworks & libraries ─────────────────────────
    {
      name: "React",
      category: "JavaScript Library",
      website: "https://react.dev",
      icon: "react",
      rules: {
        probes: ["react"],
        window: [{ path: "React.version", versionPath: "React.version" }],
        dom: ["[data-reactroot]"]
      }
    },
    {
      name: "Next.js",
      category: "Web Framework",
      website: "https://nextjs.org",
      icon: "nextdotjs",
      implies: ["React"],
      rules: {
        window: [{ path: "next.version", versionPath: "next.version" }, "__NEXT_DATA__", "__next_f"],
        scriptSrc: ["/_next/static/"],
        dom: ["#__next"],
        headers: [
          { name: "x-powered-by", pattern: "Next\\.js(?:\\s+([\\d.]+))?", versionGroup: 1 },
          { name: "x-nextjs-cache", pattern: ".+" }
        ]
      }
    },
    {
      name: "Gatsby",
      category: "Web Framework",
      website: "https://www.gatsbyjs.com",
      icon: "gatsby",
      implies: ["React"],
      rules: {
        meta: [{ name: "generator", pattern: "^Gatsby(?:\\s+([\\d.]+))?", versionGroup: 1 }],
        dom: ["#___gatsby"]
      }
    },
    {
      name: "Remix",
      category: "Web Framework",
      website: "https://remix.run",
      icon: "remix",
      implies: ["React"],
      rules: {
        window: ["__remixContext", "__remixManifest"]
      }
    },
    {
      name: "React Router",
      category: "Web Framework",
      website: "https://reactrouter.com",
      icon: "reactrouter",
      implies: ["React"],
      rules: {
        window: ["__reactRouterContext", "__reactRouterManifest"]
      }
    },
    {
      name: "Vue.js",
      category: "JavaScript Framework",
      website: "https://vuejs.org",
      icon: "vuedotjs",
      rules: {
        probes: ["vue"],
        window: [{ path: "Vue.version", versionPath: "Vue.version" }],
        attrPrefix: ["data-v-"]
      }
    },
    {
      name: "Nuxt",
      category: "Web Framework",
      website: "https://nuxt.com",
      icon: "nuxt",
      implies: ["Vue.js"],
      rules: {
        window: ["__NUXT__", "$nuxt"],
        dom: ["#__nuxt", "#__NUXT_DATA__"],
        scriptSrc: ["/_nuxt/"]
      }
    },
    {
      name: "Angular",
      category: "JavaScript Framework",
      website: "https://angular.dev",
      icon: "angular",
      rules: {
        dom: [{ selector: "[ng-version]", attribute: "ng-version", version: true }],
        attrPrefix: ["_nghost-", "_ngcontent-"],
        window: ["getAllAngularRootElements"]
      }
    },
    {
      name: "AngularJS",
      category: "JavaScript Framework",
      website: "https://angularjs.org",
      icon: "angularjs",
      rules: {
        window: [{ path: "angular.version.full", versionPath: "angular.version.full" }],
        dom: ["[ng-app]", "[data-ng-app]"]
      }
    },
    {
      name: "Svelte",
      category: "JavaScript Framework",
      website: "https://svelte.dev",
      icon: "svelte",
      rules: {
        classPattern: ["^svelte-[a-z0-9]{5,}$"],
        window: ["__svelte"]
      }
    },
    {
      name: "SvelteKit",
      category: "Web Framework",
      website: "https://svelte.dev/docs/kit",
      icon: "svelte",
      implies: ["Svelte"],
      rules: {
        dom: ["[data-sveltekit-preload-data]", "[data-sveltekit-hydrate]"],
        scriptSrc: ["/_app/immutable/"],
        linkHref: ["/_app/immutable/"]
      }
    },
    {
      name: "Astro",
      category: "Web Framework",
      website: "https://astro.build",
      icon: "astro",
      rules: {
        meta: [{ name: "generator", pattern: "^Astro(?:\\s+v?([\\d.]+))?", versionGroup: 1 }],
        attrPrefix: ["data-astro-cid-"],
        dom: ["astro-island"],
        classPattern: ["^astro-[a-z0-9]{8}$"]
      }
    },
    {
      name: "Alpine.js",
      category: "JavaScript Framework",
      website: "https://alpinejs.dev",
      icon: "alpinedotjs",
      rules: {
        window: [{ path: "Alpine.version", versionPath: "Alpine.version" }],
        scriptSrc: ["alpinejs"]
      }
    },
    {
      name: "htmx",
      category: "JavaScript Library",
      website: "https://htmx.org",
      icon: "htmx",
      rules: {
        window: [{ path: "htmx.version", versionPath: "htmx.version" }],
        dom: ["[hx-get]", "[hx-post]", "[data-hx-get]"]
      }
    },
    {
      name: "jQuery",
      category: "JavaScript Library",
      website: "https://jquery.com",
      icon: "jquery",
      rules: {
        // `jQuery.fn.jquery` only exists on real jQuery — a bare `$` is used by many libraries.
        window: [{ path: "jQuery.fn.jquery", versionPath: "jQuery.fn.jquery" }],
        scriptSrc: [{ pattern: "/jquery(?:-(\\d+(?:\\.\\d+)+))?(?:\\.slim)?(?:\\.min)?\\.js", versionGroup: 1 }]
      }
    },
    {
      name: "Lodash",
      category: "JavaScript Library",
      website: "https://lodash.com",
      icon: "lodash",
      rules: {
        // `_.cloneDeep` distinguishes Lodash from Underscore.js.
        window: [{ path: "_.cloneDeep", versionPath: "_.VERSION" }],
        scriptSrc: ["/lodash(?:\\.min)?\\.js"]
      }
    },
    {
      name: "Three.js",
      category: "3D / Graphics",
      website: "https://threejs.org",
      icon: "threedotjs",
      rules: {
        window: [
          { path: "THREE.REVISION", versionPath: "THREE.REVISION" },
          { path: "__THREE__", versionPath: "__THREE__" },
          "THREE.WebGLRenderer",
          "THREE.Scene"
        ],
        scriptSrc: [
          "/three(?:\\.module)?(?:\\.min)?\\.js",
          "threejs",
          "unpkg\\.com/three",
          "cdn\\.jsdelivr\\.net/npm/three",
          "cdnjs\\.cloudflare\\.com/ajax/libs/three\\.js"
        ],
        dom: ["canvas[data-engine*='three.js']"]
      }
    },
    {
      name: "GSAP",
      category: "Animation",
      website: "https://gsap.com",
      icon: "greensock",
      rules: {
        window: [{ path: "gsap.version", versionPath: "gsap.version" }, "TweenMax", "TimelineMax"],
        scriptSrc: ["/gsap(?:\\.min)?\\.js", "tweenmax"]
      }
    },
    {
      name: "Anime.js",
      category: "Animation",
      website: "https://animejs.com",
      icon: null,
      rules: {
        window: [{ path: "anime.version", versionPath: "anime.version" }],
        scriptSrc: ["anime(?:\\.min)?\\.js"]
      }
    },
    {
      name: "Lottie",
      category: "Animation",
      website: "https://airbnb.io/lottie/",
      icon: null,
      rules: {
        window: ["lottie", "bodymovin"],
        scriptSrc: ["lottie(?:-player)?", "bodymovin"],
        dom: ["lottie-player", "dotlottie-player"]
      }
    },
    {
      name: "Axios",
      category: "JavaScript Library",
      website: "https://axios-http.com",
      icon: "axios",
      rules: {
        window: [{ path: "axios.isAxiosError", versionPath: "axios.VERSION" }],
        scriptSrc: ["axios(?:\\.min)?\\.js"]
      }
    },
    {
      name: "D3.js",
      category: "Data Visualization",
      website: "https://d3js.org",
      icon: "d3dotjs",
      rules: {
        window: [{ path: "d3.version", versionPath: "d3.version" }],
        scriptSrc: ["d3(?:\\.v\\d+)?(?:\\.min)?\\.js"]
      }
    },
    {
      name: "Chart.js",
      category: "Data Visualization",
      website: "https://www.chartjs.org",
      icon: "chartdotjs",
      rules: {
        window: [{ path: "Chart.version", versionPath: "Chart.version" }],
        scriptSrc: ["chart(?:\\.min)?\\.js"]
      }
    },
    {
      name: "ECharts",
      category: "Data Visualization",
      website: "https://echarts.apache.org",
      icon: "apacheecharts",
      rules: {
        window: [{ path: "echarts.version", versionPath: "echarts.version" }],
        scriptSrc: ["echarts(?:\\.min)?\\.js"]
      }
    },
    {
      name: "Highcharts",
      category: "Data Visualization",
      website: "https://www.highcharts.com",
      icon: null,
      rules: {
        window: [{ path: "Highcharts.version", versionPath: "Highcharts.version" }],
        scriptSrc: ["highcharts(?:\\.min)?\\.js"]
      }
    },
    {
      name: "PixiJS",
      category: "3D / Graphics",
      website: "https://pixijs.com",
      icon: null,
      rules: {
        window: [{ path: "PIXI.VERSION", versionPath: "PIXI.VERSION" }],
        scriptSrc: ["pixi(?:\\.min)?\\.js"]
      }
    },
    {
      name: "Babylon.js",
      category: "3D / Graphics",
      website: "https://www.babylonjs.com",
      icon: null,
      rules: {
        window: [{ path: "BABYLON.Engine.Version", versionPath: "BABYLON.Engine.Version" }],
        scriptSrc: ["babylon(?:\\.min)?\\.js"]
      }
    },
    {
      name: "Swiper",
      category: "UI Component",
      website: "https://swiperjs.com",
      icon: "swiper",
      rules: {
        window: ["Swiper"],
        dom: [".swiper-wrapper", ".swiper-slide"],
        scriptSrc: ["swiper(?:-bundle)?(?:\\.min)?\\.js"],
        linkHref: ["swiper(?:-bundle)?(?:\\.min)?\\.css"]
      }
    },
    {
      name: "Slick Carousel",
      category: "UI Component",
      website: "https://kenwheeler.github.io/slick/",
      icon: null,
      rules: {
        dom: [".slick-slider", ".slick-track"],
        scriptSrc: ["slick(?:\\.min)?\\.js"]
      }
    },
    {
      name: "Moment.js",
      category: "Utility Library",
      website: "https://momentjs.com",
      icon: null,
      rules: {
        window: [{ path: "moment.version", versionPath: "moment.version" }],
        scriptSrc: ["moment(?:\\.min)?\\.js"]
      }
    },
    {
      name: "Day.js",
      category: "Utility Library",
      website: "https://day.js.org",
      icon: null,
      rules: {
        window: [{ path: "dayjs.version", versionPath: "dayjs.version" }],
        scriptSrc: ["dayjs(?:\\.min)?\\.js"]
      }
    },
    {
      name: "Socket.io",
      category: "Networking",
      website: "https://socket.io",
      icon: "socketdotio",
      rules: {
        window: ["io.connect", "io.Socket"],
        scriptSrc: ["socket\\.io(?:\\.min)?\\.js"]
      }
    },
    {
      name: "Redux",
      category: "State Management",
      website: "https://redux.js.org",
      icon: "redux",
      rules: {
        window: ["__REDUX_DEVTOOLS_EXTENSION__", "__REDUX_STATE__"]
      }
    },
    {
      name: "RxJS",
      category: "JavaScript Library",
      website: "https://rxjs.dev",
      icon: "reactivex",
      rules: {
        window: ["rxjs.Observable", "Rx.Observable"],
        scriptSrc: ["rxjs(?:\\.min)?\\.js"]
      }
    },
    {
      name: "Prism.js",
      category: "Code Syntax Highlighter",
      website: "https://prismjs.com",
      icon: "prism",
      rules: {
        window: ["Prism.highlight"],
        dom: ["code[class*='language-']", "pre[class*='language-']"],
        scriptSrc: ["prism(?:\\.min)?\\.js"]
      }
    },
    {
      name: "Highlight.js",
      category: "Code Syntax Highlighter",
      website: "https://highlightjs.org",
      icon: null,
      rules: {
        window: [{ path: "hljs.versionString", versionPath: "hljs.versionString" }],
        dom: [".hljs"],
        scriptSrc: ["highlight(?:\\.min)?\\.js"]
      }
    },

    // ───────────────────────── CSS & UI ─────────────────────────
    {
      name: "Tailwind CSS",
      category: "CSS Framework",
      website: "https://tailwindcss.com",
      icon: "tailwindcss",
      rules: {
        // Compiled Tailwind leaves `--tw-*` custom properties; most sites never link a Tailwind CDN.
        cssVars: ["--tw-ring-offset-width", "--tw-border-style", "--tw-translate-x", "--tw-shadow"],
        scriptSrc: ["cdn\\.tailwindcss\\.com", "@tailwindcss/browser"],
        linkHref: ["tailwind(?:css)?[^/]*\\.css"]
      }
    },
    {
      name: "Bootstrap",
      category: "CSS Framework",
      website: "https://getbootstrap.com",
      icon: "bootstrap",
      rules: {
        window: [
          { path: "bootstrap.Tooltip.VERSION", versionPath: "bootstrap.Tooltip.VERSION" },
          { path: "jQuery.fn.tooltip.Constructor.VERSION", versionPath: "jQuery.fn.tooltip.Constructor.VERSION" }
        ],
        linkHref: [{ pattern: "/bootstrap@(\\d+(?:\\.\\d+)+)/", versionGroup: 1 }, "bootstrap(?:\\.min)?\\.css"],
        scriptSrc: ["bootstrap(?:\\.bundle)?(?:\\.min)?\\.js"]
      }
    },
    {
      name: "Bulma",
      category: "CSS Framework",
      website: "https://bulma.io",
      icon: "bulma",
      rules: {
        linkHref: [{ pattern: "/bulma@(\\d+(?:\\.\\d+)+)/", versionGroup: 1 }, "bulma(?:\\.min)?\\.css"]
      }
    },
    {
      name: "MUI",
      category: "UI Library",
      website: "https://mui.com",
      icon: "mui",
      implies: ["React"],
      rules: {
        classPattern: ["^Mui[A-Z][A-Za-z]+-root$"]
      }
    },
    {
      name: "Font Awesome",
      category: "Fonts & Icons",
      website: "https://fontawesome.com",
      icon: "fontawesome",
      rules: {
        linkHref: ["font-?awesome"],
        scriptSrc: ["kit\\.fontawesome\\.com", "font-?awesome"]
      }
    },
    {
      name: "Google Fonts",
      category: "Fonts & Icons",
      website: "https://fonts.google.com",
      icon: "googlefonts",
      rules: {
        linkHref: ["fonts\\.googleapis\\.com", "fonts\\.gstatic\\.com"]
      }
    },

    // ───────────────────────── Analytics & marketing ─────────────────────────
    {
      name: "Google Analytics",
      category: "Analytics",
      website: "https://marketingplatform.google.com/about/analytics/",
      icon: "googleanalytics",
      rules: {
        // `dataLayer` belongs to Google Tag Manager / gtag, so it is not used here.
        window: ["GoogleAnalyticsObject", "gaGlobal"],
        scriptSrc: ["googletagmanager\\.com/gtag/js\\?id=(?:G|UA)-", "google-analytics\\.com/(?:analytics|ga)\\.js"]
      }
    },
    {
      name: "Google Tag Manager",
      category: "Tag Manager",
      website: "https://tagmanager.google.com",
      icon: "googletagmanager",
      rules: {
        scriptSrc: ["googletagmanager\\.com/gtm\\.js"]
      }
    },
    {
      name: "Meta Pixel",
      category: "Analytics",
      website: "https://www.facebook.com/business/tools/meta-pixel",
      icon: "meta",
      rules: {
        window: ["fbq"],
        scriptSrc: ["connect\\.facebook\\.net/[^/]+/fbevents\\.js"]
      }
    },
    {
      name: "PostHog",
      category: "Analytics",
      website: "https://posthog.com",
      icon: "posthog",
      rules: {
        window: ["posthog.__loaded"],
        scriptSrc: ["posthog"]
      }
    },
    {
      name: "Mixpanel",
      category: "Analytics",
      website: "https://mixpanel.com",
      icon: "mixpanel",
      rules: {
        window: ["mixpanel.__loaded"],
        scriptSrc: ["cdn\\.mxpnl\\.com", "mixpanel"]
      }
    },
    {
      name: "Hotjar",
      category: "Analytics",
      website: "https://www.hotjar.com",
      icon: "hotjar",
      rules: {
        window: ["_hjSettings"],
        scriptSrc: ["static\\.hotjar\\.com"]
      }
    },
    {
      name: "Microsoft Clarity",
      category: "Analytics",
      website: "https://clarity.microsoft.com",
      icon: null,
      rules: {
        scriptSrc: ["clarity\\.ms/(?:tag|s)/"]
      }
    },
    {
      name: "Plausible",
      category: "Analytics",
      website: "https://plausible.io",
      icon: "plausibleanalytics",
      rules: {
        window: ["plausible"],
        scriptSrc: ["plausible\\.io/js/"]
      }
    },
    {
      name: "Segment",
      category: "Analytics",
      website: "https://segment.com",
      icon: "segment",
      rules: {
        window: ["analytics.SNIPPET_VERSION"],
        scriptSrc: ["cdn\\.segment\\.com/analytics\\.js"]
      }
    },
    {
      name: "HubSpot",
      category: "Marketing Automation",
      website: "https://www.hubspot.com",
      icon: "hubspot",
      rules: {
        window: ["_hsq"],
        scriptSrc: ["js\\.hs-scripts\\.com", "js\\.hsforms\\.net", "js\\.hs-analytics\\.net"]
      }
    },

    // ───────────────────────── Hosting, CDN & web servers ─────────────────────────
    {
      name: "Cloudflare",
      category: "CDN / Security",
      website: "https://www.cloudflare.com",
      icon: "cloudflare",
      rules: {
        headers: [
          { name: "server", pattern: "^cloudflare$" },
          { name: "cf-ray", pattern: ".+" },
          { name: "cf-cache-status", pattern: ".+" }
        ],
        scriptSrc: ["challenges\\.cloudflare\\.com", "static\\.cloudflareinsights\\.com", "/cdn-cgi/"],
        cookies: ["^__cf_bm$", "^cf_clearance$", "^__cflb$"]
      }
    },
    {
      name: "Vercel",
      category: "Hosting",
      website: "https://vercel.com",
      icon: "vercel",
      rules: {
        headers: [
          { name: "x-vercel-id", pattern: ".+" },
          { name: "x-vercel-cache", pattern: ".+" },
          { name: "server", pattern: "^Vercel$" }
        ],
        scriptSrc: ["/_vercel/(?:insights|speed-insights)/"]
      }
    },
    {
      name: "Netlify",
      category: "Hosting",
      website: "https://www.netlify.com",
      icon: "netlify",
      rules: {
        headers: [
          { name: "server", pattern: "^Netlify$" },
          { name: "x-nf-request-id", pattern: ".+" }
        ]
      }
    },
    {
      name: "GitHub Pages",
      category: "Hosting",
      website: "https://pages.github.com",
      icon: "github",
      rules: {
        headers: [
          { name: "server", pattern: "^GitHub\\.com$" },
          { name: "x-github-request-id", pattern: ".+" }
        ]
      }
    },
    {
      name: "Amazon Web Services",
      category: "Hosting",
      website: "https://aws.amazon.com",
      icon: "amazonwebservices",
      rules: {
        headers: [
          { name: "x-amz-cf-id", pattern: ".+" },
          { name: "x-amz-request-id", pattern: ".+" },
          { name: "server", pattern: "AmazonS3|awselb|CloudFront" }
        ],
        cookies: ["^AWSALB", "^AWSELB$"]
      }
    },
    {
      name: "Google Cloud",
      category: "Hosting",
      website: "https://cloud.google.com",
      icon: "googlecloud",
      rules: {
        headers: [{ name: "server", pattern: "^Google Frontend$" }]
      }
    },
    {
      name: "Fastly",
      category: "CDN / Security",
      website: "https://www.fastly.com",
      icon: "fastly",
      rules: {
        headers: [
          { name: "x-fastly-request-id", pattern: ".+" },
          { name: "x-served-by", pattern: "^cache-" }
        ]
      }
    },
    {
      name: "Akamai",
      category: "CDN / Security",
      website: "https://www.akamai.com",
      icon: "akamai",
      rules: {
        headers: [
          { name: "server", pattern: "AkamaiGHost|AkamaiNetStorage" },
          { name: "x-akamai-transformed", pattern: ".+" }
        ]
      }
    },
    {
      name: "Nginx",
      category: "Web Server",
      website: "https://nginx.org",
      icon: "nginx",
      rules: {
        headers: [{ name: "server", pattern: "^nginx(?:/([\\d.]+))?", versionGroup: 1 }]
      }
    },
    {
      name: "OpenResty",
      category: "Web Server",
      website: "https://openresty.org",
      icon: null,
      implies: ["Nginx"],
      rules: {
        headers: [{ name: "server", pattern: "^openresty(?:/([\\d.]+))?", versionGroup: 1 }]
      }
    },
    {
      name: "Apache HTTP Server",
      category: "Web Server",
      website: "https://httpd.apache.org",
      icon: "apache",
      rules: {
        headers: [{ name: "server", pattern: "^Apache(?!-Coyote)(?:/([\\d.]+))?", versionGroup: 1 }]
      }
    },
    {
      name: "Apache Tomcat",
      category: "Web Server",
      website: "https://tomcat.apache.org",
      icon: "apachetomcat",
      implies: ["Java"],
      rules: {
        headers: [{ name: "server", pattern: "Apache-Coyote|Tomcat" }]
      }
    },
    {
      name: "LiteSpeed",
      category: "Web Server",
      website: "https://www.litespeedtech.com",
      icon: null,
      rules: {
        headers: [{ name: "server", pattern: "LiteSpeed" }, { name: "x-litespeed-cache", pattern: ".+" }]
      }
    },
    {
      name: "Microsoft IIS",
      category: "Web Server",
      website: "https://www.iis.net",
      icon: null,
      rules: {
        headers: [{ name: "server", pattern: "^Microsoft-IIS(?:/([\\d.]+))?", versionGroup: 1 }]
      }
    },
    {
      name: "Caddy",
      category: "Web Server",
      website: "https://caddyserver.com",
      icon: "caddy",
      rules: {
        headers: [{ name: "server", pattern: "^Caddy" }]
      }
    },

    // ───────────────────────── Back-end languages & frameworks ─────────────────────────
    {
      name: "PHP",
      category: "Programming Language",
      website: "https://www.php.net",
      icon: "php",
      rules: {
        headers: [{ name: "x-powered-by", pattern: "PHP(?:/([\\d.]+))?", versionGroup: 1 }],
        cookies: ["^PHPSESSID$"]
      }
    },
    {
      name: "Laravel",
      category: "Web Framework",
      website: "https://laravel.com",
      icon: "laravel",
      implies: ["PHP"],
      rules: {
        cookies: ["^laravel_session$"]
      }
    },
    {
      name: "ASP.NET",
      category: "Web Framework",
      website: "https://dotnet.microsoft.com/apps/aspnet",
      icon: "dotnet",
      rules: {
        headers: [
          { name: "x-powered-by", pattern: "ASP\\.NET" },
          { name: "x-aspnet-version", pattern: "(.+)", versionGroup: 1 },
          { name: "x-aspnetmvc-version", pattern: ".+" }
        ],
        cookies: ["^ASP\\.NET_SessionId$", "^\\.AspNetCore\\."],
        dom: ["input[name='__VIEWSTATE']"]
      }
    },
    {
      name: "Express",
      category: "Web Framework",
      website: "https://expressjs.com",
      icon: "express",
      implies: ["Node.js"],
      rules: {
        headers: [{ name: "x-powered-by", pattern: "^Express$" }]
      }
    },
    {
      name: "Python",
      category: "Programming Language",
      website: "https://www.python.org",
      icon: "python",
      rules: {
        headers: [
          { name: "server", pattern: "Python(?:/([\\d.]+))?", versionGroup: 1 },
          { name: "x-powered-by", pattern: "Python(?:/([\\d.]+))?", versionGroup: 1 }
        ]
      }
    },
    {
      name: "Django",
      category: "Web Framework",
      website: "https://www.djangoproject.com",
      icon: "django",
      implies: ["Python"],
      rules: {
        dom: ["input[name='csrfmiddlewaretoken']"],
        cookies: ["^csrftoken$", "^django_language$", "^sessionid$"]
      }
    },
    {
      name: "Flask",
      category: "Web Framework",
      website: "https://flask.palletsprojects.com",
      icon: "flask",
      implies: ["Python"],
      rules: {
        headers: [
          { name: "server", pattern: "Werkzeug(?:/([\\d.]+))?", versionGroup: 1 }
        ],
        cookies: ["^session$"]
      }
    },
    {
      name: "FastAPI",
      category: "Web Framework",
      website: "https://fastapi.tiangolo.com",
      icon: "fastapi",
      implies: ["Python"],
      rules: {
        headers: [
          { name: "server", pattern: "uvicorn", versionGroup: 1 }
        ],
        dom: ["#swagger-ui", ".swagger-ui"]
      }
    },
    {
      name: "Gunicorn",
      category: "Web Server",
      website: "https://gunicorn.org",
      icon: "gunicorn",
      implies: ["Python"],
      rules: {
        headers: [
          { name: "server", pattern: "^gunicorn(?:/([\\d.]+))?", versionGroup: 1 }
        ]
      }
    },
    {
      name: "uWSGI",
      category: "Web Server",
      website: "https://uwsgi-docs.readthedocs.io",
      icon: null,
      implies: ["Python"],
      rules: {
        headers: [
          { name: "server", pattern: "uWSGI" }
        ]
      }
    },
    {
      name: "PyScript",
      category: "Web Framework",
      website: "https://pyscript.net",
      icon: "python",
      implies: ["Python"],
      rules: {
        dom: ["py-script", "py-env", "py-config", "script[type='py']"],
        window: ["pyscript"]
      }
    },
    {
      name: "Streamlit",
      category: "Web Framework",
      website: "https://streamlit.io",
      icon: "streamlit",
      implies: ["Python"],
      rules: {
        dom: ["#root > .stApp", "[data-testid='stAppViewContainer']"],
        window: ["streamlitDebug"]
      }
    },
    {
      name: "Gradio",
      category: "Web Framework",
      website: "https://www.gradio.app",
      icon: "gradio",
      implies: ["Python"],
      rules: {
        dom: ["gradio-app"],
        window: ["gradio_config"]
      }
    },
    {
      name: "Ruby",
      category: "Programming Language",
      website: "https://www.ruby-lang.org",
      icon: "ruby",
      rules: {}
    },
    {
      name: "Java",
      category: "Programming Language",
      website: "https://www.java.com",
      icon: "openjdk",
      rules: {
        cookies: ["^JSESSIONID$"]
      }
    },
    {
      name: "MySQL",
      category: "Database",
      website: "https://www.mysql.com",
      icon: "mysql",
      rules: {}
    },

    // ───────────────────────── Payments, support, security, monitoring ─────────────────────────
    {
      name: "Stripe",
      category: "Payments",
      website: "https://stripe.com",
      icon: "stripe",
      rules: {
        window: [{ path: "Stripe", versionPath: "Stripe.version" }],
        scriptSrc: ["js\\.stripe\\.com"]
      }
    },
    {
      name: "PayPal",
      category: "Payments",
      website: "https://www.paypal.com",
      icon: "paypal",
      rules: {
        scriptSrc: ["paypal\\.com/sdk/js", "paypalobjects\\.com"]
      }
    },
    {
      name: "Intercom",
      category: "Customer Support",
      website: "https://www.intercom.com",
      icon: "intercom",
      rules: {
        window: ["Intercom"],
        scriptSrc: ["widget\\.intercom\\.io", "js\\.intercomcdn\\.com"]
      }
    },
    {
      name: "Crisp",
      category: "Customer Support",
      website: "https://crisp.chat",
      icon: null,
      rules: {
        window: ["$crisp"],
        scriptSrc: ["client\\.crisp\\.chat"]
      }
    },
    {
      name: "Zendesk",
      category: "Customer Support",
      website: "https://www.zendesk.com",
      icon: "zendesk",
      rules: {
        window: ["zE"],
        scriptSrc: ["static\\.zdassets\\.com"]
      }
    },
    {
      name: "reCAPTCHA",
      category: "Security",
      website: "https://www.google.com/recaptcha/about/",
      icon: null,
      rules: {
        window: ["grecaptcha"],
        scriptSrc: ["google\\.com/recaptcha", "gstatic\\.com/recaptcha", "recaptcha\\.net"]
      }
    },
    {
      name: "Sentry",
      category: "Monitoring",
      website: "https://sentry.io",
      icon: "sentry",
      rules: {
        window: [{ path: "Sentry.SDK_VERSION", versionPath: "Sentry.SDK_VERSION" }, "__SENTRY__"],
        scriptSrc: ["(?:browser|js)\\.sentry-cdn\\.com"]
      }
    }
  ];

  root.STACKLENS_TECHNOLOGIES = TECHNOLOGIES;
  if (typeof module !== "undefined" && module.exports) module.exports = TECHNOLOGIES;
})(typeof globalThis !== "undefined" ? globalThis : this);
