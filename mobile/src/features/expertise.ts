/** Ekspertiz paketlerinde önerilen paket, listenin ortasındaki (Kapsamlı) pakettir; demo ve gerçek kimliklerden bağımsız. */
const popularIndex = (n: number) => (n >= 3 ? 1 : 0);

export function defaultPackageId(packages: { id: string }[]): string | undefined {
  return packages[popularIndex(packages.length)]?.id;
}

export function isPopularPackage(packages: { id: string }[], id: string): boolean {
  return packages.length >= 3 && packages[1]?.id === id;
}
