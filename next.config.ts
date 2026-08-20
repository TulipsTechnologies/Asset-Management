const nextConfig = {
  basePath: "/asset-management",
  reactStrictMode: false,

  // Turbopack (Next 15.5) cannot parse a UTF-8 BOM and dies at 1:1 on the vendor stylesheet.
  //
  // dart-sass prepends a BOM to COMPRESSED output whenever the CSS contains a non-ASCII
  // character, and the vendor icon sheet's `content: "\e97f"` escapes compile to literal
  // private-use glyphs. Turbopack's CSS parser does not skip the BOM, so the very first
  // token fails and the error points at `globals.scss.css:1:1` — which is the sass
  // transform's OUTPUT name, i.e. evidence that sass RAN, not that it was skipped.
  //
  // The variable is the file's CONTENT, not its location: a relative import, an app-owned
  // wrapper and transpilePackages all fail identically. `charset: false` tells sass to emit
  // no BOM; the glyphs themselves survive untouched.
  //
  // As of Next 16 Turbopack is the default bundler for `next build` too, so both paths now
  // run the same CSS parser and this single line covers both. (Under Next 15 only `next dev`
  // broke, because `next build` still ran webpack — that asymmetry is gone.) If the BOM ever
  // resurfaces, `next build --webpack` is the escape hatch.
  sassOptions: { charset: false },
  cleanDistDir: true,
  // Source maps ship the readable source of every screen — including the shape of the API,
  // the permission names gating each control, and the comments explaining them — to anyone
  // who opens devtools on the production site. Keep them off; a stack trace from minified
  // output is still resolvable from the build artefacts kept on the server.
  productionBrowserSourceMaps: false,
  // Do not advertise the framework and version to a scanner.
  poweredByHeader: false,
  experimental: {
    // `next dev` proxies rewrites with a hard-coded 30s ceiling
    // (`proxyTimeout || 30000` in next/dist/server/lib/router-utils/proxy-request).
    // A data-exchange import of a few thousand rows runs longer than that, and when
    // the proxy gives up the BROWSER sees a 500 while the server keeps writing —
    // the operator then re-uploads and duplicates the whole file. Ten minutes is
    // above any import this app accepts (MaxRows 6000), so the client always
    // observes the real outcome instead of guessing.
    proxyTimeout: 600_000,
  },
  env: {
    NEXT_DEFAULT_ITEM_COUNT: "25",
    NEXT_PUBLIC_MAX_FILE_SIZE: "10",
  },
  images: {
    // EMPTY ON PURPOSE — this is a security control, not leftover config.
    //
    // Next serves the /_next/image optimizer endpoint whether or not the app imports
    // next/image, and it will fetch any origin allowed here on the SERVER's behalf. A
    // wildcard hostname therefore turns the app into an SSRF proxy: a request for
    // /asset-management/_next/image?url=http://169.254.169.254/... or any host on the
    // server's private network is made BY the server, from inside the perimeter, and
    // the response is handed back to the caller.
    //
    // Nothing in this app imports next/image (the one <img> in VisualImage.tsx renders an
    // object URL, which cannot go through the optimizer), so an empty list costs nothing
    // and closes the hole. Add a SPECIFIC host here if remote images are ever needed —
    // never a "**" wildcard.
    remotePatterns: [],
  },
  async headers() {
    /*
     * SECURITY HEADERS — applied in EVERY environment.
     *
     * This function used to return [] outside production, so dev had none at all and
     * production had only the cache rule below: no framing protection on screens that
     * permanently delete a register, no MIME-sniffing protection, no referrer policy, and
     * no CSP backstop behind an auth cookie that is readable from JavaScript.
     *
     * SAMEORIGIN rather than DENY, and frame-ancestors 'self' rather than 'none': this
     * module is served under the same origin as the HRM shell that links to it, so DENY
     * would break a legitimate embed while doing nothing extra against the actual threat,
     * which is framing by a DIFFERENT site.
     *
     * The CSP is REPORT-ONLY on purpose. Next injects inline bootstrap scripts and the app
     * loads blob: images (asset photos arrive as object URLs), so an enforcing policy needs
     * to be measured against real traffic first. Report-only ships the policy, surfaces
     * violations, and cannot break a working page; promote it to Content-Security-Policy
     * once the reports are clean.
     */
    const securityHeaders = [
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains",
      },
      {
        key: "Content-Security-Policy-Report-Only",
        value: [
          "default-src 'self'",
          // Next's runtime needs both for hydration and its dev overlay.
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          // blob: is how every asset photo is rendered; data: covers inlined icons.
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          // Same-origin API only — the browser never talks to the API's real host directly.
          "connect-src 'self'",
          "frame-ancestors 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join("; "),
      },
    ];

    const headers = [{ source: "/:path*", headers: securityHeaders }];

    // Immutable caching is only safe for production builds, where chunk file
    // names are content-hashed. Turbopack dev chunk names are stable across
    // rebuilds, so an immutable header makes browsers keep stale UI forever.
    if (process.env.NODE_ENV === "production") {
      headers.push({
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      });
    }

    return headers;
  },
  // Mirror server.js's API proxy for `next dev` (server.js serves IIS).
  //
  // Rewrite sources are auto-prefixed with basePath, so this catches exactly the
  // relative base the browser is configured with: /asset-management/api/*. The
  // target is SERVER-side config (ASSET_API_PROXY_TARGET) and never reaches the
  // browser — which is the point. The client always speaks one relative URL and
  // the server decides where it lands, so the same build runs on localhost,
  // WebDev and production untouched.
  async rewrites() {
    if (process.env.NODE_ENV === "production") {
      return [];
    }
    const target = (
      process.env.ASSET_API_PROXY_TARGET || "http://localhost:5199"
    ).replace(/\/+$/, "");
    return [
      {
        source: "/api/:path*",
        destination: `${target}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
