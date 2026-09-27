import { t, type Locale } from '@/i18n';
import { InfoPage, infoMetadata } from '@/components/InfoPage';
import { AppLink } from '@/components/bits';

export const generateMetadata = infoMetadata('logbook');

export default async function TekneKarnesi({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  return (
    <InfoPage locale={locale} pageKey="logbook">
      <AppLink locale={locale} path="teknelerim">{t(locale, 'pages.logbook.cta')}</AppLink>
    </InfoPage>
  );
}
