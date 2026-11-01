// Alışkanlık gücü modelinin TÜM sabitleri (Spesifikasyon §3.2).
// Bilimsel kaynaklarla uyumlu kalibre edilmiş TASARIM KARARLARI; gerçek kullanım
// verisi geldikçe yalnızca bu dosyadan ayarlanır.

/** Kazanım hızı α. 1 - 0.05^(1/66) = 0.0444 aşama günlerini 16/42/66 yapıyor;
 *  0.045 mevcut 16/41/66 sınırlarını aynen koruyor (spesifikasyon tabloları da bununla). */
export const ALFA = 0.045;

/** İlk kaçırmada çözülme (tepede ≈0,7 puan; Lally'de ölçülen tek kaçırma etkisi). */
export const LAMBDA_ILK = 0.01;
/** Art arda 2. ve sonraki kaçırmalarda çözülme (taban üstünün yarılanması ≈34 gün). */
export const LAMBDA_ARDISIK = 0.02;
/** Taban: ulaşılan en yüksek gücün (iz, P) silinmeyen kısmı. F = TABAN_ORANI · P */
export const TABAN_ORANI = 0.25;
/** Geri dönüş (tasarruf) etkisi: H < P iken kazanım α · (1 + TASARRUF · P) */
export const TASARRUF = 0.5;

/** Aşama eşikleri. Yukarı geçiş / aşağı iniş ayrı: sınırda küre titremesin (histerezis). */
export const ASAMA_YUKARI = [0.50, 0.845, 0.95];
export const ASAMA_ASAGI = [0.45, 0.795, 0.90];

/** Kürenin yol üzerindeki konumu: her aşamaya yolun eşit payı (Spesifikasyon §3.5). */
export const YOL_NOKTALARI = [
  // [H, yol konumu 0..1]
  [0, 0],
  [0.50, 0.25],
  [0.845, 0.50],
  [0.95, 0.75],
  [1, 1],
];

/** Parlaklık için bakılan son gün sayısı (son 7 planlı fırsat). */
export const PARLAKLIK_GUN = 7;

/** Gün bu saatte başlar: gece 01:00'deki "akşam" alışkanlığı önceki güne yazılır. */
export const GUN_BASLANGIC_SAATI = 4;

/** Geriye dönük serbest kayıt: bugünden önceki kaç güne işaret konabilir/kaldırılabilir. */
export const GERIYE_DONUK_GUN = 3;
