import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { localePath, t, tDict, type Locale } from '@/i18n';
import { authedGet } from '@/lib/auth-server';
import { ApiError } from '@/lib/api';
import { paymentRisk } from '@tms/shared';
import { BlockButton, ReplyForm } from '@/components/AccountBits';
import { whatsappUrl } from '@tms/shared';

type P = { params: Promise<{ locale: string; id: string }> };
type Thread = {
  id: string; subject: { kind: string; id: string; title: string }; otherName: string | null; otherPhone: string | null;
  messages: { id: string; text: string; at: string; mine: boolean }[];
  /** `me`: ben engelledim; `them`: karşı taraf engelledi. */
  blocked?: 'me' | 'them' | null;
};

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'account.messages') }), robots: { index: false, follow: false } };
}

/** Tek sohbet: mesajlar ve yanıt kutusu. Satıcı numarasını paylaştıysa arama bağlantısı görünür. */
export default async function Sohbet({ params }: P) {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  if (!/^[a-z0-9]{8,40}$/i.test(id)) notFound();
  const th = await authedGet<Thread>(locale, `/conversations/${id}/messages`, `/hesabim/mesajlar/${id}`).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  const fmt = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });
  return (
    <section className="section" style={{ maxWidth: 720 }}>
      <p className="small"><Link href={localePath(locale, '/hesabim/mesajlar')}>{t(locale, 'account.messages')}</Link></p>
      <h1 style={{ fontSize: 26 }}>{th.subject.title}</h1>
      <p className="muted">{th.otherName ?? '—'}{th.otherPhone ? <> · <a href={`tel:${th.otherPhone}`}>{th.otherPhone}</a></> : null}
        {th.otherPhone && whatsappUrl(th.otherPhone, th.subject.title) ? <> · <a href={whatsappUrl(th.otherPhone, th.subject.title)!} target="_blank" rel="noopener noreferrer">{t(locale, 'account.whatsapp')}</a></> : null}
      </p>
      <div style={{ display: 'grid', gap: 8, margin: '16px 0' }}>
        {th.messages.map((m) => (
          <div key={m.id} className="card" style={{ justifySelf: m.mine ? 'end' : 'start', maxWidth: '85%', background: m.mine ? 'var(--c-surface)' : 'var(--c-card)', padding: '10px 14px' }}>
            <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{m.text}</p>
            <span className="muted small">{fmt.format(new Date(m.at))}</span>
            {!m.mine && paymentRisk(m.text) ? <p className="small" role="alert" style={{ color: 'var(--c-danger)', margin: '6px 0 0' }}>{t(locale, 'account.paymentRisk')}</p> : null}
          </div>
        ))}
      </div>
      <p className="notice">{t(locale, 'listing.safety')}</p>
      {th.blocked ? (
        <p className="muted">{t(locale, th.blocked === 'me' ? 'account.blockedByMe' : 'account.blockedByThem')}</p>
      ) : (
        <ReplyForm conversationId={th.id} errors={tDict(locale, 'errors')} labels={{ placeholder: t(locale, 'account.replyPh'), send: t(locale, 'contact.send') }} />
      )}
      {th.blocked !== 'them' && th.messages.some((m) => !m.mine) ? (
        <div style={{ marginTop: 16 }}>
          <BlockButton conversationId={th.id} blocked={th.blocked === 'me'} errors={tDict(locale, 'errors')}
            labels={{ block: t(locale, 'account.block'), unblock: t(locale, 'account.unblock'), confirm: t(locale, 'account.blockConfirm'), cancel: t(locale, 'account.cancel') }} />
        </div>
      ) : null}
    </section>
  );
}
