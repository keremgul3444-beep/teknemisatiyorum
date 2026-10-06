import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { localePath, t, type Locale } from '@/i18n';
import { staffGet } from '@/lib/auth-server';
import { AdminNav } from '@/components/AdminNav';

type P = { params: Promise<{ locale: string; id: string }> };
type Conv = { id: string; subjectTitle: string; messages: { at: string; text: string; from: 'payer' | 'provider' }[] };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'admin.disputeChat') }), robots: { index: false, follow: false } };
}

/** Sorun bildirilen ödemede tarafların yazışması (yalnızca anlaşmazlıkta açılır, her açılış kayda geçer). */
export default async function OdemeYazisma({ params }: P) {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  if (!/^[a-z0-9]{8,40}$/i.test(id)) notFound();
  const convs = await staffGet<Conv[]>(locale, `/admin/service-payments/${id}/messages`, `/yonetim/odemeler/${id}`);
  const fmt = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });
  return (
    <section className="section" style={{ maxWidth: 760 }}>
      <h1>{t(locale, 'admin.disputeChat')}</h1>
      <AdminNav locale={locale} current="/yonetim/odemeler" />
      <p className="notice small">{t(locale, 'admin.disputeChatNote')}</p>
      {convs.length === 0 ? <p className="muted">{t(locale, 'admin.noChat')}</p> : convs.map((c) => (
        <div key={c.id} style={{ display: 'grid', gap: 8, marginTop: 16 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>{c.subjectTitle}</h2>
          {c.messages.map((m, i) => (
            <div key={i} className="card" style={{ justifySelf: m.from === 'payer' ? 'start' : 'end', maxWidth: '85%', padding: '8px 12px' }}>
              <span className="muted small">{t(locale, m.from === 'payer' ? 'admin.payer' : 'admin.provider')} · {fmt.format(new Date(m.at))}</span>
              <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{m.text}</p>
            </div>
          ))}
        </div>
      ))}
      <p className="small" style={{ marginTop: 16 }}><Link href={localePath(locale, '/yonetim/odemeler')}>{t(locale, 'admin.navPayments')}</Link></p>
    </section>
  );
}
