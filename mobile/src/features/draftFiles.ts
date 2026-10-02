import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * Yarım ilanın fotoğraf ve belgeleri. Galeriden seçilen dosyalar uygulamanın önbelleğinde durur ve sistem
 * yer açmak için silebilir; taslak geri yüklendiğinde dosya kaybolmasın diye kalıcı klasöre kopyalanır.
 * Tarayıcıda (blob adresleri) ve kopyalama başarısız olursa özgün adres aynen kullanılır.
 */
const native = Platform.OS !== 'web';
const draftDir = () => new Directory(Paths.document, 'listing-draft');
const isLocal = (uri: string) => uri.startsWith('file://');

export async function keepDraftFile(uri: string): Promise<string> {
  if (!native || !isLocal(uri)) return uri;
  try {
    const dir = draftDir();
    dir.create({ intermediates: true, idempotent: true });
    const ext = /\.(\w{2,5})(?:\?|$)/.exec(uri)?.[1] ?? 'jpg';
    const dest = new File(dir, `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.${ext}`);
    await new File(uri).copy(dest);
    return dest.uri;
  } catch {
    return uri;
  }
}

/** Dosya hâlâ okunabilir mi; denetlenemeyen adresler (tarayıcı, içerik sağlayıcı) var sayılır. */
export function draftFileExists(uri: string): boolean {
  if (!native || !isLocal(uri)) return true;
  try {
    return new File(uri).exists;
  } catch {
    return true;
  }
}

/** Yayından, "baştan başla"dan ve çıkıştan sonra kopyalar silinir. */
export function clearDraftFiles(): void {
  if (!native) return;
  try {
    const dir = draftDir();
    if (dir.exists) dir.delete();
  } catch {
    // yok sayılır
  }
}
