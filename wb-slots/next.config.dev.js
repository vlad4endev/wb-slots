/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client'],
  // Убираем output: 'standalone' для разработки
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Разрешенные домены для разработки
  allowedDevOrigins: ['wbslot.skypath.fun'],
  // Принудительно использовать порт 3000
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'wildberries.ru',
      },
      {
        protocol: 'https',
        hostname: 'supplies-api.wildberries.ru',
      },
    ],
  },
  env: {
    PORT: '3000',
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;