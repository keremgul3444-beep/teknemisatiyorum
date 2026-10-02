import Link from 'next/link';
import type { Metadata } from 'next';
import { localePath, t, type Locale } from '@/i18n';
import { authedGet } from '@/lib/auth-server';

type P = { params: Promise<{ locale: string }> };
type Row = { id: string; subject: { kind: string; id: string; title: string }; otherName: string | null; lastMessage: { text: string; at: string; mine: boolean } | null; unread: boolean };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'account.messages') }), robots: { index: false, follow: false } };
}

/** Sitedeki mesaj kutusu: ilan konulu sohbetler (uygulamadakiyle aynı sohbetler). */
export default async function Mesajlar({ params }: P) {
  const { locale } = (await params) as { locale: Locale };
  const rows = await authedGet<Row[]>(locale, '/conversations', '/hesabim/mesajlar');
  return (
    <section className="section" style={{ maxWidth: 720 }}>
      <h1>{t(locale, 'account.messages')}</h1>
      {rows.length === 0 ? <p className="muted">{t(locale, 'account.noMessages')}</p> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((c) => (
            <Link key={c.id} className="card spread" href={localePath(locale, `/hesabim/mesajlar/${c.id}`)} style={{ color: 'inherit' }}>
              <div style={{ minWidth: 0 }}>
                <strong>{c.subject.title}</strong>
                <div className="muted small">{c.otherName ?? '—'}{c.lastMessage ? ` · ${c.lastMessage.mine ? t(locale, 'account.you') : ''}${c.lastMessage.text.slice(0, 80)}` : ''}</div>
              </div>
              {c.unread ? <span className="pill urgent">{t(locale, 'account.unread')}</span> : null}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
