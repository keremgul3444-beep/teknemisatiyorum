import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { t, tDict, type Locale } from '@/i18n';
import { authedGet, staffGet } from '@/lib/auth-server';
import { AdminNav } from '@/components/AdminNav';
import { ProductPrice } from '@/components/AdminActions';

type P = { params: Promise<{ locale: string }> };
type Product = { code: string; priceWebKurus: number; priceAppKurus: number; isTrialPrice: boolean };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'admin.navPrices') }), robots: { index: false, follow: false } };
}

/** Öne çıkarma ürün fiyatları (yalnızca yönetici): site ve uygulama fiyatı ayrı; girilince "deneme fiyatı" kalkar. */
export default async function Fiyatlar({ params }: P) {
  const { locale } = (await params) as { locale: Locale };
  const me = await staffGet<{ roles: string[] }>(locale, '/me', '/yonetim/fiyatlar');
  if (!me.roles.includes('admin')) notFound();
  const rows = await authedGet<Product[]>(locale, '/products', '/yonetim/fiyatlar');
  const L = tDict(locale, 'admin');
  return (
    <section className="section">
      <h1>{t(locale, 'admin.navPrices')}</h1>
      <AdminNav locale={locale} current="/yonetim/fiyatlar" />
      <div style={{ display: 'grid', gap: 12 }}>
        {rows.map((p) => (
          <div key={p.code} className="card" style={{ display: 'grid', gap: 6 }}>
            <strong>{t(locale, `promo.product.${p.code}`, {})}{p.isTrialPrice ? <span className="muted small"> · {t(locale, 'admin.trialPrice')}</span> : null}</strong>
            <ProductPrice code={p.code} web={p.priceWebKurus} app={p.priceAppKurus} L={L} errors={tDict(locale, 'errors')} />
          </div>
        ))}
      </div>
    </section>
  );
}
