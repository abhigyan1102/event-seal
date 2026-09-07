import type { NextConfig } from "next";

import { createSecurityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  agentRules: false,
  headers() {
    return Promise.resolve([
      {
        source: "/:path*",
        headers: createSecurityHeaders(),
      },
    ]);
  },
  poweredByHeader: false,
  transpilePackages: ["@eventseal/sdk"],
  turbopack: {
    resolveAlias: {
      "@eventseal/sdk": "../../packages/sdk/dist/index.js",
    },
  },
  typedRoutes: true,
};

export default nextConfig;
