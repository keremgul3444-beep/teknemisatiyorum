import AsyncStorage from '@react-native-async-storage/async-storage';
import { restoreDraft, serializeDraft, isBlank, type WizardState } from './listingForm';

/** Yarım kalan ilan bu cihazda, hesaba özel anahtarla saklanır; çıkışta silinir. */
const PREFIX = 'tms.listingDraft.';
const keyOf = (userId?: string) => `${PREFIX}${userId ?? 'demo'}`;

export async function loadListingDraft(userId?: string): Promise<WizardState | null> {
  try {
    return restoreDraft(await AsyncStorage.getItem(keyOf(userId)));
  } catch {
    return null;
  }
}

/** Taslak kaydı hata verirse (ör. depolama dolu) ilan vermeyi durdurmaz. */
export async function saveListingDraft(userId: string | undefined, s: WizardState): Promise<void> {
  try {
    if (isBlank(s)) await AsyncStorage.removeItem(keyOf(userId));
    else await AsyncStorage.setItem(keyOf(userId), serializeDraft(s));
  } catch {
    // yok sayılır
  }
}

export async function clearListingDraft(userId?: string): Promise<void> {
  await AsyncStorage.removeItem(keyOf(userId)).catch(() => undefined);
}

/** Çıkışta bu cihazdaki tüm ilan taslakları silinir (paylaşılan telefonda başkası görmesin). */
export async function clearAllListingDrafts(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch {
    // yok sayılır
  }
}
