/** İlan açıklaması: satıcının girdiği bilgilerden düz metin (uygulama demo modu ve sunucu yedeği aynı metni üretir). */

/** Açıklama taslağı için ilan bilgileri (satıcının girdiği; doğrulanmış sayılmaz). */
export type ListingFacts = {
  brand: string; model: string; year: number; lengthM: number; type: string; location?: string;
  cabins?: number; engine?: string; engineHours?: number | null; flag?: 'tr' | 'foreign' | null;
  equipment: string[]; tradeIn?: boolean; negotiable?: boolean;
  /** Satıcının kısa notları (ör. "tek sahibinden, 2023'te boya"). */
  notes?: string;
};

export const TYPE_TR: Record<string, string> = { motoryat: 'motoryat', yelkenli: 'yelkenli', gulet: 'gulet', surat: 'sürat teknesi', balikci: 'balıkçı teknesi', katamaran: 'katamaran' };
export const EQUIP_TR: Record<string, string> = { jenerator: 'jeneratör', branda: 'branda', klima: 'klima', radar: 'radar', otopilot: 'otopilot', bowThruster: 'baş pervane', teak: 'tik güverte', tender: 'tender bot' };

/** Modelin göreceği bilgi listesi (alan adları Türkçe; boş alanlar yazılmaz). */
export function factsText(f: ListingFacts) {
  const lines = [
    `Marka/model: ${f.brand} ${f.model}`, `Yıl: ${f.year}`, `Boy: ${f.lengthM} m`, `Tip: ${TYPE_TR[f.type] ?? f.type}`, f.location ? `Konum: ${f.location}` : '',
    f.cabins ? `Kabin: ${f.cabins}` : '', f.engine ? `Motor: ${f.engine}` : '', f.engineHours != null ? `Motor saati: ${f.engineHours}` : '',
    f.flag ? `Bayrak: ${f.flag === 'tr' ? 'Türk bayraklı' : 'yabancı bayraklı'}` : '',
    f.equipment.length ? `Donanım: ${f.equipment.map((e) => EQUIP_TR[e] ?? e).join(', ')}` : '',
    f.tradeIn ? 'Takasa açık' : '', f.negotiable ? 'Pazarlık payı var' : '',
    f.notes?.trim() ? `Satıcı notları: ${f.notes.trim().slice(0, 600)}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

/** Yer adına bulunma eki: Bodrum'da, Göcek'te, Fethiye'de, Kaş'ta (ünlü uyumu ve sert ünsüz). */
export function locative(place: string) {
  const w = place.trim();
  const lower = w.toLocaleLowerCase('tr-TR');
  const vowel = [...lower].reverse().find((c) => 'aıoueiöü'.includes(c)) ?? 'e';
  const a = 'aıou'.includes(vowel) ? 'a' : 'e';
  const d = 'fstkçşhp'.includes(lower.at(-1) ?? '') ? 't' : 'd';
  return `${w}'${d}${a}`;
}

/** Anahtar yokken ya da model kullanılamazken: bilgilerden düz bir açıklama (uydurma yok). */
export function rulesDescription(f: ListingFacts): string {
  const type = TYPE_TR[f.type] ?? f.type;
  const first = `${f.year} model ${f.brand} ${f.model}, ${String(f.lengthM).replace('.', ',')} metre ${type}.${f.location ? ` Tekne ${locative(f.location)}.` : ''}`;
  const tech = [
    f.cabins ? `${f.cabins} kabinli` : '',
    f.engine ? `${f.engine} motorlu` : '',
    f.engineHours != null ? `motor ${f.engineHours} saatte` : '',
    f.flag ? (f.flag === 'tr' ? 'Türk bayraklı' : 'yabancı bayraklı') : '',
  ].filter(Boolean);
  const equip = f.equipment.length ? `Donanım: ${f.equipment.map((e) => EQUIP_TR[e] ?? e).join(', ')}.` : '';
  const terms = [f.tradeIn ? 'takasa açık' : '', f.negotiable ? 'pazarlık payı var' : ''].filter(Boolean);
  return [first, tech.length ? `${tech.join(', ').replace(/^./, (c) => c.toLocaleUpperCase('tr-TR'))}.` : '', equip,
    terms.length ? `${terms.join(', ').replace(/^./, (c) => c.toLocaleUpperCase('tr-TR'))}.` : '', f.notes?.trim() ?? '']
    .filter(Boolean).join(' ');
}

