// Alışkanlık gücü (H) modeli — Spesifikasyon §3.
// SAF FONKSİYON: H hiçbir yerde biriktirilmez; her seferinde kayıt geçmişinden
// (başlangıç günü + yapılan günler) baştan hesaplanır. Böylece geriye dönük
// düzeltmeler, silme ve parametre değişiklikleri her zaman tutarlı kalır.
import {
  ALFA, LAMBDA_ILK, LAMBDA_ARDISIK, TABAN_ORANI, TASARRUF,
  ASAMA_YUKARI, ASAMA_ASAGI, YOL_NOKTALARI, PARLAKLIK_GUN,
} from './parametreler.js';
import { addDays } from './clock.js';

/** Aşamalar: 0 Çaba, 1 Tekrar, 2 Yerleşiyor, 3 Otomatik */
export const OTOMATIK = 3;

/**
 * Bir günün sonucunu uygular (§3.3). Durum nesnesini yerinde günceller.
 * @param {{H:number,P:number,k:number,asama:number}} d
 * @param {boolean} yapildi
 */
export function gunuUygula(d, yapildi) {
  if (yapildi) {
    // Daha önce ulaşılan seviyenin altındaysa geri dönüş daha hızlı (tasarruf etkisi)
    const a = d.H < d.P ? ALFA * (1 + TASARRUF * d.P) : ALFA;
    d.H += a * (1 - d.H);
    d.k = 0;
  } else {
    d.k += 1;
    const lambda = d.k === 1 ? LAMBDA_ILK : LAMBDA_ARDISIK;
    const F = TABAN_ORANI * d.P; // İz asla tamamen silinmez
    d.H = F + (d.H - F) * (1 - lambda);
  }
  d.P = Math.max(d.P, d.H);
  // Histerezis: yukarı ve aşağı eşikler farklı
  while (d.asama < 3 && d.H >= ASAMA_YUKARI[d.asama] - 1e-12) d.asama++;
  while (d.asama > 0 && d.H < ASAMA_ASAGI[d.asama - 1]) d.asama--;
  return d;
}

/**
 * Alışkanlığın bugünkü durumunu kayıt geçmişinden hesaplar.
 * Kapanmış günler (başlangıçtan düne kadar) sırayla işlenir; bugün henüz kapanmadığı
 * için kaçırma sayılmaz, ama yapıldıysa kazanım hemen görünür.
 * @param {{createdAt:string, done:string[]}} habit
 * @param {string} bugun 'YYYY-MM-DD'
 * @returns {{H:number, P:number, asama:number, toplamTekrar:number, son7Oran:number, ardisikKacirma:number}}
 */
export function computeState(habit, bugun) {
  const yapilan = new Set(habit.done);
  const d = { H: 0, P: 0, k: 0, asama: 0 };
  const son7 = [];
  for (let g = habit.createdAt; g < bugun; g = addDays(g, 1)) {
    const y = yapilan.has(g);
    gunuUygula(d, y);
    son7.push(y);
    if (son7.length > PARLAKLIK_GUN) son7.shift();
  }
  if (yapilan.has(bugun)) gunuUygula(d, true);
  // Parlaklık: son 7 kapanmış günün tamamlanma oranı (bugün yapıldıysa o da sayılır).
  // Hiç kapanmış gün yoksa (yeni alışkanlık) tam parlak başlar.
  if (yapilan.has(bugun)) { son7.push(true); if (son7.length > PARLAKLIK_GUN) son7.shift(); }
  const son7Oran = son7.length ? son7.filter(Boolean).length / son7.length : 1;
  let toplamTekrar = 0;
  for (const g of habit.done) if (g >= habit.createdAt && g <= bugun) toplamTekrar++;
  return { H: d.H, P: d.P, asama: d.asama, toplamTekrar, son7Oran, ardisikKacirma: d.k };
}

/** H (0..1) → kürenin yol üzerindeki konumu (0..1), parçalı doğrusal (§3.5). */
export function yolKonumu(H) {
  const h = Math.max(0, Math.min(1, H));
  for (let i = 1; i < YOL_NOKTALARI.length; i++) {
    const [h0, y0] = YOL_NOKTALARI[i - 1];
    const [h1, y1] = YOL_NOKTALARI[i];
    if (h <= h1) return y0 + ((h - h0) / (h1 - h0)) * (y1 - y0);
  }
  return 1;
}
