import { type Locale } from '@/i18n';
import { InfoPage, infoMetadata } from '@/components/InfoPage';

export const generateMetadata = infoMetadata('about');

export default async function Hakkimizda({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  return (
    <InfoPage locale={locale} pageKey="about" />
  );
}
