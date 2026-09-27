import { t, type Locale } from '@/i18n';
import { InfoPage, infoMetadata } from '@/components/InfoPage';

export const generateMetadata = infoMetadata('contact');

export default async function Iletisim({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  return (
    <InfoPage locale={locale} pageKey="contact">
      <p><a href={`mailto:${t(locale, 'pages.contact.email')}`}>{t(locale, 'pages.contact.email')}</a></p>
    </InfoPage>
  );
}
