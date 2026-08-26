import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next/Turbopack doesn't pick up a stray
  // lockfile from a parent directory.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
