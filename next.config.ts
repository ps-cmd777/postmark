import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native + binary-loading packages must not be bundled by Turbopack/webpack.
  // better-sqlite3 is a native binding; sqlite-vec resolves a platform-specific
  // .dylib/.so/.dll at runtime via require.resolve.
  serverExternalPackages: ["better-sqlite3", "sqlite-vec"],
};

export default nextConfig;
