import Link from 'next/link';
import { gradients } from '@tms/shared';
import { localePath, t, type Locale } from '@/i18n';
import { formatPrice, listingSlug, mediaUrl } from '@/lib/format';
import type { ListingView } from '@/lib/types';
import { PromoBadges } from './PromoBadges';

/** İlan kartı. Fotoğraf yoksa uygulamadaki gibi kimlikten türeyen gökyüzü → deniz yer tutucusu. */
export function ListingCard({ listing: l, locale, priority }: { listing: ListingView; locale: Locale; priority?: boolean }) {
  const [a, b] = gradients[[...l.id].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7) % gradients.length];
  const photo = l.photos[0]?.id;
  const title = `${l.brand} ${l.model} · ${l.year}`;
  return (
    <Link href={localePath(locale, `/ilan/${listingSlug(l)}`)} className="lcard">
      <div className="photo" style={{ background: `linear-gradient(180deg, ${a} 0 62%, ${b} 62% 100%)` }}>
        {photo ? (
          <img src={mediaUrl(photo, 800)} srcSet={`${mediaUrl(photo, 400)} 400w, ${mediaUrl(photo, 800)} 800w`}
            sizes="(max-width: 640px) 100vw, 300px" alt={title} width={800} height={600}
            loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : null}
        <span style={{ position: 'absolute', top: 12, left: 12 }}><PromoBadges promo={l.promo} priceDrop={l.priceDrop} locale={locale} /></span>
      </div>
      <div className="info">
        <div className="spread" style={{ flexWrap: 'nowrap' }}>
          <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</strong>
          <strong style={{ color: 'var(--c-primary)', whiteSpace: 'nowrap' }}>{formatPrice(l.price, l.currency, locale)}</strong>
        </div>
        <span className="muted small">
          {l.lengthM.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')} m · {l.location} · {t(locale, `boatType.${l.type}`)}
        </span>
      </div>
    </Link>
  );
}
