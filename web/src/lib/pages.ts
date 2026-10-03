/** Sabit sayfalar: site haritası ve testler bu listeden okur. */
export const STATIC_PAGES = [
  { path: '/ekspertiz', key: 'expertise', indexable: true },
  { path: '/broker', key: 'broker', indexable: true },
  { path: '/tekne-karnesi', key: 'logbook', indexable: true },
  { path: '/usta', key: 'usta', indexable: true },
  { path: '/kaptan', key: 'kaptan', indexable: true },
  { path: '/usta-ol', key: 'ustaJoin', indexable: true },
  { path: '/kaptan-ol', key: 'kaptanJoin', indexable: true },
  { path: '/hakkimizda', key: 'about', indexable: true },
  { path: '/iletisim', key: 'contact', indexable: true },
  { path: '/kvkk', key: 'kvkk', indexable: true },
  { path: '/gizlilik', key: 'privacy', indexable: true },
  { path: '/kullanim-kosullari', key: 'terms', indexable: true },
  { path: '/cerezler', key: 'cookies', indexable: true },
  { path: '/on-bilgilendirme', key: 'preinfo', indexable: true },
  { path: '/mesafeli-satis', key: 'distanceSale', indexable: true },
] as const;
export type StaticPageKey = (typeof STATIC_PAGES)[number]['key'];
