/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['pg-boss', 'sodium-native'],
  },
};

module.exports = nextConfig;
