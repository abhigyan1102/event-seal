import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  transpilePackages: ["@eventseal/sdk"],
  turbopack: {
    resolveAlias: {
      "@eventseal/sdk": "../../packages/sdk/dist/index.js",
    },
  },
  typedRoutes: true,
};

export default nextConfig;
