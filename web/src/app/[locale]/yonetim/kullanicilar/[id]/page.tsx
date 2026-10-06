import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Currency } from '@tms/shared';
import { localePath, t, tDict, type Locale } from '@/i18n';
import { authedGet, staffGet } from '@/lib/auth-server';
import { formatPrice } from '@/lib/format';
import { AdminNav } from '@/components/AdminNav';
import { ListingRestore, ProviderToggle, UserRoles, UserSuspend } from '@/components/AdminActions';

type P = { params: Promise<{ locale: string; id: string }> };
type Detail = {
  id: string; name: string | null; roles: string[]; verifyLevel: number; createdAt: string; deleted: boolean;
  suspendedAt: string | null; suspendReason: string | null; reregistered: boolean; phone: string | null; nationalId: string | null;
  listings: { id: string; brand: string; model: string; year: number; status: string; removedReason: string | null; price: number; currency: Currency }[];
  reports: { filed: number; received: number };
  payments: { id: string; status: string; amountKurus: number; disputedAt: string | null; createdAt: string }[];
  providers: { id: string; kind: string; status: string; displayName: string; ratingSum: number; ratingCount: number }[];
  companies: { id: string; name: string; role: string }[];
  audit: { id: string; action: string; params: Record<string, string> | null; at: string }[];
};

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'admin.navUsers') }), robots: { index: false, follow: false } };
}

/** Tek kullanıcı: kimlik özeti (maskeli), ilanlar, bildirim sayıları, ödemeler, hizmet profilleri, son kayıtlar ve ekip işlemleri. */
export default async function Kullanici({ params }: P) {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  if (!/^[a-z0-9]{8,40}$/i.test(id)) notFound();
  const [u, me] = await Promise.all([
    staffGet<Detail>(locale, `/admin/users/${id}`, `/yonetim/kullanicilar/${id}`),
    authedGet<{ id: string; roles: string[] }>(locale, '/me', `/yonetim/kullanicilar/${id}`),
  ]);
  const L = tDict(locale, 'admin');
  const errors = tDict(locale, 'errors');
  const fmt = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });
  const staffTarget = u.roles.some((r) => r === 'moderator' || r === 'admin');
  const audit = (r: Detail['audit'][number]) => {
    try { return t(locale, `audit.${r.action.replace(/^audit\./, '')}`, r.params ?? {}); } catch { return r.action; }
  };
  return (
    <section className="section">
      <h1>{u.name ?? '—'}</h1>
      <AdminNav locale={locale} current="/yonetim/kullanicilar" />
      <div className="card" style={{ display: 'grid', gap: 6 }}>
        <span>{u.phone ?? '—'} · {t(locale, 'admin.level')} {u.verifyLevel}{u.nationalId ? ` · ${u.nationalId}` : ''}</span>
        <span className="muted small">{t(locale, 'admin.joined')}: {fmt.format(new Date(u.createdAt))} · {t(locale, 'admin.reportsCount', { filed: u.reports.filed, received: u.reports.received })}</span>
        {u.companies.length ? <span className="small">{u.companies.map((c) => `${c.name} (${c.role})`).join(', ')}</span> : null}
        {u.suspendedAt ? <span style={{ color: 'var(--c-danger)' }}>{t(locale, 'admin.suspended')}: {u.suspendReason}</span> : null}
        {u.reregistered ? <span style={{ color: 'var(--c-warning)' }}>{t(locale, 'admin.reregistered')}</span> : null}
        {u.deleted ? <span className="muted">{t(locale, 'admin.deletedUser')}</span> : null}
        <div className="row">
          {!staffTarget && !u.deleted ? <UserSuspend id={u.id} suspended={!!u.suspendedAt} L={L} errors={errors} /> : null}
          {me.roles.includes('admin') && me.id !== u.id && !u.deleted ? <UserRoles id={u.id} roles={u.roles} L={L} errors={errors} /> : null}
        </div>
      </div>

      <h2 style={{ fontSize: 20, marginTop: 24 }}>{t(locale, 'admin.userListings')}</h2>
      {u.listings.length === 0 ? <p className="muted small">—</p> : (
        <ul className="small" style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 6 }}>
          {u.listings.map((l) => (
            <li key={l.id} className="spread" style={{ borderTop: '1px solid var(--c-line)', paddingTop: 6 }}>
              <span>{l.status === 'published' ? <Link href={localePath(locale, `/ilan/${l.id}`)}>{l.brand} {l.model} · {l.year}</Link> : `${l.brand} ${l.model} · ${l.year}`} · {formatPrice(l.price, l.currency, locale)}</span>
              <span className="row">
                <span className="muted">{t(locale, `account.status.${l.status}`, {})}{l.removedReason ? ` · ${t(locale, `account.removedReasons.${l.removedReason}`, {})}` : ''}</span>
                {l.status === 'removed' && l.removedReason && !u.suspendedAt ? <ListingRestore id={l.id} L={L} errors={errors} /> : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      {u.providers.length ? (
        <>
          <h2 style={{ fontSize: 20, marginTop: 24 }}>{t(locale, 'admin.providers')}</h2>
          <ul className="small" style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 6 }}>
            {u.providers.map((p) => (
              <li key={p.id} className="spread" style={{ borderTop: '1px solid var(--c-line)', paddingTop: 6 }}>
                <span>{p.displayName} · {p.kind} · {t(locale, `admin.providerStatus.${p.status}`, {})}{p.ratingCount ? ` · ${(p.ratingSum / p.ratingCount).toFixed(1)} (${p.ratingCount})` : ''}</span>
                <ProviderToggle id={p.id} status={p.status} L={L} errors={errors} />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {u.payments.length ? (
        <>
          <h2 style={{ fontSize: 20, marginTop: 24 }}>{t(locale, 'admin.navPayments')}</h2>
          <ul className="small" style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 6 }}>
            {u.payments.map((p) => (
              <li key={p.id} className="spread" style={{ borderTop: '1px solid var(--c-line)', paddingTop: 6 }}>
                <span>₺{Math.round(p.amountKurus / 100).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')} · {p.status}{p.disputedAt ? ` · ${t(locale, 'admin.disputed')}` : ''}</span>
                <span className="muted">{fmt.format(new Date(p.createdAt))}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h2 style={{ fontSize: 20, marginTop: 24 }}>{t(locale, 'admin.navAudit')}</h2>
      <ul className="small" style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 6 }}>
        {u.audit.map((r) => (
          <li key={r.id} className="spread" style={{ borderTop: '1px solid var(--c-line)', paddingTop: 6 }}>
            <span>{audit(r)}</span><span className="muted">{fmt.format(new Date(r.at))}</span>
          </li>
        ))}
      </ul>
      <p className="small"><Link href={`${localePath(locale, '/yonetim/kayitlar')}?target=${u.id}`}>{t(locale, 'admin.allRecords')}</Link></p>
    </section>
  );
}
