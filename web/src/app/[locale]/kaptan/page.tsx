import type { Locale } from '@/i18n';
import { InfoPage, infoMetadata } from '@/components/InfoPage';
import { ServiceSoon } from '@/components/ServiceSoon';

export const generateMetadata = infoMetadata('kaptan');

export default async function Kaptan({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  return (
    <InfoPage locale={locale} pageKey="kaptan">
      <ServiceSoon locale={locale} kind="kaptan" />
    </InfoPage>
  );
}
