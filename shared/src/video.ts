/** İlan videosu: yalnızca bilinen platformların bağlantısı (dosya yüklenmez). Gömme adresi gizlilik dostu sürümden. */
export type Video = { provider: 'youtube' | 'vimeo' | 'instagram'; id: string; url: string; embed: string };

export function parseVideoUrl(raw: string | null | undefined): Video | null {
  if (!raw) return null;
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.replace(/^(www\.|m\.)/, '');
  const yt = (id: string | null | undefined): Video | null => (id && /^[\w-]{11}$/.test(id)
    ? { provider: 'youtube', id, url: `https://www.youtube.com/watch?v=${id}`, embed: `https://www.youtube-nocookie.com/embed/${id}` } : null);
  if (host === 'youtube.com') {
    if (u.pathname === '/watch') return yt(u.searchParams.get('v'));
    const m = /^\/(shorts|embed|live)\/([\w-]{11})/.exec(u.pathname);
    return m ? yt(m[2]) : null;
  }
  if (host === 'youtu.be') return yt(u.pathname.slice(1).split('/')[0]);
  if (host === 'vimeo.com') {
    const m = /^\/(\d{6,12})(?:\/|$)/.exec(u.pathname);
    return m ? { provider: 'vimeo', id: m[1], url: `https://vimeo.com/${m[1]}`, embed: `https://player.vimeo.com/video/${m[1]}?dnt=1` } : null;
  }
  if (host === 'instagram.com') {
    const m = /^\/(reel|p|tv)\/([\w-]{5,40})/.exec(u.pathname);
    return m ? { provider: 'instagram', id: m[2], url: `https://www.instagram.com/${m[1]}/${m[2]}/`, embed: `https://www.instagram.com/${m[1]}/${m[2]}/embed` } : null;
  }
  return null;
}
