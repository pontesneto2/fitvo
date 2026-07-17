/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ui-web e brand-tokens sao publicados como TS cru (main: ./src/index.ts, sem
  // build). O Next precisa transpila-los junto do app.
  transpilePackages: ['@fitvo/ui-web', '@fitvo/brand-tokens'],
};

export default nextConfig;
