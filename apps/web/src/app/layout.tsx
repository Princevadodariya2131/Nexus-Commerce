import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from '@/components/providers/Providers';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CustomCursor } from '@/components/motion/CustomCursor';
import { SmoothScrollProvider } from '@/components/providers/SmoothScrollProvider';

// Self-hosted (SIL OFL 1.1, see src/fonts/LICENSE-*.txt): the production build no longer needs
// network access to fonts.googleapis.com, and visitors' browsers make no third-party font requests.
const inter = localFont({
  src: '../fonts/inter-latin-wght-normal.woff2',
  variable: '--font-geist-sans',
  weight: '100 900',
  display: 'swap',
});
const syne = localFont({
  src: '../fonts/syne-latin-wght-normal.woff2',
  variable: '--font-display',
  weight: '400 800',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Nexus Commerce — Premium E-Commerce',
    template: '%s | Nexus Commerce',
  },
  description:
    'Premium e-commerce platform. Curated products, seamless checkout, and cinematic shopping experiences.',
  keywords: ['e-commerce', 'premium', 'shopping', 'enterprise'],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Nexus Commerce',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${syne.variable} font-sans`}>
        <Providers>
          <SmoothScrollProvider>
            <CustomCursor />
            <Header />
            <main>{children}</main>
            <Footer />
          </SmoothScrollProvider>
        </Providers>
      </body>
    </html>
  );
}
