'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Locale } from '@/i18n';

/** Aynı sayfanın diğer dildeki karşılığına bağlantı. */
export function LangSwitch({ locale, label }: { locale: Locale; label: string }) {
  const path = usePathname() || '/';
  const bare = path === '/en' ? '/' : path.startsWith('/en/') ? path.slice(3) : path;
  const href = locale === 'tr' ? (bare === '/' ? '/en' : `/en${bare}`) : bare;
  return <Link href={href} hrefLang={locale === 'tr' ? 'en' : 'tr'}>{label}</Link>;
}
