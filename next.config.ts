import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config, { isServer }) {
    if (!isServer) {
      // ExcelJS y xlsx acceden a módulos de Node.js que no existen en el browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        stream: false,
        zlib: false,
        crypto: false,
        buffer: false,
      };
    }
    return config;
  },
  async rewrites() {
    return [
      {
        // Cuando el frontend llame a /python/index, irá al servidor Flask (puerto 5000)
        source: '/python/:path*',
        destination: 'http://127.0.0.1:5000/python/:path*',
      },
    ];
  },
};

export default nextConfig;