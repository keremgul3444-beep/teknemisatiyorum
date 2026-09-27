import { t, type Locale } from '@/i18n';

// Geçici gövde: ana sayfa bir sonraki adımda (vitrin, acil, son eklenenler) dolar.
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  return (
    <section className="section">
      <h1>{t(locale, 'home.title')}</h1>
      <p className="muted">{t(locale, 'home.subtitle')}</p>
    </section>
  );
}
