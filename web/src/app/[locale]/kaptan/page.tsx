import type { Locale } from '@/i18n';
import { InfoPage, infoMetadata } from '@/components/InfoPage';
import { ProviderDirectory } from '@/components/ProviderDirectory';

export const generateMetadata = infoMetadata('kaptan');

/** Kaptan rehberi: tanıtım + belgesi onaylı kaptanlar (günlük/haftalık ücret). */
export default async function Kaptan({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  return (
    <InfoPage locale={locale} pageKey="kaptan">
      <ProviderDirectory locale={locale} kind="kaptan" />
    </InfoPage>
  );
}
