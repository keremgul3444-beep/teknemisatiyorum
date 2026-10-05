/**
 * Sitenin bağlantıları uygulamada açılınca (universal link / app link) uygulama ekranına çevrilir:
 * `/ilan/<marka-model-yil-kimlik>` ve `/en/ilan/...` → `/ilan/<kimlik>`; sitenin tanınmayan sayfaları ana sayfaya.
 * Uygulamanın kendi şeması (`teknemisatiyorum://...`, Expo Go `exp://`) ve uygulama içi yollar olduğu gibi kalır.
 */
export function appPathFor(raw: string): string {
  let path = raw;
  let web = false;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return raw;
    path = u.pathname;
    web = true;
  } catch {
    // zaten yol
  }
  const p = path.replace(/^\/en(?=\/|$)/, '') || '/';
  const m = /^\/ilan\/([^/?#]+)/.exec(p);
  if (m) {
    const slug = decodeURIComponent(m[1]);
    return `/ilan/${slug.slice(slug.lastIndexOf('-') + 1)}`;
  }
  if (!web) return raw;
  if (p === '/ilanlar' || p.startsWith('/satilik')) return '/ilanlar';
  return '/';
}
