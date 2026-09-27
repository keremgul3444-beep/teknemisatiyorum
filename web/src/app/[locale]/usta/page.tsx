import type { Locale } from '@/i18n';
import { InfoPage, infoMetadata } from '@/components/InfoPage';
import { ServiceSoon } from '@/components/ServiceSoon';

export const generateMetadata = infoMetadata('usta');

export default async function Usta({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  return (
    <InfoPage locale={locale} pageKey="usta">
      <ServiceSoon locale={locale} kind="usta" />
    </InfoPage>
  );
}
