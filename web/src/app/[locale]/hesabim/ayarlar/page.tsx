import Link from 'next/link';
import type { Metadata } from 'next';
import { localePath, t, tDict, type Locale } from '@/i18n';
import { authedGet } from '@/lib/auth-server';
import { DeleteAccount, SettingsForm } from '@/components/Settings';

type P = { params: Promise<{ locale: string }> };
type Me = { name: string | null; verifyLevel: number; prefs: { notifyMessages: boolean; notifyMatches: boolean; notifyMarketing: boolean; phoneVisible: boolean; marketingConsent: boolean } };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'settings.title') }), robots: { index: false, follow: false } };
}

/** Hesap ayarları: ad, bildirim ve gizlilik tercihleri, KVKK veri kopyası, hesabı silme. */
export default async function Ayarlar({ params }: P) {
  const { locale } = (await params) as { locale: Locale };
  const me = await authedGet<Me>(locale, '/me', '/hesabim/ayarlar');
  const L = tDict(locale, 'settings');
  return (
    <section className="section" style={{ maxWidth: 640 }}>
      <p className="small"><Link href={localePath(locale, '/hesabim')}>{t(locale, 'account.title')}</Link></p>
      <h1>{t(locale, 'settings.title')}</h1>
      <SettingsForm name={me.name ?? ''} canEditName={me.verifyLevel < 2} prefs={me.prefs} L={L} errors={tDict(locale, 'errors')} />
      <h2 style={{ fontSize: 20, marginTop: 32 }}>{t(locale, 'settings.dataTitle')}</h2>
      <p className="muted small">{t(locale, 'settings.dataBody')}</p>
      <p><a className="btn ghost" href="/api/me/export" download>{t(locale, 'settings.export')}</a></p>
      <p className="small"><Link href={localePath(locale, '/kvkk')}>{t(locale, 'settings.kvkk')}</Link></p>
      <div style={{ marginTop: 32 }}><DeleteAccount L={L} errors={tDict(locale, 'errors')} to={localePath(locale, '/')} /></div>
    </section>
  );
}
