import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { t, tSections, type Locale } from '@/i18n';
import { pageMetadata } from '@/lib/seo';
import { STATIC_PAGES, type StaticPageKey } from '@/lib/pages';

type P = { params: Promise<{ locale: string }> };

/** Sabit sayfa metaverisi (başlık/açıklama çeviri dosyasındaki `pages.<key>`'den). */
export function infoMetadata(key: StaticPageKey) {
  return async ({ params }: P): Promise<Metadata> => {
    const { locale } = (await params) as { locale: Locale };
    const page = STATIC_PAGES.find((p) => p.key === key)!;
    return pageMetadata({ title: t(locale, 'seo.pageTitle', { title: t(locale, `pages.${key}.title`) }), description: t(locale, `pages.${key}.description`), path: page.path, locale });
  };
}

/** Başlık + giriş + bölümler (`pages.<key>.sections` = [{h,b}]) ve isteğe bağlı ek içerik. */
export function InfoPage({ locale, pageKey, before, children }: { locale: Locale; pageKey: StaticPageKey; before?: ReactNode; children?: ReactNode }) {
  return (
    <article className="section" style={{ maxWidth: 820 }}>
      {before}
      <h1>{t(locale, `pages.${pageKey}.title`)}</h1>
      <p className="muted" style={{ fontSize: 18 }}>{t(locale, `pages.${pageKey}.description`)}</p>
      {tSections(locale, `pages.${pageKey}.sections`).map((s) => (
        <section key={s.h} style={{ margin: '20px 0' }}>
          <h2>{s.h}</h2>
          <p>{s.b}</p>
        </section>
      ))}
      {children}
    </article>
  );
}

/** Avukat onayına kadar yasal metinlerin üstünde. */
export function DraftBanner({ locale }: { locale: Locale }) {
  return <p className="banner" role="note">{t(locale, 'common.draft')}</p>;
}
