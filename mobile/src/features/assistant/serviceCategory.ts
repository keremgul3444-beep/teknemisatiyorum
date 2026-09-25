import type { UstaCategory } from '@/services/types';

const RULES: [RegExp, UstaCategory][] = [
  [/motor|engine|pervane|şaft|yağ|egzoz|impeller/, 'motor'],
  [/elektrik|akü|aku|şarj|sigorta|electric|battery|kablo/, 'elektrik'],
  [/elektronik|radar|plotter|gps|otopilot|telsiz|electronics/, 'elektronik'],
  [/boya|zehirli|vernik|paint|antifouling/, 'boya'],
  [/jelkot|cam elyaf|çatlak|osmoz|gelcoat|fiberglass/, 'jelkot'],
  [/branda|bimini|sprayhood|tente|canvas/, 'branda'],
  [/döşeme|minder|kumaş|upholster|cushion/, 'doseme'],
  [/yelken|arma|sail|rigging/, 'yelken'],
];

/** Serbest metindeki derdi usta kategorisine eşler. */
export function detectCategory(text: string): UstaCategory | undefined {
  const s = text.toLocaleLowerCase('tr-TR');
  return RULES.find(([re]) => re.test(s))?.[1];
}
