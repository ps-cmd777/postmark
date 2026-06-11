import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native + binary-loading packages must not be bundled by Turbopack/webpack.
  // better-sqlite3 is a native binding; sqlite-vec resolves a platform-specific
  // .dylib/.so/.dll at runtime via require.resolve.
  serverExternalPackages: ["better-sqlite3", "sqlite-vec"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
