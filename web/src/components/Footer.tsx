import Link from 'next/link';
import { localePath, t, type Locale } from '@/i18n';
import type { ReactNode } from 'react';

/** Alt bilgi: popüler aramalar (iç bağlantı, Google taraması için), kurumsal ve yasal bağlantılar. */
export function Footer({ locale, popular }: { locale: Locale; popular?: ReactNode }) {
  const p = (path: string) => localePath(locale, path);
  return (
    <footer className="site-footer">
      <div className="container cols">
        <div>
          <h3>{t(locale, 'footer.popular')}</h3>
          {popular ?? (
            <ul>
              <li><Link href={p('/satilik/yelkenli')}>{t(locale, 'footer.popularSail')}</Link></li>
              <li><Link href={p('/satilik/motoryat')}>{t(locale, 'footer.popularMotor')}</Link></li>
              <li><Link href={p('/satilik/gulet')}>{t(locale, 'footer.popularGulet')}</Link></li>
              <li><Link href={p('/satilik/katamaran')}>{t(locale, 'footer.popularCat')}</Link></li>
            </ul>
          )}
        </div>
        <div>
          <h3>{t(locale, 'footer.company')}</h3>
          <ul>
            <li><Link href={p('/hakkimizda')}>{t(locale, 'footer.about')}</Link></li>
            <li><Link href={p('/iletisim')}>{t(locale, 'footer.contact')}</Link></li>
            <li><Link href={p('/usta-ol')}>{t(locale, 'footer.joinUsta')}</Link></li>
            <li><Link href={p('/kaptan-ol')}>{t(locale, 'footer.joinKaptan')}</Link></li>
          </ul>
        </div>
        <div>
          <h3>{t(locale, 'footer.legal')}</h3>
          <ul>
            <li><Link href={p('/kvkk')}>{t(locale, 'footer.kvkk')}</Link></li>
            <li><Link href={p('/gizlilik')}>{t(locale, 'footer.privacy')}</Link></li>
            <li><Link href={p('/kullanim-kosullari')}>{t(locale, 'footer.terms')}</Link></li>
            <li><Link href={p('/cerezler')}>{t(locale, 'footer.cookies')}</Link></li>
            <li><Link href={p('/on-bilgilendirme')}>{t(locale, 'footer.preinfo')}</Link></li>
            <li><Link href={p('/mesafeli-satis')}>{t(locale, 'footer.distanceSale')}</Link></li>
          </ul>
        </div>
        <div id="uygulama">
          <h3>{t(locale, 'footer.app')}</h3>
          <p className="muted">{t(locale, 'footer.appSoon')}</p>
        </div>
      </div>
      <p className="container muted small">© {new Date().getFullYear()} {t(locale, 'site.name')} · {t(locale, 'footer.rights')}</p>
    </footer>
  );
}
