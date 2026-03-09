import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  // Trailing slash behaviour — canonical rule: never add trailing slash
  trailingSlash: false,

  // Redirect legacy Vite SPA routes (also enforced in middleware for SSR)
  async redirects() {
    return [
      { source: '/home', destination: '/', permanent: true },
      { source: '/reviews', destination: '/', permanent: true },
      { source: '/cart', destination: '/', permanent: true },
    ];
  },
};

export default nextConfig;
