import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/generate": [
      "docs/instrucciones-crossfit.md",
    ],
  },
};

export default nextConfig;
