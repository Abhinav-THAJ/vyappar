import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Invoice attachments and logo uploads go through server actions.
    serverActions: { bodySizeLimit: "8mb" },
  },
  outputFileTracingExcludes: {
    "*": [
      "node_modules/embedded-postgres/**/*",
      "node_modules/@embedded-postgres/**/*"
    ]
  }
};

export default nextConfig;
