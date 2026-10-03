import type { Metadata } from 'next';
import { t, tDict, type Locale } from '@/i18n';
import { staffGet } from '@/lib/auth-server';
import { AdminNav } from '@/components/AdminNav';
import { DocDecision } from '@/components/AdminActions';

type P = { params: Promise<{ locale: string }> };
type Req = { id: string; kind: string; userName: string | null; fileIds: string[]; details: Record<string, unknown> | null; createdAt: string };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'admin.navDocs') }), robots: { index: false, follow: false } };
}

/** Belge başvuruları: belgeler 5 dakikalık imzalı bağlantıyla açılır; her açılış denetim kaydına yazılır. */
export default async function Belgeler({ params }: P) {
  const { locale } = (await params) as { locale: Locale };
  const rows = await staffGet<Req[]>(locale, '/admin/queue?kind=verification', '/yonetim/belgeler');
  return (
    <section className="section">
      <h1>{t(locale, 'admin.navDocs')}</h1>
      <AdminNav locale={locale} current="/yonetim/belgeler" />
      {rows.length === 0 ? <p className="muted">{t(locale, 'admin.empty')}</p> : (
        <div style={{ display: 'grid', gap: 16 }}>
          {rows.map((r) => (
            <article key={r.id} className="card" style={{ display: 'grid', gap: 10 }}>
              <h2 style={{ margin: 0 }}>{t(locale, `admin.docKinds.${r.kind}`)}</h2>
              <p className="muted small" style={{ margin: 0 }}>{t(locale, 'admin.by', { who: r.userName ?? '—' })}</p>
              {r.details ? (
                <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                  {Object.entries(r.details).map(([k, v]) => <li key={k}>{t(locale, `admin.detail.${k}`)}: {String(v)}</li>)}
                </ul>
              ) : null}
              <div className="row small">
                {r.fileIds.map((f, i) => <a key={f} href={`/api/admin/doc/${f}`} target="_blank" rel="noreferrer">{t(locale, 'admin.openDoc', { n: i + 1 })}</a>)}
              </div>
              <DocDecision id={r.id} L={tDict(locale, 'admin')} reasons={tDict(locale, 'admin.reasons')} errors={tDict(locale, 'errors')} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
