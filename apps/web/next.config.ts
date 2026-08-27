import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  transpilePackages: ["@eventseal/sdk"],
  typedRoutes: true,
};

export default nextConfig;
