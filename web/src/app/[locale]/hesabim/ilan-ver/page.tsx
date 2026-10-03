import type { Metadata } from 'next';
import { localePath, t, tDict, type Locale } from '@/i18n';
import { authedGet } from '@/lib/auth-server';
import { SellWizard } from '@/components/SellWizard';

type P = { params: Promise<{ locale: string }> };
type Me = { verifyLevel: number };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'sell.title') }), robots: { index: false, follow: false } };
}

/** Siteden ilan verme (girişli). Kimliği doğrulanmamış satıcı son adımda doğrular. */
export default async function IlanVer({ params }: P) {
  const { locale } = (await params) as { locale: Locale };
  const [me, companies] = await Promise.all([
    authedGet<Me>(locale, '/me', '/hesabim/ilan-ver'),
    authedGet<{ id: string; name: string }[]>(locale, '/companies/mine', '/hesabim/ilan-ver'),
  ]);
  return (
    <section className="section" style={{ maxWidth: 820 }}>
      <h1>{t(locale, 'sell.title')}</h1>
      <p className="muted">{t(locale, 'sell.intro')}</p>
      <SellWizard L={tDict(locale, 'sell')} err={tDict(locale, 'sell.err')} errors={tDict(locale, 'errors')} types={tDict(locale, 'boatType')}
        equipment={tDict(locale, 'equipment')} verified={me.verifyLevel >= 2} doneHref={localePath(locale, '/hesabim/ilanlar')}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))} />
    </section>
  );
}
