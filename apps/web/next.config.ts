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
    // Lesson MDX is needed by every route that builds a track, not just the
    // lesson pages: DECISIONS 038 moved the per-step `why` line into lesson
    // frontmatter, and loadTrack() reads it. loadTrack is called from /app,
    // /app/drill, /app/lab, /app/lessons/[slug], /app/forensics/[archetype]
    // and /app/networking/[category] — so the include has to cover the whole
    // /app subtree or those functions ENOENT in production only.
    "/app": ["../../packages/content/lessons/**/*.mdx"],
    "/app/**": ["../../packages/content/lessons/**/*.mdx"],
    "/app/forensics/**": ["../../packages/content/forensics/**/*.yaml"],
    "/app/networking/**": ["../../packages/content/networking-quiz/**/*.yaml"],
    "/app/placement/**": ["../../packages/content/placement/**/*.yaml"],
  },
};

export default nextConfig;
