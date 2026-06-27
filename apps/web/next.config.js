/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@ahh-wfm/types", "@ahh-wfm/mock-data", "@ahh-wfm/ui"],
  outputFileTracing: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
