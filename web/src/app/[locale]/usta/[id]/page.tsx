import type { Metadata } from 'next';
import type { Locale } from '@/i18n';
import { ProviderPage, providerMetadata } from '@/components/ProviderPage';

type P = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  return providerMetadata(locale, id, 'usta');
}

export default async function Profil({ params }: P) {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  return <ProviderPage locale={locale} id={id} kind="usta" />;
}
