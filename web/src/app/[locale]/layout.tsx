import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { Inter, Space_Grotesk } from 'next/font/google';
import { cssVariables } from '@tms/shared';
import { isLocale, LOCALES, type Locale } from '@/i18n';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import '../globals.css';

const body = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-body', display: 'swap' });
const heading = Space_Grotesk({ subsets: ['latin', 'latin-ext'], variable: '--font-heading', display: 'swap' });

export const generateStaticParams = () => LOCALES.map((locale) => ({ locale }));

export default async function RootLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale} className={`${body.variable} ${heading.variable}`}>
      <head>
        {/* Tasarım dili (renk/yarıçap) uygulamayla aynı kaynaktan. */}
        <style>{cssVariables()}</style>
      </head>
      <body>
        <Header locale={locale as Locale} />
        <main className="container">{children}</main>
        <Footer locale={locale as Locale} />
      </body>
    </html>
  );
}
