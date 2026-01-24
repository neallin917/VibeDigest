console.error('[Debug] NEXT_DIST_DIR:', process.env.NEXT_DIST_DIR);
console.error('[Debug] NODE_ENV:', process.env.NODE_ENV);
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import withBundleAnalyzer from '@next/bundle-analyzer';

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  // Allow custom build directory for testing to avoid lock conflicts
  distDir: process.env.NEXT_DIST_DIR || '.next',
  /* config options here */
  images: {
    minimumCacheTTL: 60 * 60 * 24, // Cache images for 24 hours
    remotePatterns: [
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "archive.biliimg.com" },
      { protocol: "https", hostname: "i0.hdslb.com" },
      { protocol: "https", hostname: "i1.hdslb.com" },
      { protocol: "https", hostname: "i2.hdslb.com" },
      { protocol: "https", hostname: "p16-sign-sg.tiktokcdn.com" },
      { protocol: "https", hostname: "p16-sign-va.tiktokcdn.com" },
      // Apple Podcasts images
      { protocol: "https", hostname: "is1-ssl.mzstatic.com" },
      { protocol: "https", hostname: "is2-ssl.mzstatic.com" },
      { protocol: "https", hostname: "is3-ssl.mzstatic.com" },
      { protocol: "https", hostname: "is4-ssl.mzstatic.com" },
      { protocol: "https", hostname: "is5-ssl.mzstatic.com" },
    ],
  },
  // Proxy /lg/* requests to LangGraph server for chat functionality
  async rewrites() {
    return [
      {
        source: "/lg/:path*",
        destination: "http://localhost:8123/:path*",
      },
    ];
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default (process.env.NEXT_DIST_DIR === '.next-test' || process.env.NODE_ENV === 'test')
  ? bundleAnalyzer(nextConfig)
  : withSentryConfig(bundleAnalyzer(nextConfig), {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    // Suppresses source map uploading logs during build
    silent: true,
    org: "personal-haoran",
    project: "vibedigest-frontend",

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,
  });
