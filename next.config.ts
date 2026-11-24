import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the router (wcrpacademy/wcrp-academy-host) run this as a plain `node server.js`
  // child process on Infomaniak, instead of needing the full node_modules + next CLI.
  output: 'standalone',
};

export default nextConfig;
