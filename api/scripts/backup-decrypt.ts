/**
 * Buluttaki şifreli yedeği açar: `node --env-file=.env --import tsx scripts/backup-decrypt.ts <dosya.json.enc> [çıktı.json]`.
 * Aynı ID_ENC_KEY gerekir (api/.env). Çıktı, sunucunun günlük JSON yedeğiyle aynı biçimdedir.
 */
import fs from 'fs';
import { openBackup } from '../src/backup/backup';

const [input, output] = process.argv.slice(2);
if (!input) {
  console.error('Kullanım: scripts/backup-decrypt.ts <dosya.json.enc> [çıktı.json]');
  process.exit(1);
}
const out = output ?? input.replace(/\.enc$/, '');
fs.writeFileSync(out, openBackup(fs.readFileSync(input)));
console.log(`Açıldı: ${out}`);
