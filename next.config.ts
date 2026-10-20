import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Static export: this app has no server runtime. Every read goes straight to
   * Robinhood Chain from the browser, so `npm run build` emits `out/` that can
   * be served from any static host, including IPFS.
   */
  output: "export",
  images: { unoptimized: true },
  /*
   * Cache Components / partial prefetching enable PPR, which Next rejects in
   * export mode ("PPR cannot be enabled in export mode"). Static export wins:
   * it is what an IPFS host can serve.
   */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
