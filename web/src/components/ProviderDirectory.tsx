import Link from 'next/link';
import { USTA_CATEGORIES } from '@tms/shared';
import { localePath, t, type Locale } from '@/i18n';
import { apiGet } from '@/lib/api';
import { ProviderCard, type ProviderView } from './ProviderBits';
import { AppLink } from './bits';

/**
 * Usta/kaptan rehberi: belgesi onaylı hizmet verenler (puana göre). Liste boşsa katılım çağrısı.
 * İş talebi ve rezervasyon uygulamadan; siteden profil sayfasında mesaj gönderilebilir.
 */
export async function ProviderDirectory({ locale, kind, category }: { locale: Locale; kind: 'usta' | 'kaptan'; category?: string }) {
  const cat = kind === 'usta' && (USTA_CATEGORIES as readonly string[]).includes(category ?? '') ? category : undefined;
  const rows = await apiGet<ProviderView[]>(`/providers?kind=${kind}${cat ? `&category=${cat}` : ''}`, { revalidate: 300 }).catch(() => [] as ProviderView[]);
  const base = localePath(locale, `/${kind}`);
  return (
    <>
      {kind === 'usta' ? (
        <nav className="row" aria-label={t(locale, 'providers.categories')} style={{ margin: '16px 0' }}>
          <Link className="chip" href={base} aria-current={!cat ? 'page' : undefined}>{t(locale, 'providers.all')}</Link>
          {USTA_CATEGORIES.map((c) => <Link key={c} className="chip" href={`${base}?kategori=${c}`} aria-current={cat === c ? 'page' : undefined}>{t(locale, `ustaCat.${c}`)}</Link>)}
        </nav>
      ) : null}
      {rows.length ? (
        <div className="grid" style={{ margin: '16px 0' }}>{rows.map((p) => <ProviderCard key={p.id} p={p} locale={locale} />)}</div>
      ) : <p className="muted">{t(locale, kind === 'usta' ? 'providers.emptyUsta' : 'providers.emptyKaptan')}</p>}
      <div className="row" style={{ margin: '16px 0' }}>
        <AppLink locale={locale} path={kind === 'usta' ? 'is/yeni' : 'kaptan'}>{t(locale, kind === 'usta' ? 'providers.requestInApp' : 'providers.bookInApp')}</AppLink>
        <Link href={localePath(locale, kind === 'usta' ? '/usta-ol' : '/kaptan-ol')}>{t(locale, kind === 'usta' ? 'pages.usta.join' : 'pages.kaptan.join')}</Link>
      </div>
    </>
  );
}
