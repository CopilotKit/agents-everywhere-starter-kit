import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // agent-core is a workspace package shipped as TypeScript source.
  transpilePackages: ["agent-core"],
};

export default nextConfig;
