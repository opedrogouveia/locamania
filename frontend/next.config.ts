import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // O pacote compartilhado do monorepo é consumido já compilado (dist), mas
  // transpilar garante compatibilidade com o bundler do Next.
  transpilePackages: ['@locamania/shared'],
  poweredByHeader: false,
  // O indicador de dev do Next fica em cima da barra inferior do celular.
  devIndicators: false,
};

export default nextConfig;
