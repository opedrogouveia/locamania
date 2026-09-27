import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // O pacote compartilhado do monorepo é consumido já compilado (dist), mas
  // transpilar garante compatibilidade com o bundler do Next.
  transpilePackages: ['@locamania/shared'],
  poweredByHeader: false,
  // O indicador de dev do Next fica em cima da barra inferior do celular.
  devIndicators: false,
  // Pasta de build configurável: permite uma pré-visualização (`next dev`) ao lado
  // de um `next start` já no ar sem os dois brigarem pela mesma `.next`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
