import type { Locale } from '@/i18n';
import { InfoPage, infoMetadata } from '@/components/InfoPage';
import { ProviderDirectory } from '@/components/ProviderDirectory';

export const generateMetadata = infoMetadata('usta');

/** Usta rehberi: tanıtım + belgesi onaylı ustalar (alan süzgeciyle). */
export default async function Usta({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ kategori?: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  const { kategori } = await searchParams;
  return (
    <InfoPage locale={locale} pageKey="usta">
      <ProviderDirectory locale={locale} kind="usta" category={kategori} />
    </InfoPage>
  );
}
