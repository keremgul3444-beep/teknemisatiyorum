import type { Locale } from '@/i18n';
import { DraftBanner, InfoPage, infoMetadata } from '@/components/InfoPage';

export const generateMetadata = infoMetadata('privacy');

export default async function Gizlilik({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  return <InfoPage locale={locale} pageKey="privacy" before={<DraftBanner locale={locale} />} />;
}
