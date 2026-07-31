const nextConfig = {
  reactStrictMode: false,
  cleanDistDir: true,
  productionBrowserSourceMaps: true,
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
};

module.exports = nextConfig;
