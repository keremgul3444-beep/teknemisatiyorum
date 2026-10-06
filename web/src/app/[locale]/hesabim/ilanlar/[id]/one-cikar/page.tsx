import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { localePath, t, tDict, type Locale } from '@/i18n';
import { apiGet } from '@/lib/api';
import { authedGet } from '@/lib/auth-server';
import { ApiError } from '@/lib/api';
import type { ListingView } from '@/lib/types';
import { AcceptGate, BuyButton } from '@/components/AccountBits';
import { formatKurus } from '@/lib/format';

type P = { params: Promise<{ locale: string; id: string }> };
type Product = { code: string; kind: 'vitrin' | 'acil' | 'bump'; days: number | null; priceWebKurus: number; isTrialPrice: boolean };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'promo.title') }), robots: { index: false, follow: false } };
}

const tl = formatKurus;

/** Öne çıkar: ürün seçimi (site fiyatı). Yalnızca kendi yayındaki ilanı için. */
export default async function OneCikar({ params }: P) {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  // Kendi ilanı ya da yönettiği firmanın personel ilanı (API yetkiyi denetler).
  if (!/^[a-z0-9]{8,40}$/i.test(id)) notFound();
  const l = await authedGet<ListingView>(locale, `/me/listings/${id}`, `/hesabim/ilanlar/${id}/one-cikar`).catch(notFoundOnly);
  if (!l || l.status !== 'published') notFound();
  const products = await apiGet<Product[]>('/products', { revalidate: 60 }).catch(() => null);
  const errors = tDict(locale, 'errors');
  return (
    <section className="section">
      <h1>{t(locale, 'promo.title')}</h1>
      <p className="muted">{l.brand} {l.model} · {l.year}</p>
      <p>{t(locale, 'promo.intro')}</p>
      {/* Ürünler alınamazsa boş ızgara yerine açık bir uyarı gösterilir. */}
      {!products?.length ? <p className="banner" role="status">{t(locale, 'promo.unavailable')}</p> : null}
      <AcceptGate label={t(locale, 'promo.accept')} links={[
        { href: localePath(locale, '/on-bilgilendirme'), text: t(locale, 'promo.preinfoLink') },
        { href: localePath(locale, '/mesafeli-satis'), text: t(locale, 'promo.distanceLink') },
      ]}>
      <div className="grid">
        {(products ?? []).map((p) => (
          <div key={p.code} className="card" style={{ display: 'grid', gap: 8 }}>
            <h3>{t(locale, `promo.product.${p.code}`, {})}</h3>
            <p className="muted small">{t(locale, `promo.kindHint.${p.kind}`)}</p>
            <strong style={{ fontSize: 24 }}>{tl(p.priceWebKurus, locale)}</strong>
            {p.isTrialPrice ? <span className="small" style={{ color: 'var(--c-warning)' }}>{t(locale, 'promo.trialPrice')}</span> : null}
            <BuyButton listingId={l.id} productCode={p.code} label={t(locale, 'promo.buy')} errors={errors} locale={locale} />
          </div>
        ))}
      </div>
      </AcceptGate>
    </section>
  );
}

/** Yetkisiz ya da olmayan ilan 404; oturum yönlendirmesi ve diğer hatalar olduğu gibi geçer. */
function notFoundOnly(e: unknown): null {
  if (e instanceof ApiError && (e.status === 404 || e.status === 403)) return null;
  throw e;
}
