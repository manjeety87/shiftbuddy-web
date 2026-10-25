import type { NextConfig } from "next";

// The browser only ever talks to this site; `/api/*` is forwarded to the backend.
// That keeps the refresh cookie first-party (browsers block third-party cookies).
const API_URL = process.env.API_URL ?? "http://localhost:5000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Pages behind login render only in the browser (the session is in memory, AppShell
    // waits for it), so dev-mode validation of every page would only report them as
    // unrendered. Validate just the segments that export `instant`.
    instantInsights: { validationLevel: "manual-warning" },
  },
  turbopack: {
    // This folder is the whole project (there is another lockfile higher up the disk)
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
