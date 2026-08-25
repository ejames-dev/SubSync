import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
