import Link from 'next/link';
import type { Metadata } from 'next';
import { localePath, t, type Locale } from '@/i18n';
import { authedGet } from '@/lib/auth-server';
import { LogoutButton } from '@/components/AccountBits';

type P = { params: Promise<{ locale: string }> };
type Me = { name: string | null; phone: string | null; verifyLevel: number; roles?: string[] };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'account.title') }), robots: { index: false, follow: false } };
}

export default async function Hesabim({ params }: P) {
  const { locale } = (await params) as { locale: Locale };
  const [me, unread] = await Promise.all([
    authedGet<Me>(locale, '/me', '/hesabim'),
    authedGet<{ count: number }>(locale, '/notifications/unread-count', '/hesabim').catch(() => ({ count: 0 })),
  ]);
  const p = (x: string) => localePath(locale, x);
  return (
    <section className="section" style={{ maxWidth: 720 }}>
      <h1>{t(locale, 'account.hello', { name: me.name ?? '' })}</h1>
      <p className="muted">{me.phone} · {t(locale, 'account.level', { n: me.verifyLevel })}</p>
      <div className="grid">
        <Link className="card" href={p('/hesabim/ilan-ver')}><h3>{t(locale, 'account.sell')}</h3><p className="muted small">{t(locale, 'account.sellBody')}</p></Link>
        <Link className="card" href={p('/hesabim/ilanlar')}><h3>{t(locale, 'account.listings')}</h3><p className="muted small">{t(locale, 'account.listingsBody')}</p></Link>
        <Link className="card" href={p('/hesabim/mesajlar')}><h3>{t(locale, 'account.messages')}</h3><p className="muted small">{t(locale, 'account.messagesBody')}</p></Link>
        <Link className="card" href={p('/hesabim/bildirimler')}>
          <h3>{t(locale, 'account.notifications')} {unread.count ? <span className="pill urgent">{t(locale, 'account.unreadCount', { n: unread.count })}</span> : null}</h3>
          <p className="muted small">{t(locale, 'account.notificationsBody')}</p>
        </Link>
        <Link className="card" href={p('/hesabim/favoriler')}><h3>{t(locale, 'account.favorites')}</h3><p className="muted small">{t(locale, 'account.favoritesBody')}</p></Link>
        <Link className="card" href={p('/hesabim/aramalar')}><h3>{t(locale, 'account.searches')}</h3><p className="muted small">{t(locale, 'account.searchesBody')}</p></Link>
        <Link className="card" href={p('/firma')}><h3>{t(locale, 'account.firm')}</h3><p className="muted small">{t(locale, 'account.firmBody')}</p></Link>
        {me.roles?.some((r) => r === 'admin' || r === 'moderator') ? <Link className="card" href={p('/yonetim')}><h3>{t(locale, 'account.admin')}</h3><p className="muted small">{t(locale, 'account.adminBody')}</p></Link> : null}
        <Link className="card" href={p('/hesabim/siparisler')}><h3>{t(locale, 'account.orders')}</h3><p className="muted small">{t(locale, 'account.ordersBody')}</p></Link>
        <Link className="card" href={p('/hesabim/ayarlar')}><h3>{t(locale, 'account.settings')}</h3><p className="muted small">{t(locale, 'account.settingsBody')}</p></Link>
      </div>
      <div style={{ marginTop: 24 }}><LogoutButton label={t(locale, 'account.logout')} to={p('/')} /></div>
    </section>
  );
}
