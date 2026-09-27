import { t, type Locale } from '@/i18n';
import { InfoPage, infoMetadata } from '@/components/InfoPage';
import { AppLink } from '@/components/bits';

export const generateMetadata = infoMetadata('broker');

export default async function Broker({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  return (
    <InfoPage locale={locale} pageKey="broker">
      <AppLink locale={locale} path="broker">{t(locale, 'pages.broker.cta')}</AppLink>
    </InfoPage>
  );
}
