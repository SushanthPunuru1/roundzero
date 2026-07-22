import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@roundzero/ui"],
  // The lesson pages read MDX files from packages/content at request time
  // (DECISIONS 006/007: content stays out of apps/web). Next's serverless
  // file tracer only follows statically-analyzable fs calls within the app;
  // pin the workspace root and explicitly include the sibling content
  // directory so lesson MDX ships in the Vercel function bundle.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  outputFileTracingIncludes: {
    "/app/lessons/**": ["../../packages/content/lessons/**/*.mdx"],
    "/app/forensics/**": ["../../packages/content/forensics/**/*.yaml"],
    "/app/networking/**": ["../../packages/content/networking-quiz/**/*.yaml"],
  },
};

export default nextConfig;
