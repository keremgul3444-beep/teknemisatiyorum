import { t, type Locale } from '@/i18n';
import { InfoPage, infoMetadata } from '@/components/InfoPage';
import { AppLink } from '@/components/bits';

export const generateMetadata = infoMetadata('ustaJoin');

export default async function UstaOl({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  return (
    <InfoPage locale={locale} pageKey="ustaJoin">
      <AppLink locale={locale} path="verify/professional">{t(locale, 'pages.ustaJoin.cta')}</AppLink>
    </InfoPage>
  );
}
