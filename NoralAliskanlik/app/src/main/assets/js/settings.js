// Ayar paneli değerleri: model döndürme, bölge konumları, model kaynağı.
// Saf modül (Three.js/DOM yok) — testleri NoralAliskanlik/tests altında.

/** Varsayılan değerler: "Sıfırla" ve yeni model yüklenince bunlara dönülür. */
export const VARSAYILAN_AYARLAR = Object.freeze({
  modelRot: Object.freeze({ x: 0, y: 0, z: 0 }),                // Model döndürme (derece)
  // Hazır beyin modeli (assets/brain.glb) için kullanıcının telefonda ayarladığı değerler
  prefrontal: Object.freeze({ x: 1.06, y: 0.24, z: 0.0 }),      // Prefrontal Korteks (Çaba)
  basalGanglia: Object.freeze({ x: -0.32, y: 0.18, z: 0.08 }),  // Bazal Gangliyon (Otomatik)
  modelYazar: '',                                               // Model kaynağı / yazar (CC BY)
  srbaiAcik: true,                                              // 14 günde bir otomatiklik anketi
  agGorunumu: false,                                            // Beyin: gerçekçi yerine düğüm ağı
  sonAcilis: null,                                              // Uzun yokluktan dönüş mesajı için
});

/** Varsayılanların değiştirilebilir bir kopyası. */
export function varsayilanAyarlar() {
  return JSON.parse(JSON.stringify(VARSAYILAN_AYARLAR));
}

/**
 * Kayıttan gelen ayarları doğrular; eksik/bozuk alanlar varsayılana döner.
 * Bozuk JSON da varsayılan ayarları verir (ayarlar kritik veri değildir).
 */
export function normalizeAyarlar(raw) {
  let data = raw;
  try {
    if (typeof raw === 'string') data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  const v = varsayilanAyarlar();
  if (!data || typeof data !== 'object') return v;
  const vec = (src, def) => {
    const o = { ...def };
    for (const k of ['x', 'y', 'z']) {
      const n = Number(src?.[k]);
      if (Number.isFinite(n)) o[k] = n;
    }
    return o;
  };
  return {
    modelRot: vec(data.modelRot, v.modelRot),
    prefrontal: vec(data.prefrontal, v.prefrontal),
    basalGanglia: vec(data.basalGanglia, v.basalGanglia),
    modelYazar: typeof data.modelYazar === 'string' && data.modelYazar !== '[yazar adı]'
      ? data.modelYazar.slice(0, 200) : '',
    srbaiAcik: data.srbaiAcik !== false,
    agGorunumu: data.agGorunumu === true,
    sonAcilis: typeof data.sonAcilis === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.sonAcilis) ? data.sonAcilis : null,
  };
}
