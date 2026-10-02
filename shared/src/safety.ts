/**
 * Mesajda ödeme isteği işareti: IBAN, kapora/ön ödeme, havale/EFT ya da para transferi şirketi geçiyorsa alıcıya
 * uyarı gösterilir. Engellemez; dolandırıcılığın en sık izi tekneyi görmeden para istenmesidir.
 */
const IBAN = /\bTR\s?\d{2}(?:\s?\d{4}){5}\s?\d{2}\b|\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,3})?\b/;
// \b Türkçe harflerde (ö, ü) çalışmaz; Hermes'te geriye bakış ve Unicode sınıfı olmadan elle kelime sınırı.
const L = 'a-zçğıöşüâîû0-9';
const WORDS = new RegExp(`(^|[^${L}])(iban|ıban|kapora|kaparo|ön ?ödeme|on ?odeme|depozito|havale|eft|fast ile|western ?union|moneygram|papara|deposit|down ?payment|wire transfer|bank transfer)(?=$|[^${L}])`);

export function paymentRisk(text: string): boolean {
  const upper = text.toUpperCase();
  return IBAN.test(upper) || WORDS.test(text.toLocaleLowerCase('tr-TR'));
}
