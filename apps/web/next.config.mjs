/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  basePath: process.env.PUBLIC_BASE_PATH || '',
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs', 'puppeteer'],
  },
  output: 'standalone',
  transpilePackages: ['@painel/connectors', '@painel/jobs', '@painel/shared'],
};

export default nextConfig;
