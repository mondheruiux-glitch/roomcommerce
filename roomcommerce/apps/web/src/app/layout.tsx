import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import { QueryProvider } from '../providers/query-provider';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: {
    default: 'RoomCommerce — AI Spatial Interior Redesign',
    template: '%s | RoomCommerce',
  },
  description:
    'Photograph your room and receive a photorealistic redesign populated with verified, in-stock furniture from IKEA, Target, Wayfair, and Amazon.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  openGraph: {
    siteName: 'RoomCommerce',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${jetBrainsMono.variable}`}
    >
      <body className="bg-bg-canvas text-ink-primary font-sans antialiased min-h-screen flex flex-col selection:bg-brand-terracotta-subtle selection:text-brand-terracotta">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
