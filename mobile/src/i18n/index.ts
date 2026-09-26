import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import tr from './tr.json';
import en from './en.json';

export type Lang = 'tr' | 'en';

const device: Lang = getLocales()[0]?.languageCode === 'en' ? 'en' : 'tr';

i18n.use(initReactI18next).init({
  resources: { tr: { translation: tr }, en: { translation: en } },
  lng: device,
  fallbackLng: 'tr',
  interpolation: { escapeValue: false },
});

export const setLanguage = (lang: Lang) => i18n.changeLanguage(lang);
export const currentLang = (): Lang => (i18n.language === 'en' ? 'en' : 'tr');
export default i18n;

/** Sunucunun yazdığı sistem metinleri 'i18n:' önekli çeviri anahtarıdır; kullanıcı metni olduğu gibi gösterilir. */
export const tx = (t: (k: string) => string, s: string) => (s.startsWith('i18n:') ? t(s.slice(5)) : s);
