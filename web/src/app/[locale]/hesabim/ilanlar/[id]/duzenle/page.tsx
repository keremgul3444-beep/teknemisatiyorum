import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { localePath, t, tDict, type Locale } from '@/i18n';
import { authedGet } from '@/lib/auth-server';
import { ApiError } from '@/lib/api';
import { fromListing } from '@/lib/listingForm';
import type { ListingView } from '@/lib/types';
import { SellWizard } from '@/components/SellWizard';

type P = { params: Promise<{ locale: string; id: string }> };

/** Satılan ya da kaldırılan ilan düzenlenemez (API de reddeder). */
const EDITABLE = ['draft', 'pending', 'published', 'rejected', 'expired'];

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'sell.editTitle') }), robots: { index: false, follow: false } };
}

/** Sitede ilan düzenleme: aynı sihirbaz, var olan alan ve fotoğraflarla. */
export default async function Duzenle({ params }: P) {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  const back = `/hesabim/ilanlar/${id}/duzenle`;
  if (!/^[a-z0-9]{8,40}$/i.test(id)) notFound();
  // Kendi ilanı ya da yönettiği firmanın personel ilanı (API yetkiyi denetler).
  const [l, me] = await Promise.all([authedGet<ListingView>(locale, `/me/listings/${id}`, back).catch(notFoundOnly), authedGet<{ verifyLevel: number }>(locale, '/me', back)]);
  if (!l || !EDITABLE.includes(l.status)) notFound();
  return (
    <section className="section" style={{ maxWidth: 820 }}>
      <h1>{t(locale, 'sell.editTitle')}</h1>
      <p className="muted">{l.brand} {l.model} · {l.year}</p>
      <p className="notice small">{t(locale, 'sell.editNote')}</p>
      <SellWizard L={tDict(locale, 'sell')} err={tDict(locale, 'sell.err')} errors={tDict(locale, 'errors')} types={tDict(locale, 'boatType')}
        equipment={tDict(locale, 'equipment')} verified={me.verifyLevel >= 2} doneHref={localePath(locale, '/hesabim/ilanlar')}
        edit={{ id: l.id, status: l.status, fields: fromListing(l, locale), photos: l.photos }} />
    </section>
  );
}

/** Yetkisiz ya da olmayan ilan 404; oturum yönlendirmesi ve diğer hatalar olduğu gibi geçer. */
function notFoundOnly(e: unknown): null {
  if (e instanceof ApiError && (e.status === 404 || e.status === 403)) return null;
  throw e;
}
