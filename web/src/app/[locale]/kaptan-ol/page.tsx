import { t, type Locale } from '@/i18n';
import { InfoPage, infoMetadata } from '@/components/InfoPage';
import { AppLink } from '@/components/bits';

export const generateMetadata = infoMetadata('kaptanJoin');

export default async function KaptanOl({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  return (
    <InfoPage locale={locale} pageKey="kaptanJoin">
      <AppLink locale={locale} path="verify/professional">{t(locale, 'pages.kaptanJoin.cta')}</AppLink>
    </InfoPage>
  );
}
