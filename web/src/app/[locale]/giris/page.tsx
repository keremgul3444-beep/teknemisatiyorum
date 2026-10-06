import Link from 'next/link';
import type { Metadata } from 'next';
import { localePath, t, tDict, type Locale } from '@/i18n';
import { safeNext } from '@/lib/session';
import { LoginForm } from '@/components/LoginForm';

type P = { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string | string[] }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'login.title') }), robots: { index: false, follow: false } };
}

export default async function Giris({ params, searchParams }: P) {
  const { locale } = (await params) as { locale: Locale };
  const raw = (await searchParams).next;
  const next = safeNext(Array.isArray(raw) ? raw[0] : raw, locale);
  const l = (k: string) => t(locale, `login.${k}`);
  return (
    <section className="section">
      <h1>{l('title')}</h1>
      <p className="muted">{l('subtitle')}</p>
      <LoginForm next={next} errors={tDict(locale, 'errors')}
        labels={{ phone: l('phone'), sendCode: l('sendCode'), code: l('code'), verify: l('verify'), resend: l('resend'), resendIn: l('resendIn'), codeSent: l('codeSent'), betaHint: l('betaHint') }} />
      <p className="muted small" style={{ marginTop: 16 }}><Link href={localePath(locale, '/kvkk')}>{l('kvkk')}</Link></p>
    </section>
  );
}
