import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { t, tDict, type Locale } from '@/i18n';
import { authedGet, staffGet } from '@/lib/auth-server';
import { apiGet } from '@/lib/api';
import { AdminNav } from '@/components/AdminNav';
import { FxRate } from '@/components/AdminActions';

type P = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'admin.navFx') }), robots: { index: false, follow: false } };
}

/** Döviz kurları (yalnızca yönetici): fiyat süzme, sıralama ve TL karşılıkları bu kurla hesaplanır. */
export default async function Kurlar({ params }: P) {
  const { locale } = (await params) as { locale: Locale };
  await staffGet(locale, '/admin/overview', '/yonetim/kurlar');
  const me = await authedGet<{ roles: string[] }>(locale, '/me', '/yonetim/kurlar');
  if (!me.roles.includes('admin')) notFound();
  const rates = await apiGet<Record<string, number>>('/fx', { revalidate: 0 });
  const L = tDict(locale, 'admin');
  return (
    <section className="section">
      <h1>{t(locale, 'admin.navFx')}</h1>
      <AdminNav locale={locale} current="/yonetim/kurlar" />
      <p className="muted small">{t(locale, 'admin.fxHint')}</p>
      <div className="card" style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
        {(['EUR', 'USD'] as const).map((c) => <FxRate key={c} currency={c} rate={rates[c] ?? 0} L={L} errors={tDict(locale, 'errors')} />)}
      </div>
    </section>
  );
}
