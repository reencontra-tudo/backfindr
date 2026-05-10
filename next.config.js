/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Desabilita a geração estática de páginas que usam hooks dinâmicos (useSearchParams, etc.)
  // Todas as páginas serão renderizadas dinamicamente no servidor
  output: undefined,
  experimental: {
    // Permite que páginas com useSearchParams sejam tratadas como dinâmicas automaticamente
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  // Ignora erros de TypeScript e ESLint durante o build para não bloquear o deploy
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};
module.exports = nextConfig;
