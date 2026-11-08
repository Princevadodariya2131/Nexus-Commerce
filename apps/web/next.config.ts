import type { NextConfig } from 'next';

// Optional same-origin proxy to the API host. When API_PROXY_TARGET is set
// (e.g. https://your-api.example.com) the browser talks to /api/v1/* on the web
// origin and Next.js forwards it to the API. This keeps auth cookies first-party,
// which avoids cross-site cookie blocking when web and API live on different domains.
// Leave it unset for local development and Docker (behaviour is unchanged).
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/+$/, '');

// Fail the Vercel build early instead of shipping a site whose browser code calls
// http://localhost:4000 (the fallback in src/lib/api.ts) or a relative /api/v1 path
// that nothing forwards to the API.
if (process.env.VERCEL) {
  const publicApiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!publicApiUrl) {
    throw new Error(
      '[next.config] NEXT_PUBLIC_API_URL is not set. For Vercel use /api/v1 together with API_PROXY_TARGET, ' +
        'or an absolute https URL of the API.'
    );
  }
  if (publicApiUrl.startsWith('/') && !apiProxyTarget) {
    throw new Error(
      '[next.config] NEXT_PUBLIC_API_URL is a relative path but API_PROXY_TARGET is not set, ' +
        'so /api/v1 requests would 404 on Vercel.'
    );
  }
}

const nextConfig: NextConfig = {
  // 'standalone' is for the Docker image; Vercel builds its own output.
  output: process.env.VERCEL ? undefined : 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: '**.cloudinary.com' },
      { protocol: 'https', hostname: 'cdn.shopify.com' },
      { protocol: 'https', hostname: 'fakestoreapi.com' },
      { protocol: 'https', hostname: 'i.imgur.com' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
      { protocol: 'http', hostname: 'localhost' },
    ],
    // Fallback: allow all during development
    dangerouslyAllowSVG: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  async rewrites() {
    if (!apiProxyTarget) return [];
    return [{ source: '/api/v1/:path*', destination: `${apiProxyTarget}/api/v1/:path*` }];
  },
};

export default nextConfig;
