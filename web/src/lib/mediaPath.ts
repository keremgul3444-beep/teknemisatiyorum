const API_ORIGINS = [process.env.API_PUBLIC_URL, process.env.API_URL].filter(Boolean).map((u) => new URL(u!).origin);

/** API imzalı bağlantıyı tam adresle verir (PUBLIC_URL); site üzerinden açılsın diye yalnızca /media yolu alınır. */
export function mediaPath(url: string): string | null {
  if (url.startsWith('/media/')) return url;
  try {
    const u = new URL(url);
    return API_ORIGINS.includes(u.origin) && u.pathname.startsWith('/media/') ? u.pathname + u.search : null;
  } catch { return null; }
}
