const DAY = 86_400_000;

/** Oturumun son görülme zamanını "şimdi / N gün önce / N hafta önce" biçimine çevirir. */
export function agoOf(lastSeen: string | Date, now = new Date()): { unit: 'now' | 'days' | 'weeks'; n: number } {
  const days = Math.floor((now.getTime() - new Date(lastSeen).getTime()) / DAY);
  if (days < 1) return { unit: 'now', n: 0 };
  if (days < 14) return { unit: 'days', n: days };
  return { unit: 'weeks', n: Math.floor(days / 7) };
}
