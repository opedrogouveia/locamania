import type { MetadataRoute } from 'next';

/**
 * Manifesto da PWA: o cliente "instala" o app pela tela inicial do celular
 * (Android e iPhone) sem loja — é o app mobile do MVP.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Locamania',
    short_name: 'Locamania',
    description: 'Seu aluguel de moto na palma da mão: pagamentos, contrato, manutenção e avisos.',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f7f8fa',
    theme_color: '#1d4ed8',
    lang: 'pt-BR',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
