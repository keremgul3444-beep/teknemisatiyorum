import type { Locale } from '@/i18n';
import { DraftBanner, InfoPage, infoMetadata } from '@/components/InfoPage';

export const generateMetadata = infoMetadata('distanceSale');

export default async function MesafeliSatis({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  return <InfoPage locale={locale} pageKey="distanceSale" before={<DraftBanner locale={locale} />} />;
}
