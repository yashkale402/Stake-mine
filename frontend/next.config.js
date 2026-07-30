/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    // INTERNAL_API_URL is set at build time (Docker ARG) and runtime (env var).
    // It must point to the backend Docker service name, never localhost.
    const backendUrl = process.env.INTERNAL_API_URL || 'http://backend:3001';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
