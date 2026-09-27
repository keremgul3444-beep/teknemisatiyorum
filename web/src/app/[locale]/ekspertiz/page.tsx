import { t, type Locale } from '@/i18n';
import { apiGet } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { siteUrl } from '@/lib/seo';
import { InfoPage, infoMetadata } from '@/components/InfoPage';
import { AppLink, JsonLd } from '@/components/bits';

export const revalidate = 3600;
export const generateMetadata = infoMetadata('expertise');

type Pkg = { id: string; name: string; priceTry: number; items: string[] };

export default async function Ekspertiz({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  const pkgs = await apiGet<Pkg[]>('/expertise/packages', { revalidate: 3600 }).catch(() => []);
  return (
    <InfoPage locale={locale} pageKey="expertise">
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'Service', serviceType: t(locale, 'pages.expertise.title'),
        provider: { '@type': 'Organization', name: 'teknemisatıyorum', url: siteUrl() }, areaServed: 'TR',
        offers: pkgs.map((p) => ({ '@type': 'Offer', name: p.name, price: p.priceTry, priceCurrency: 'TRY' })),
      }} />
      {pkgs.length ? (
        <div className="grid" style={{ margin: '24px 0' }}>
          {pkgs.map((p) => (
            <div key={p.id} className="card">
              <h3>{p.name}</h3>
              <strong style={{ fontSize: 22, color: 'var(--c-primary)' }}>{formatPrice(p.priceTry, 'TRY', locale)}</strong>
              <ul className="small">{p.items.map((i) => <li key={i}>{i}</li>)}</ul>
            </div>
          ))}
        </div>
      ) : null}
      <AppLink locale={locale} path="ekspertiz">{t(locale, 'pages.expertise.cta')}</AppLink>
    </InfoPage>
  );
}
