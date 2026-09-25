// Kullanım: node scripts/i18n-merge.js <parça.json>
// Parça dosyası { "tr": {...}, "en": {...} } biçimindedir; iki dile derin birleştirilir.
const fs = require('fs');
const path = require('path');

const part = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const merge = (a, b) => {
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) a[k] = merge(a[k] && typeof a[k] === 'object' ? a[k] : {}, v);
    else a[k] = v;
  }
  return a;
};
for (const lang of ['tr', 'en']) {
  const file = path.join(__dirname, '..', 'src', 'i18n', `${lang}.json`);
  const cur = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, JSON.stringify(merge(cur, part[lang] || {}), null, 2) + '\n');
}
console.log('merged', Object.keys(part.tr || {}).join(', '));
