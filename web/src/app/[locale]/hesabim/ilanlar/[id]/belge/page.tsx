import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { localePath, t, tDict, type Locale } from '@/i18n';
import { authedGet } from '@/lib/auth-server';
import type { ListingView } from '@/lib/types';
import { DocumentUpload } from '@/components/DocumentUpload';

type P = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'doc.title') }), robots: { index: false, follow: false } };
}

/** Ruhsat (ve motor seri no) yükleme: ekip onaylayınca ilanda "sahiplik" ve "belgeleri eşleşti" rozetleri. */
export default async function Belge({ params }: P) {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  const mine = await authedGet<ListingView[]>(locale, '/me/listings', `/hesabim/ilanlar/${id}/belge`);
  const l = mine.find((x) => x.id === id);
  if (!l || ['sold', 'removed'].includes(l.status)) notFound();
  return (
    <section className="section" style={{ maxWidth: 720 }}>
      <h1>{t(locale, 'doc.title')}</h1>
      <p className="muted">{l.brand} {l.model} · {l.year}</p>
      <p>{t(locale, 'doc.intro')}</p>
      <p className="notice small">{t(locale, 'doc.privacy')}</p>
      <DocumentUpload listingId={l.id} L={tDict(locale, 'doc')} errors={tDict(locale, 'errors')} doneHref={localePath(locale, '/hesabim/ilanlar')} />
    </section>
  );
}
