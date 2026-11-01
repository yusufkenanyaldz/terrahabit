// Alışkanlık gücü modelinin TÜM sabitleri (Spesifikasyon §3.2).
// Bilimsel kaynaklarla uyumlu kalibre edilmiş TASARIM KARARLARI; gerçek kullanım
// verisi geldikçe yalnızca bu dosyadan ayarlanır.

/** Normal zorlukta kazanım hızı α. 1 - 0.05^(1/66) = 0.0444 aşama günlerini 16/42/66
 *  yapıyor; 0.045 mevcut 16/41/66 sınırlarını aynen koruyor (spesifikasyon tabloları da bununla). */
export const ALFA = 0.045;

/** Zorluk → hedef süre T (gün). Lally: içme 59, yeme 65, egzersiz 91 (Spesifikasyon kural 14). */
export const ZORLUK_T = { kolay: 60, normal: 66, zor: 90 };

/** T günde (ya da R tekrarda) kusursuz takipte kalan pay: (1 - α)^66 ≈ 0,048.
 *  α(R) = 1 - KALAN^(1/R) → Normal'de tam 0,045; Kolay/Zor aynı eğriden türer. */
const KALAN = Math.pow(1 - ALFA, ZORLUK_T.normal);
export function alfaHesapla(tekrar) {
  return 1 - Math.pow(KALAN, 1 / tekrar);
}

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

/** Mazeret (hastalık vb.): kayan 30 günde en fazla 4 gün; fazlası kaçırma sayılır (kural 3). */
export const MAZERET_HAKKI = 4;
export const MAZERET_PENCERE = 30;

/** Duraklatma (tatil/seyahat) tek seferde en fazla bu kadar gün sürer (kural 4). */
export const DURAKLATMA_EN_UZUN = 30;

/** SRBAI otomatiklik anketi (kural §3.6): aralıklar, fark eşiği, T ayar adımı ve sınırları. */
export const SRBAI_ARALIK = 14;
export const SRBAI_BAKIM_ARALIK = 30;
export const SRBAI_FARK = 0.15;
export const SRBAI_ADIM = 0.10;
export const T_EN_AZ = 30;
export const T_EN_COK = 150;

/** Bakım modu: H ≥ 0,95 bu kadar gün sürünce hatırlatmalar seyrelir (kural 12). */
export const BAKIM_GUN = 14;

/** Kötü alışkanlıkta "nüks": son 7 günde 3 veya daha fazla kayma (kural 5). */
export const NUKS_PENCERE = 7;
export const NUKS_KAYMA = 3;

/** Aynı anda Çaba aşamasında önerilen en fazla alışkanlık (kural 13; uyarı, engel değil). */
export const CABA_UYARI_SAYISI = 3;

/** Miktarlı takipte (ör. 8 bardak su) oran q bu eşiğin altındaysa kısmi kaçırma sayılır (kural 6). */
export const KISMI_ESIK = 0.5;

/** Geç kayıt (kural 9): 4–14 gün önceki gün işaretlenebilir, kazanımın yalnızca yarısını verir. */
export const GEC_KAYIT_EN_ESKI = 14;
export const GEC_KAYIT_CARPANI = 0.5;

/** Silinen alışkanlık bu kadar gün çöp kutusunda kalır, sonra kalıcı silinir (kural 10). */
export const COP_GUN = 30;
