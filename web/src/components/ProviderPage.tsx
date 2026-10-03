import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { localePath, t, tDict, type Locale } from '@/i18n';
import { ApiError, apiGet } from '@/lib/api';
import { ContactBox } from './ContactBox';
import { AppLink } from './bits';
import type { ProviderView } from './ProviderBits';

const ID = /^[a-z0-9]{8,40}$/;

async function load(id: string, kind: 'usta' | 'kaptan') {
  if (!ID.test(id)) notFound();
  const p = await apiGet<ProviderView>(`/providers/${id}`, { revalidate: 300 }).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  if (p.kind !== kind) notFound();
  return p;
}

export async function providerMetadata(locale: Locale, id: string, kind: 'usta' | 'kaptan'): Promise<Metadata> {
  const p = await load(id, kind);
  return { title: t(locale, 'seo.pageTitle', { title: `${p.name} · ${t(locale, `pages.${kind}.title`)}` }), description: p.bio.slice(0, 160) || undefined };
}

/** Hizmet veren profili: bilgiler, değerlendirmeler, mesaj kutusu; iş talebi ve rezervasyon uygulamada. */
export async function ProviderPage({ locale, id, kind }: { locale: Locale; id: string; kind: 'usta' | 'kaptan' }) {
  const p = await load(id, kind);
  const fmt = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'medium' });
  const self = localePath(locale, `/${kind}/${id}`);
  return (
    <article className="section" style={{ maxWidth: 820, display: 'grid', gap: 16 }}>
      <div>
        <h1 style={{ marginBottom: 4 }}>{p.name}</h1>
        <p className="muted">{p.region}{p.yearsExp ? ` · ${t(locale, 'providers.years', { n: p.yearsExp })}` : ''} · {t(locale, 'providers.verified')}
          {p.rating ? ` · ★ ${p.rating} (${p.reviewCount})` : ''}</p>
      </div>
      {kind === 'usta'
        ? <div className="row">{p.categories.map((c) => <span key={c} className="chip">{t(locale, `ustaCat.${c}`)}</span>)}</div>
        : <p><strong>{p.dayRateEur ? t(locale, 'providers.dayRate', { n: p.dayRateEur }) : ''}</strong>{p.weekRateEur ? ` · ${t(locale, 'providers.weekRate', { n: p.weekRateEur })}` : ''}</p>}
      {p.bio ? <p style={{ whiteSpace: 'pre-line' }}>{p.bio}</p> : null}
      {p.priceNote ? <p className="muted small">{p.priceNote}</p> : null}
      {p.languages.length ? <p className="small">{t(locale, 'providers.languages')}: {p.languages.join(', ')}</p> : null}
      {p.areas.length ? <p className="small">{t(locale, 'providers.areas')}: {p.areas.join(', ')}</p> : null}
      <div className="row"><AppLink locale={locale} path={kind === 'usta' ? `usta/${p.id}` : `kaptan/${p.id}`}>{t(locale, kind === 'usta' ? 'providers.requestInApp' : 'providers.bookInApp')}</AppLink></div>
      <ContactBox providerId={p.id} errors={tDict(locale, 'errors')} loginHref={`${localePath(locale, '/giris')}?next=${encodeURIComponent(self)}`}
        threadHref={localePath(locale, '/hesabim/mesajlar')} suggestion={t(locale, 'providers.suggestion', { name: p.name })} labels={{
          title: t(locale, 'providers.contactTitle'), placeholder: t(locale, 'contact.placeholder'), send: t(locale, 'contact.send'),
          sent: t(locale, 'providers.sent'), openThread: t(locale, 'contact.openThread'), login: t(locale, 'contact.login'), loginHint: t(locale, 'contact.loginHint'),
        }} />
      <section>
        <h2>{t(locale, 'providers.reviews')}</h2>
        {p.reviews?.length ? (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
            {p.reviews.map((r) => (
              <li key={r.id} className="card small"><strong>{'★'.repeat(r.stars)}</strong> <span className="muted">· {fmt.format(new Date(r.createdAt))}</span>{r.text ? <p style={{ margin: '4px 0 0' }}>{r.text}</p> : null}</li>
            ))}
          </ul>
        ) : <p className="muted">{t(locale, 'providers.noReviews')}</p>}
      </section>
    </article>
  );
}
