import Link from 'next/link';
import { localePath, t, type Locale } from '@/i18n';

const ITEMS = [['/yonetim/ilanlar', 'admin.navListings'], ['/yonetim/bildirimler', 'admin.navReports'], ['/yonetim/belgeler', 'admin.navDocs'], ['/yonetim/kullanicilar', 'admin.navUsers'], ['/yonetim/kayitlar', 'admin.navAudit']] as const;

/** Yönetim alt menüsü; bulunulan sayfa işaretli. */
export function AdminNav({ locale, current }: { locale: Locale; current?: string }) {
  return (
    <nav className="row small" aria-label={t(locale, 'admin.title')} style={{ marginBottom: 16 }}>
      <Link className="chip" href={localePath(locale, '/yonetim')} aria-current={current === undefined ? 'page' : undefined}>{t(locale, 'admin.title')}</Link>
      {ITEMS.map(([href, key]) => (
        <Link key={href} className="chip" href={localePath(locale, href)} aria-current={current === href ? 'page' : undefined}>{t(locale, key)}</Link>
      ))}
    </nav>
  );
}
