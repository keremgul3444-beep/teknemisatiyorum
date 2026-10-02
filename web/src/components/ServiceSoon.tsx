import Link from 'next/link';
import { USTA_CATEGORIES } from '@tms/shared';
import { localePath, t, type Locale } from '@/i18n';
import { AppLink } from './bits';

/** Usta/kaptan tanıtım sayfalarının ortak alt bölümü: "yakında" rozeti, kategoriler, katılım bağlantısı. */
export function ServiceSoon({ locale, kind }: { locale: Locale; kind: 'usta' | 'kaptan' }) {
  return (
    <>
      <p><span className="pill soon">{t(locale, 'pages.soon')}</span></p>
      {kind === 'usta' ? (
        <div className="row" style={{ margin: '16px 0' }}>
          {USTA_CATEGORIES.map((c) => <span key={c} className="chip">{t(locale, `ustaCat.${c}`)}</span>)}
        </div>
      ) : null}
      <div className="row" style={{ margin: '16px 0' }}>
        <AppLink locale={locale} path="">{t(locale, 'pages.notifyMe')}</AppLink>
        <Link href={localePath(locale, kind === 'usta' ? '/usta-ol' : '/kaptan-ol')}>{t(locale, kind === 'usta' ? 'pages.usta.join' : 'pages.kaptan.join')}</Link>
      </div>
    </>
  );
}
