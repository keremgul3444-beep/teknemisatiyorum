import type { Locale } from '@/i18n';
import { DraftBanner, InfoPage, infoMetadata } from '@/components/InfoPage';

export const generateMetadata = infoMetadata('terms');

export default async function KullanimKosullari({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  return <InfoPage locale={locale} pageKey="terms" before={<DraftBanner locale={locale} />} />;
}
