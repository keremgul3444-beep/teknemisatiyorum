import type { Locale } from '@/i18n';
import { DraftBanner, InfoPage, infoMetadata } from '@/components/InfoPage';

export const generateMetadata = infoMetadata('preinfo');

export default async function OnBilgilendirme({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  return <InfoPage locale={locale} pageKey="preinfo" before={<DraftBanner locale={locale} />} />;
}
