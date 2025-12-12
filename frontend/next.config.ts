import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',
  
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  
  // Configure image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // Keep pdfkit external so it can access its font files from node_modules
  serverExternalPackages: ['pdfkit'],

  // Configure webpack to handle pdfkit properly
  webpack: (config, { isServer }) => {
    // Mark pdfkit as external on server to prevent bundling
    if (isServer) {
      config.externals = [...(config.externals || []), 'pdfkit'];
    }
    
    // Ignore fs module warnings from pdfkit on client side  
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        stream: false,
        zlib: false,
      };
    }

    return config;
  },
};

export default nextConfig;
