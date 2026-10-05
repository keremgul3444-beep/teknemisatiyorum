/**
 * WhatsApp sohbet bağlantısı (wa.me): numara uluslararası biçimde, yalnızca rakam; hazır mesajda ilan başlığı.
 * Yalnızca sohbette numarası açılmış kişi için kullanılır (ilk temas uygulama içinde kalır).
 */
export function whatsappUrl(phone: string, text?: string): string | null {
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('05')) d = `9${d}`;
  else if (d.length === 10 && d.startsWith('5')) d = `90${d}`;
  if (d.length < 10 || d.length > 15) return null;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
