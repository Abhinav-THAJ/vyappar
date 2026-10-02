import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Invoice attachments and logo uploads go through server actions.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
