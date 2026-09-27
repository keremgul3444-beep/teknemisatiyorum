import type { Metadata } from 'next';
import type { Locale } from '@/i18n';
import { LandingPage, landingMetadata } from '@/components/Landing';

export const revalidate = 300;
type P = { params: Promise<{ locale: string; tip: string; sehir: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale, tip, sehir } = await params;
  return landingMetadata(locale as Locale, tip, sehir);
}

export default async function SatilikTipSehir({ params }: P) {
  const { locale, tip, sehir } = await params;
  return <LandingPage locale={locale as Locale} tip={tip} sehir={sehir} />;
}
