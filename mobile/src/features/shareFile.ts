import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Metni telefonda dosya olarak paylaşır (e-posta, Dosyalar, Drive…). Paylaşım menüsünün metin sınırına takılmaz:
 * büyük veri kopyası da eksiksiz gider. Dosya önbellek klasörüne yazılır; sistem sonra temizler.
 * Paylaşım bu cihazda yoksa false döner (çağıran metinle paylaşmaya düşer).
 */
export async function shareTextFile(name: string, text: string, mimeType = 'application/json'): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  const f = new File(Paths.cache, name);
  f.create({ overwrite: true });
  f.write(text);
  await Sharing.shareAsync(f.uri, { mimeType, dialogTitle: name, UTI: mimeType === 'application/json' ? 'public.json' : undefined });
  return true;
}
