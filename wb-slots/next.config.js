/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@radix-ui/react-toast'],
  serverExternalPackages: ['@prisma/client', 'pino'],
  // Убираем output: 'standalone' для исправления проблем с манифестами
  // output: 'standalone',
  outputFileTracingRoot: __dirname,
  typescript: {
    // Временно игнорируем ошибки типизации из-за проблемы с validator.ts в Next.js 15
    // TODO: удалить после обновления Next.js или исправления проблемы
    ignoreBuildErrors: true,
  },
  eslint: {
    // В production строгая проверка, в development разрешаем для скорости разработки
    ignoreDuringBuilds: process.env.NODE_ENV === 'production' ? false : true,
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
    const isProduction = process.env.NODE_ENV === 'production';
    const allowedOrigins = isProduction
      ? [
          process.env.CORS_ORIGIN || 'https://yourdomain.com',
          process.env.APP_BASE_URL || 'https://yourdomain.com',
        ].filter(Boolean)
      : ['http://localhost:3000', 'http://localhost:3001', 'https://wbslot.skypath.fun'];

    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: isProduction
              ? allowedOrigins[0] || process.env.CORS_ORIGIN || '*'
              : '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-CSRF-Token',
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
          // Security headers
          ...(isProduction
            ? [
                {
                  key: 'X-Content-Type-Options',
                  value: 'nosniff',
                },
                {
                  key: 'X-Frame-Options',
                  value: 'DENY',
                },
                {
                  key: 'X-XSS-Protection',
                  value: '1; mode=block',
                },
                {
                  key: 'Referrer-Policy',
                  value: 'strict-origin-when-cross-origin',
                },
              ]
            : []),
        ],
      },
    ];
  },
};

module.exports = nextConfig;
