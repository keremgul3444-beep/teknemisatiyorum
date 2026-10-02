'use client';
import { useCallback, useEffect, useState } from 'react';

const url = (id: string, w: 400 | 800 | 1600) => `/media/${id}?w=${w}`;

/**
 * İlan fotoğrafları: büyük kapak + kaydırılabilir küçük resim şeridi; dokununca tam ekran görüntüleyici
 * (ok tuşları, Esc, ileri/geri düğmeleri). JavaScript yoksa küçük resimler büyük fotoğrafa bağlantıdır.
 */
export function Gallery({ photos, alt, labels }: {
  photos: { id: string }[]; alt: string[]; labels: { open: string; close: string; prev: string; next: string; counter: string };
}) {
  const [open, setOpen] = useState<number | null>(null);
  const n = photos.length;
  const go = useCallback((d: number) => setOpen((i) => (i === null ? null : (i + d + n) % n)), [n]);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, go]);
  if (!n) return null;
  const [first, ...rest] = photos;
  const openAt = (i: number) => (e: React.MouseEvent) => { e.preventDefault(); setOpen(i); };
  return (
    <>
      <a href={url(first.id, 1600)} onClick={openAt(0)} aria-label={`${labels.open}: ${alt[0]}`}>
        <img src={url(first.id, 1600)} srcSet={`${url(first.id, 800)} 800w, ${url(first.id, 1600)} 1600w`} sizes="(max-width: 700px) 100vw, 600px"
          width={1600} height={1200} alt={alt[0]} fetchPriority="high" className="gallery-cover" />
      </a>
      {rest.length ? (
        <div className="thumbs">
          {rest.map((p, i) => (
            <a key={p.id} href={url(p.id, 1600)} onClick={openAt(i + 1)} aria-label={`${labels.open}: ${alt[i + 1]}`}>
              <img src={url(p.id, 400)} width={400} height={300} alt={alt[i + 1]} loading="lazy" decoding="async" />
            </a>
          ))}
        </div>
      ) : null}
      {open !== null ? (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={alt[open]} onClick={() => setOpen(null)}>
          <img src={url(photos[open].id, 1600)} alt={alt[open]} onClick={(e) => e.stopPropagation()} />
          <button type="button" className="lb-close" onClick={() => setOpen(null)} aria-label={labels.close}>×</button>
          {n > 1 ? (
            <>
              <button type="button" className="lb-prev" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label={labels.prev}>‹</button>
              <button type="button" className="lb-next" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label={labels.next}>›</button>
            </>
          ) : null}
          <span className="lb-count">{labels.counter.replace('{{n}}', String(open + 1)).replace('{{total}}', String(n))}</span>
        </div>
      ) : null}
    </>
  );
}
