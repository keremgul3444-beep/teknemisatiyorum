import Link from 'next/link';
import { t } from '@/i18n';

// not-found parametre almaz; dil bilinmediği için iki dilde kısa metin + ana sayfalar.
export default function NotFound() {
  return (
    <section className="section">
      <h1>{t('tr', 'notFound.title')}</h1>
      <p className="muted">{t('tr', 'notFound.body')} · {t('en', 'notFound.body')}</p>
      <div className="row">
        <Link className="btn" href="/ilanlar">{t('tr', 'nav.listings')}</Link>
        <Link className="btn secondary" href="/en/ilanlar">{t('en', 'nav.listings')}</Link>
      </div>
    </section>
  );
}
