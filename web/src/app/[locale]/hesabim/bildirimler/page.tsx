import Link from 'next/link';
import type { Metadata } from 'next';
import { localePath, t, type Locale } from '@/i18n';
import { authedGet } from '@/lib/auth-server';
import { webNotifTarget } from '@/lib/notifications';
import { MarkAllRead } from '@/components/AccountLists';

type P = { params: Promise<{ locale: string }> };
type N = { id: string; key: string; params: Record<string, string> | null; readAt: string | null; createdAt: string };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'account.notifications') }), robots: { index: false, follow: false } };
}

/** Bildirimler (uygulamadakiyle aynı kayıtlar). Usta/kaptan işleri yalnızca uygulamada açılır. */
export default async function Bildirimler({ params }: P) {
  const { locale } = (await params) as { locale: Locale };
  const rows = await authedGet<N[]>(locale, '/notifications', '/hesabim/bildirimler');
  const fmt = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const text = (n: N) => {
    const key = n.key.replace(/^notif\./, '');
    try { return t(locale, `notif.${key}`, n.params ?? {}); } catch { return n.key; }
  };
  return (
    <section className="section" style={{ maxWidth: 720 }}>
      <h1>{t(locale, 'account.notifications')}</h1>
      <MarkAllRead when={rows.some((n) => !n.readAt)} />
      {rows.length === 0 ? <p className="muted">{t(locale, 'account.noNotifications')}</p> : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
          {rows.map((n) => {
            const target = webNotifTarget(n.key, n.params);
            const body = (
              <>
                <span style={{ fontWeight: n.readAt ? 400 : 700 }}>{text(n)}</span>
                <span className="muted small">{fmt.format(new Date(n.createdAt))}{target ? '' : ` · ${t(locale, 'account.inApp')}`}</span>
              </>
            );
            return (
              <li key={n.id} className="card" style={{ display: 'grid', gap: 4, borderColor: n.readAt ? undefined : 'var(--c-primary)' }}>
                {target ? <Link href={localePath(locale, target)} style={{ display: 'grid', gap: 4, color: 'inherit' }}>{body}</Link> : body}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
