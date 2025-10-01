import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security configurations
  poweredByHeader: false, // Remove X-Powered-By header
  compress: true, // Enable gzip compression
  generateEtags: true, // Enable ETags for caching

  // Turbopack configuration
  experimental: {
    turbo: {
      root: process.cwd(), // Explicitly set workspace root
    },
  },

  // Security headers
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          // Prevent XSS attacks
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          // Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          // Referrer policy for privacy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          }
        ]
      }
    ];
  }
};
