import Link from 'next/link';
import { localePath, t, type Locale } from '@/i18n';
import { LangSwitch } from './LangSwitch';

/** Üst menü. Giriş bağlantısı her zaman görünür; oturum kontrolü girişli sayfaların kendisinde (önbellek bozulmasın). */
export function Header({ locale }: { locale: Locale }) {
  const p = (path: string) => localePath(locale, path);
  return (
    <header className="site-header">
      <nav className="container" aria-label={t(locale, 'nav.menu')}>
        <Link className="logo" href={p('/')}>{t(locale, 'site.name')}</Link>
        <Link className="hide-xs" href={p('/ilanlar')}>{t(locale, 'nav.listings')}</Link>
        <Link className="hide-mobile" href={p('/ekspertiz')}>{t(locale, 'nav.expertise')}</Link>
        <Link className="hide-mobile" href={p('/broker')}>{t(locale, 'nav.broker')}</Link>
        <Link className="hide-mobile" href={p('/usta')}>{t(locale, 'nav.usta')}</Link>
        <Link className="hide-mobile" href={p('/kaptan')}>{t(locale, 'nav.kaptan')}</Link>
        <LangSwitch locale={locale} label={t(locale, 'nav.lang')} />
        <Link className="btn hide-mobile" href={p('/hesabim/ilan-ver')}>{t(locale, 'nav.sell')}</Link>
        <Link className="btn ghost" href={p('/hesabim')}>{t(locale, 'nav.account')}</Link>
      </nav>
    </header>
  );
}
