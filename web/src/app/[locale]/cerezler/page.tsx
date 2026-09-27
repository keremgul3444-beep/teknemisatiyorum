import type { Locale } from '@/i18n';
import { DraftBanner, InfoPage, infoMetadata } from '@/components/InfoPage';

export const generateMetadata = infoMetadata('cookies');

export default async function Cerezler({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  return <InfoPage locale={locale} pageKey="cookies" before={<DraftBanner locale={locale} />} />;
}
