import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { localePath, t, tDict, type Locale } from '@/i18n';
import { authedGet } from '@/lib/auth-server';
import { BulkImport } from '@/components/BulkImport';

type P = { params: Promise<{ locale: string }>; searchParams: Promise<{ c?: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'firm.import.title') }), robots: { index: false, follow: false } };
}

/** Firma toplu ilan yükleme (Excel/CSV + fotoğraf bağlantıları). */
export default async function Toplu({ params, searchParams }: P) {
  const { locale } = (await params) as { locale: Locale };
  const { c } = await searchParams;
  const mine = await authedGet<{ id: string; name: string }[]>(locale, '/companies/mine', '/firma/toplu');
  const company = mine.find((x) => x.id === c) ?? mine[0];
  if (!company) notFound();
  return (
    <section className="section" style={{ maxWidth: 820 }}>
      <h1>{t(locale, 'firm.import.title')}</h1>
      <p className="muted">{company.name}</p>
      <p>{t(locale, 'firm.import.intro')}</p>
      <BulkImport companyId={company.id} L={tDict(locale, 'firm.import')} fields={tDict(locale, 'firm.importFields')} errors={tDict(locale, 'errors')}
        listingsHref={`${localePath(locale, '/firma')}?c=${company.id}`} />
    </section>
  );
}
