import { parseVideoUrl } from '@tms/shared';

/** İlan videosu: YouTube (çerezsiz sürüm), Vimeo (izlemesiz) ya da Instagram gömülü oynatıcı; tıklanana kadar yüklenmez (loading=lazy). */
export function VideoEmbed({ url, title }: { url: string; title: string }) {
  const v = parseVideoUrl(url);
  if (!v) return null;
  const tall = v.provider === 'instagram';
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: tall ? 420 : undefined, aspectRatio: tall ? '9 / 14' : '16 / 9', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
      <iframe src={v.embed} title={title} loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
    </div>
  );
}
