import Link from 'next/link';
import type { ReactNode } from 'react';
import { localePath, t, type Locale } from '@/i18n';
import { jsonLd } from '@/lib/seo';
import type { ListingView } from '@/lib/types';
import { ListingCard } from './ListingCard';

/** schema.org verisi (sayfaya güvenli gömülür). */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />;
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="spread"><h2>{title}</h2>{action}</div>
      {children}
    </section>
  );
}

export function ListingGrid({ items, locale, strip, priorityFirst }: { items: ListingView[]; locale: Locale; strip?: boolean; priorityFirst?: boolean }) {
  return (
    <div className={strip ? 'strip' : 'grid'}>
      {items.map((l, i) => <ListingCard key={l.id} listing={l} locale={locale} priority={priorityFirst && i === 0} />)}
    </div>
  );
}

/** API'ye ulaşılamadığında sayfa boş ya da çökmüş görünmez; bu kutu çıkar. */
export function Unavailable({ locale }: { locale: Locale }) {
  return <p className="banner" role="status">{t(locale, 'common.unavailable')}</p>;
}

/** Asistan arama kutusu — JavaScript gerektirmez (düz form). */
export function SearchBox({ locale, defaultValue }: { locale: Locale; defaultValue?: string }) {
  return (
    <form action={localePath(locale, '/asistan')} method="get" className="row" role="search" style={{ flexWrap: 'nowrap' }}>
      <label htmlFor="q" style={{ position: 'absolute', left: -9999 }}>{t(locale, 'home.search')}</label>
      <input id="q" name="q" className="input" defaultValue={defaultValue} placeholder={t(locale, 'home.searchPlaceholder')} maxLength={500} required />
      <button className="btn" type="submit">{t(locale, 'home.search')}</button>
    </form>
  );
}

/** Uygulamaya derin bağlantı; uygulama yoksa sayfa altındaki "uygulamayı indir" bölümüne iner. */
export function AppLink({ locale, path, children, secondary }: { locale: Locale; path: string; children: ReactNode; secondary?: boolean }) {
  const scheme = process.env.NEXT_PUBLIC_APP_SCHEME ?? 'teknemisatiyorum';
  return (
    <span className="row">
      <a className={secondary ? 'btn secondary' : 'btn'} href={`${scheme}://${path.replace(/^\//, '')}`}>{children}</a>
      <Link className="small" href={`${localePath(locale, '/')}#uygulama`}>{t(locale, 'common.noApp')}</Link>
    </span>
  );
}

export function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="breadcrumb" className="small muted" style={{ margin: '16px 0' }}>
      {items.map((x, i) => (
        <span key={i}>{i > 0 ? ' / ' : ''}{x.href ? <Link href={x.href}>{x.name}</Link> : x.name}</span>
      ))}
    </nav>
  );
}
