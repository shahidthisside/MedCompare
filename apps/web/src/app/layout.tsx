import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Providers } from '@/components/Providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'MedCompare: medicine prices across Indian pharmacies', template: '%s · MedCompare' },
  description: 'Live medicine prices from Tata 1mg, Apollo, PlatinumRx, Medkart, MrMed, Healthmug and MedPlus for your PIN code. Price per tablet, same-salt alternatives, cheapest basket.',
  applicationName: 'MedCompare',
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
};

// Light by default; dark only if the user chose it (applied before first paint).
const themeScript = `try{if(localStorage.getItem('medcompare:theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <Providers>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 rounded-lg bg-ink px-3 py-2 text-bg">Skip to content</a>
          <Header />
          <main id="main" className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
