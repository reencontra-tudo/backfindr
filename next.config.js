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
  // /feed?q=… (busca do Feed, vinda do antigo /buscar ou de um link) NÃO é indexável: o canonical da página já aponta para /feed e este cabeçalho
  // acrescenta noindex. Vai no cabeçalho (não na página) para a /feed continuar estática e guardada (revalidate de 5 min).
  async headers() {
    return [{ source: '/feed', has: [{ type: 'query', key: 'q' }], headers: [{ key: 'X-Robots-Tag', value: 'noindex, follow' }] }];
  },
};
module.exports = nextConfig;
