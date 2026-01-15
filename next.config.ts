import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Workaround for Windows EPERM issues with .next folder
  distDir: ".next",
  // Set turbopack root to prevent lockfile conflicts from parent directory
  turbopack: {
    root: ".",
  },
  async redirects() {
    return [
      {
        // Redirect from old URL with Norwegian characters to new URL
        source: "/salgsvilkår",
        destination: "/salgsvilkaar",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        // Allow CORS for API routes (needed for mobile app)
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
        ],
      },
    ];
  },
};

export default nextConfig;
