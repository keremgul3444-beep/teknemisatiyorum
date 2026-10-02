import * as ImagePicker from 'expo-image-picker';

/**
 * Galeriden tek görsel seçtirir; seçilmezse null. Sunucu jpeg/png/webp kabul ettiği için
 * iOS'ta HEIC fotoğraflar uyumlu (jpeg) biçimde dışa aktarılır.
 */
export async function pickImage(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  return r.canceled ? null : r.assets[0]?.uri ?? null;
}

/**
 * Galeriden birden çok görsel seçtirir (en fazla `limit`); seçim sırası korunur. İzin yoksa ya da vazgeçilirse boş dizi.
 */
export async function pickImages(limit: number): Promise<string[]> {
  if (limit <= 0) return [];
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return [];
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsMultipleSelection: true,
    selectionLimit: limit,
    orderedSelection: true,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  return r.canceled ? [] : r.assets.map((a) => a.uri).filter(Boolean).slice(0, limit);
}
