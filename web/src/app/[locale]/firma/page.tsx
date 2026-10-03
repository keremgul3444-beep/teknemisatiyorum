import Link from 'next/link';
import type { Metadata } from 'next';
import type { Currency } from '@tms/shared';
import { localePath, t, tDict, type Locale } from '@/i18n';
import { authedGet } from '@/lib/auth-server';
import { formatPrice } from '@/lib/format';
import { AddMember, CreateCompany, RemoveMember } from '@/components/CompanyBits';

type P = { params: Promise<{ locale: string }>; searchParams: Promise<{ c?: string }> };
type Mine = { id: string; name: string }[];
type Detail = {
  id: string; name: string; kind: string; city: string; myRole: string;
  members: { userId: string; role: string; name: string | null; phone: string | null; me: boolean }[];
  listings: { id: string; title: string; year: number; price: number; currency: Currency; status: string; ownerName: string | null; cover: string | null; expiresAt: string | null; stats?: { views: number; favorites: number; messages: number } }[];
};

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'firm.title') }), robots: { index: false, follow: false } };
}

/** Firma paneli: firma yoksa açma formu; varsa personel ve firmanın ilanları (istatistik yalnızca sahip ve yöneticiye). */
export default async function Firma({ params, searchParams }: P) {
  const { locale } = (await params) as { locale: Locale };
  const { c } = await searchParams;
  const mine = await authedGet<Mine>(locale, '/companies/mine', '/firma');
  const L = tDict(locale, 'firm');
  const errors = tDict(locale, 'errors');
  if (!mine.length) {
    return (
      <section className="section">
        <h1>{t(locale, 'firm.title')}</h1>
        <p className="muted">{t(locale, 'firm.intro')}</p>
        <CreateCompany L={L} kinds={tDict(locale, 'firm.kinds')} errors={errors} />
      </section>
    );
  }
  const current = mine.find((x) => x.id === c) ?? mine[0];
  const d = await authedGet<Detail>(locale, `/companies/${current.id}`, '/firma');
  const manager = d.myRole === 'owner' || d.myRole === 'admin';
  return (
    <section className="section">
      <h1>{d.name}</h1>
      <p className="muted">{t(locale, `firm.kinds.${d.kind}`)} · {d.city} · {t(locale, `firm.role_${d.myRole}`)}</p>
      {mine.length > 1 ? (
        <nav className="row small" style={{ marginBottom: 16 }}>
          {mine.map((x) => <Link key={x.id} className="chip" aria-current={x.id === d.id ? 'page' : undefined} href={`${localePath(locale, '/firma')}?c=${x.id}`}>{x.name}</Link>)}
        </nav>
      ) : null}
      <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
        <div className="card" style={{ display: 'grid', gap: 12 }}>
          <h2>{t(locale, 'firm.staff')}</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
            {d.members.map((m) => (
              <li key={m.userId} className="spread small">
                <span>{m.name ?? '—'} <span className="muted">· {m.phone} · {t(locale, `firm.role_${m.role}`)}</span></span>
                {manager && m.role !== 'owner' && !m.me ? <RemoveMember companyId={d.id} userId={m.userId} L={L} errors={errors} /> : null}
              </li>
            ))}
          </ul>
          {manager ? <AddMember companyId={d.id} L={L} errors={errors} /> : null}
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="spread"><h2 style={{ margin: 0 }}>{t(locale, 'firm.listings')}</h2><Link className="btn" href={localePath(locale, '/hesabim/ilan-ver')}>{t(locale, 'sell.title')}</Link></div>
          {d.listings.length === 0 ? <p className="muted">{t(locale, 'firm.noListings')}</p> : d.listings.map((l) => (
            <div key={l.id} className="card spread" style={{ gap: 12 }}>
              <div>
                <strong>{l.status === 'published' ? <Link href={localePath(locale, `/ilan/${l.id}`)}>{l.title} · {l.year}</Link> : `${l.title} · ${l.year}`}</strong>
                <div className="muted small">{formatPrice(l.price, l.currency, locale)} · {t(locale, `admin.status.${l.status}`)} · {l.ownerName ?? '—'}</div>
                {l.stats ? <div className="muted small">{t(locale, 'account.stats', { v: l.stats.views, f: l.stats.favorites, m: l.stats.messages })}</div> : null}
              </div>
            </div>
          ))}
          <p className="muted small">{t(locale, 'firm.listingHint')}</p>
        </div>
      </div>
    </section>
  );
}
