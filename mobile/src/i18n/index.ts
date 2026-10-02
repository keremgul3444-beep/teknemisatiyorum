import i18n, { changeLanguage } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import tr from './tr.json';
import en from './en.json';

export type Lang = 'tr' | 'en';

const device: Lang = getLocales()[0]?.languageCode === 'en' ? 'en' : 'tr';

// eslint-disable-next-line import/no-named-as-default-member -- i18next'in `use`'u React kancası değil; adlandırılmış içe aktarım ESLint'i yanıltıyor
i18n.use(initReactI18next).init({
  resources: { tr: { translation: tr }, en: { translation: en } },
  lng: device,
  fallbackLng: 'tr',
  interpolation: { escapeValue: false },
});

export const setLanguage = (lang: Lang) => changeLanguage(lang);
export const currentLang = (): Lang => (i18n.language === 'en' ? 'en' : 'tr');
export default i18n;

/**
 * Sunucunun yazdığı karne metinleri 'i18n:logbook.' önekli çeviri anahtarıdır; kullanıcı metni olduğu gibi gösterilir.
 * Önek yalnızca karne anahtarlarıyla sınırlı: kullanıcı "i18n:badge.broker" yazıp platform metni gösteremez.
 */
export const tx = (t: (k: string) => string, s: string) => (s.startsWith('i18n:logbook.') ? t(s.slice(5)) : s);
