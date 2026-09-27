import type { Metadata, Viewport } from 'next';
import { DM_Sans } from 'next/font/google';
import type { ReactNode } from 'react';

import './globals.css';
import { themeInitScript } from '@/lib/theme/use-theme';
import { Providers } from './providers';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Locamania', template: '%s · Locamania' },
  description: 'Locamania — locação de motos.',
  applicationName: 'Locamania',
  appleWebApp: { capable: true, title: 'Locamania', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  icons: { apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Deixa o conteúdo ir até a borda no iPhone; as áreas seguras são tratadas no CSS.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6fbfb' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1a1c' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning no <html>: o script do tema aplica a classe antes do React.
    <html lang="pt-BR" className={dmSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      {/* No <body> por causa de extensões de navegador que injetam atributos antes da hidratação. */}
      <body suppressHydrationWarning className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
