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
  // Note `next build` (webpack) stays GREEN through this — only `next dev` breaks — so a
  // passing production build does not prove the dev server starts.
  sassOptions: { charset: false },
  cleanDistDir: true,
  productionBrowserSourceMaps: true,
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
    // Immutable caching is only safe for production builds, where chunk file
    // names are content-hashed. Turbopack dev chunk names are stable across
    // rebuilds, so an immutable header makes browsers keep stale UI forever.
    if (process.env.NODE_ENV !== "production") {
      return [];
    }
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
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
