const nextConfig = {
  basePath: "/asset-management",
  reactStrictMode: false,
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
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
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
