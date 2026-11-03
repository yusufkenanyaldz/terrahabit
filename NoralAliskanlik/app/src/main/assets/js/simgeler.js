// Alışkanlık simgeleri. Çizgi simge (emoji değil): 24×24 kutu, yalnız kontur.
// Aynı yol verisi hem arayüzde (inline SVG) hem widget'ta (vektör drawable) kullanılır;
// widget dosyaları scripts/simge-drawable.mjs ile bu listeden üretilir.
export const SIMGELER = [
  { id: 'genel', ad: 'Genel', d: 'M20 12a8 8 0 1 1-16 0a8 8 0 1 1 16 0M13.6 12a1.6 1.6 0 1 1-3.2 0a1.6 1.6 0 1 1 3.2 0' },
  { id: 'kitap', ad: 'Kitap', d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' },
  { id: 'kulaklik', ad: 'Dinleme', d: 'M3.5 17v-5a8.5 8.5 0 0 1 17 0v5M20.5 18.5a2 2 0 0 1-2 2h-2v-6h2a2 2 0 0 1 2 2zM3.5 18.5a2 2 0 0 0 2 2h2v-6h-2a2 2 0 0 0-2 2z' },
  { id: 'kalem', ad: 'Yazma', d: 'M16.8 3.2a2.9 2.9 0 1 1 4 4L7.6 20.4 2.5 21.5l1.1-5.1zM15 5l4 4' },
  { id: 'konusma', ad: 'Konuşma', d: 'M21 11.6a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.9-.9L3 20.6l1.6-4.8A8.4 8.4 0 0 1 12 3.2a8.4 8.4 0 0 1 9 8.4z' },
  { id: 'damla', ad: 'Su', d: 'M12 2.8l5.3 5.4a7.5 7.5 0 1 1-10.6 0z' },
  { id: 'agirlik', ad: 'Spor', d: 'M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11' },
  { id: 'doga', ad: 'Dışarı', d: 'M3 19l6-8 4 5 2.5-3L21 19zM17.2 6.6a1.6 1.6 0 1 1-3.2 0a1.6 1.6 0 1 1 3.2 0' },
  { id: 'kalp', ad: 'Sağlık', d: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z' },
  { id: 'ay', ad: 'Uyku', d: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z' },
  { id: 'saat', ad: 'Zaman', d: 'M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0M12 7v5l3.4 2' },
  { id: 'yasak', ad: 'Bırakma', d: 'M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0M5.6 5.6l12.8 12.8' },
];

export const SIMGE_IDLER = SIMGELER.map((s) => s.id);
const YOLLAR = Object.fromEntries(SIMGELER.map((s) => [s.id, s.d]));

/** Bilinmeyen id'de 'genel' döner. */
export function simgeYolu(id) {
  return YOLLAR[id] || YOLLAR.genel;
}

/** Eski kayıtlardaki emoji simgesini yeni çizgi simgeye çevirir (v3 → v4). */
export function emojidenSimge(emoji) {
  if (typeof emoji !== 'string' || !emoji) return 'genel';
  const esle = [
    ['kitap', '📚📖📕📗📘📙'], ['kulaklik', '🎧🎵🎶'], ['kalem', '✍️📝✏️🖊'],
    ['konusma', '💬🗣️🈯'], ['damla', '💧🚰🥤'], ['agirlik', '🏋️💪🏃🚴⚽🏀'],
    ['doga', '🌳🌲🏞️🥾🌅'], ['kalp', '❤️💖💗🫀'], ['ay', '🌙😴🛏️💤'],
    ['saat', '⏰⌛⏳🕐'], ['yasak', '🚭🚫⛔🔞'],
  ];
  for (const [id, liste] of esle) if ([...liste].some((e) => emoji.includes(e))) return id;
  return 'genel';
}

/** Arayüzde kullanılacak inline SVG (boyut px). */
export function simgeSvg(id, boy = 18) {
  return `<svg class="simge" viewBox="0 0 24 24" width="${boy}" height="${boy}" fill="none"
    stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true"><path d="${simgeYolu(id)}"/></svg>`;
}
