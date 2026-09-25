import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Next.js 16 blocks dev HMR/chunks from a different host than the server bind.
  // Local docs and CORS use 127.0.0.1 while `next dev` may be opened either way.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'logo.clearbit.com',
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: 'evan-dx',
  project: 'javascript-nextjs',
  silent: !process.env.CI,
});
