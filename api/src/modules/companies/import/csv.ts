/**
 * Basit ve sağlam CSV okuyucu: Excel'in "CSV UTF-8" çıktısı (Türkçe Excel'de `;` ayraç), virgül ya da sekme; tırnaklı
 * alanlar, alan içinde satır sonu ve çift tırnak (`""`) desteklenir; baştaki BOM atılır. Boş satırlar atlanır.
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = [';', '\t', ','].map((d) => [d, countOutsideQuotes(firstLine, d)] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === delim) { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

function countOutsideQuotes(line: string, d: string) {
  let n = 0;
  let q = false;
  for (const c of line) { if (c === '"') q = !q; else if (!q && c === d) n++; }
  return n;
}
