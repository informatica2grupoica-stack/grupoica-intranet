import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Tree-shaking explícito para las libs más pesadas del bundle.
    // Next.js analiza solo los exports usados y descarta el resto.
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "recharts",
      "@supabase/supabase-js",
    ],
  },

  async rewrites() {
    return [
      {
        source: '/python/:path*',
        destination: 'http://127.0.0.1:5000/python/:path*',
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',            value: 'DENY' },
          { key: 'X-Content-Type-Options',      value: 'nosniff' },
          { key: 'Referrer-Policy',             value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security',   value: 'max-age=63072000; includeSubDomains' },
          { key: 'Permissions-Policy',          value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
    ];
  },
};

export default nextConfig;
