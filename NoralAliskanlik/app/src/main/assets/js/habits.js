// Alışkanlık mantığı: saf fonksiyonlar, DOM/Three.js yok. Testleri: NoralAliskanlik/tests
import { addDays } from './clock.js';
import { computeState, OTOMATIK, duraklatildiMi, planliMi } from './guc.js';
import {
  GERIYE_DONUK_GUN, ZORLUK_T, DURAKLATMA_EN_UZUN, SRBAI_ARALIK, SRBAI_BAKIM_ARALIK,
  GEC_KAYIT_EN_ESKI, COP_GUN, KISMI_ESIK,
} from './parametreler.js';
import { SIMGE_IDLER, emojidenSimge } from './simgeler.js';

/** Kayıt biçimi sürümü. Alan eklerken artır ve migrate() içine taşıma adımı yaz. */
export const SCHEMA_VERSION = 5;

/** Boş durum. */
export function emptyState() {
  return { version: SCHEMA_VERSION, habits: [], cop: [] };
}

// ---------------------------------------------------------------------------
// Doğrulama yardımcıları
// ---------------------------------------------------------------------------

function isKey(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

const ZORLUKLAR = Object.keys(ZORLUK_T);
const TIPLER = ['iyi', 'kotu'];

/** Zamanlama: her gün / haftanın belirli günleri (0 Paz … 6 Cmt) / haftada n kez */
export function temizZamanlama(z) {
  if (z && z.tur === 'gunler') {
    const gunler = [...new Set((Array.isArray(z.gunler) ? z.gunler : []).filter((g) => Number.isInteger(g) && g >= 0 && g <= 6))].sort();
    if (gunler.length > 0 && gunler.length < 7) return { tur: 'gunler', gunler };
  }
  if (z && z.tur === 'haftalik') {
    const hedef = Math.round(Number(z.hedef));
    if (hedef >= 1 && hedef <= 6) return { tur: 'haftalik', hedef };
  }
  return { tur: 'gunluk' };
}

function temizDuraklatmalar(liste) {
  return (Array.isArray(liste) ? liste : [])
    .filter((d) => d && isKey(d.bas) && (d.bit == null || (isKey(d.bit) && d.bit >= d.bas)))
    .map((d) => ({ bas: d.bas, bit: d.bit || null, soruldu: !!d.soruldu }))
    .sort((a, b) => (a.bas < b.bas ? -1 : 1));
}

/** Miktarlı takip: { hedef: >0 tam sayı (kötüde 0 olabilir: "hiç"), birim: kısa metin } ya da null */
export function temizMiktar(m, tip) {
  if (!m || typeof m !== 'object') return null;
  const hedef = Math.round(Number(m.hedef));
  const enAz = tip === 'kotu' ? 0 : 1;
  if (!Number.isFinite(hedef) || hedef < enAz || hedef > 999) return null;
  return { hedef, birim: typeof m.birim === 'string' ? m.birim.trim().slice(0, 16) : '' };
}

function temizGunMiktar(o) {
  const out = {};
  if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) {
      const n = Math.round(Number(v));
      if (isKey(k) && Number.isFinite(n) && n >= 0 && n <= 9999) out[k] = n;
    }
  }
  return out;
}

function temizSrbai(liste) {
  return (Array.isArray(liste) ? liste : [])
    .filter((o) => o && isKey(o.tarih) && Number.isFinite(o.S) && o.S >= 0 && o.S <= 1)
    .map((o) => ({ tarih: o.tarih, S: o.S, asama: Number.isInteger(o.asama) ? o.asama : 0 }))
    .sort((a, b) => (a.tarih < b.tarih ? -1 : 1));
}

/**
 * Ham veriyi (kayıt ya da yedek dosyası) geçerli duruma çevirir.
 * Tanınmayan/bozuk veri için hata fırlatır; böylece bozuk yedek mevcut veriyi ezmez.
 *
 * Sürüm geçişleri:
 *  v1 → v2: zorluk, tip, zamanlama, mazeret, duraklatmalar, arsiv, srbai alanları
 *           eklendi; eski alışkanlıklar "her gün, normal, iyi alışkanlık" olarak taşınır
 *           (bugünkü davranışla birebir aynı — hesap değişmez).
 *  v2 → v3: miktar (null), gunMiktar ({}), gecKayit ([]) alanları ve üst düzeyde
 *           çöp kutusu (cop: []) eklendi. Varsayılanlarla hesap değişmez.
 *  v3 → v4: ikon (çizgi simge kimliği) eklendi. Eski kayıtlardaki emoji simgesi
 *           karşılığına çevrilir (📚 → kitap), karşılığı yoksa 'genel' olur. Hesap değişmez.
 *  v4 → v5: sınırsız kötü alışkanlığa 0 sınırı verilir (miktar = { hedef: 0 }).
 *           Önceden sınırsız kötü alışkanlıkta kayıt olmayan gün KAYMA sayılıyordu, yani
 *           her temiz günü elle işaretlemek gerekiyordu; sınırlı olanda ise kayıt olmayan
 *           gün temiz sayılıyordu. Aynı niyetin iki kurulumu zıt davranıyordu. Artık ikisi
 *           de aynı: kayıt yok = temiz, kayma "+1" ile işaretlenir. Taşınan kayıtlarda
 *           işaretli temiz günler zaten temiz sayıldığı için güç yükselir (kayıp yok).
 */
export function migrate(raw) {
  if (raw == null || raw === '') return emptyState();
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!data || typeof data !== 'object' || !Array.isArray(data.habits)) {
    throw new Error('Geçersiz veri biçimi');
  }
  if ((data.version ?? 1) > SCHEMA_VERSION) {
    throw new Error('Bu yedek uygulamanın daha yeni bir sürümünden');
  }
  const habits = data.habits
    .filter((h) => h && typeof h.id === 'string' && typeof h.name === 'string')
    .map(habitTemizle);
  const cop = (Array.isArray(data.cop) ? data.cop : [])
    .filter((c) => c && isKey(c.silinme) && c.habit && typeof c.habit.id === 'string' && typeof c.habit.name === 'string')
    .map((c) => ({ silinme: c.silinme, habit: habitTemizle(c.habit) }));
  return { version: SCHEMA_VERSION, habits, cop };
}

function habitTemizle(h) {
  const tip = TIPLER.includes(h.tip) ? h.tip : 'iyi';
  return {
    // v1 alanları
    id: h.id,
    name: h.name,
    icon: typeof h.icon === 'string' ? h.icon : '', // Eski emoji alanı; yedek uyumu için duruyor
    time: /^\d{2}:\d{2}$/.test(h.time) ? h.time : '09:00',
    createdAt: isKey(h.createdAt) ? h.createdAt : (Array.isArray(h.done) && h.done.filter(isKey).sort()[0]) || '2000-01-01',
    done: [...new Set((Array.isArray(h.done) ? h.done : []).filter(isKey))].sort(),
    missAck: isKey(h.missAck) ? h.missAck : null,
    celebrated: !!h.celebrated,
    // v2 alanları (eksikse varsayılan)
    zorluk: ZORLUKLAR.includes(h.zorluk) ? h.zorluk : 'normal',
    tip,
    zamanlama: temizZamanlama(h.zamanlama),
    mazeret: [...new Set((Array.isArray(h.mazeret) ? h.mazeret : []).filter(isKey))].sort(),
    duraklatmalar: temizDuraklatmalar(h.duraklatmalar),
    arsiv: !!h.arsiv,
    srbai: temizSrbai(h.srbai),
    bakim: !!h.bakim, // Türetilmiş; bildirim tarafı (Kotlin) okur
    guc: Number.isInteger(h.guc) ? h.guc : 0,       // Türetilmiş; widget okur
    asama: Number.isInteger(h.asama) ? h.asama : 0, // Türetilmiş; widget okur
    // v3 alanları (v5: kötü alışkanlıkta sınır yoksa 0)
    miktar: kotuSinirDuzelt(temizMiktar(h.miktar, tip), tip, temizZamanlama(h.zamanlama)),
    gunMiktar: temizGunMiktar(h.gunMiktar),
    gecKayit: [...new Set((Array.isArray(h.gecKayit) ? h.gecKayit : []).filter(isKey))].sort(),
    // v4 alanı: çizgi simge. Eski kayıtta yoksa emojisinden türetilir.
    ikon: SIMGE_IDLER.includes(h.ikon) ? h.ikon : emojidenSimge(h.icon),
  };
}

// ---------------------------------------------------------------------------
// Ekleme / düzenleme / silme / arşiv
// ---------------------------------------------------------------------------

function ayarlariTemizle({ zorluk, tip, zamanlama, miktar }, eski = {}) {
  const t = TIPLER.includes(tip) ? tip : (eski.tip || 'iyi');
  const z = zamanlama ? temizZamanlama(zamanlama) : (eski.zamanlama || { tur: 'gunluk' });
  return {
    zorluk: ZORLUKLAR.includes(zorluk) ? zorluk : (eski.zorluk || 'normal'),
    tip: t,
    zamanlama: z,
    // miktar: undefined → eskisi korunur; null → miktarsız
    miktar: kotuSinirDuzelt(miktar === undefined ? (eski.miktar ?? null) : temizMiktar(miktar, t), t, z),
  };
}

/**
 * Kötü alışkanlıkta sınır her zaman vardır: belirtilmemişse 0 ("hiç").
 * Böylece kayıt olmayan gün temiz sayılır ve kullanıcı yalnız kaymayı işaretler;
 * sınırlı/sınırsız ayrımı ortadan kalkar (v5).
 */
function kotuSinirDuzelt(miktar, tip, zamanlama) {
  if (tip !== 'kotu' || miktar) return miktar;
  if (zamanlama && zamanlama.tur === 'haftalik') return miktar; // haftalıkta miktar kullanılmaz
  return { hedef: 0, birim: '' };
}

/** Yeni alışkanlık ekler. Yeni durumu döndürür. */
export function addHabit(state, { name, icon, ikon, time, zorluk, tip, zamanlama, miktar }, today, id) {
  const clean = String(name || '').trim();
  if (!clean) throw new Error('İsim boş olamaz');
  const habit = {
    id: id || `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: clean.slice(0, 40),
    icon: (icon || '').trim(), // Eski emoji alanı (artık kullanılmıyor)
    ikon: SIMGE_IDLER.includes(ikon) ? ikon : 'genel',
    time: /^\d{2}:\d{2}$/.test(time) ? time : '09:00',
    createdAt: today,
    done: [],
    missAck: addDays(today, -1), // Eklendiği günden önceki günler "kaçırılmış" sayılmaz
    celebrated: false,
    ...ayarlariTemizle({ zorluk, tip, zamanlama, miktar: miktar ?? null }),
    mazeret: [],
    duraklatmalar: [],
    arsiv: false,
    srbai: [],
    bakim: false,
    guc: 0,
    asama: 0,
    gunMiktar: {},
    gecKayit: [],
  };
  return { ...state, habits: [...state.habits, habit] };
}

/**
 * Alışkanlığın ismini, saatini, zorluğunu, türünü veya sıklığını değiştirir.
 * Tamamlanan günler korunur; güç yeni ayarlarla geçmişten yeniden hesaplanır.
 */
export function updateHabit(state, id, { name, icon, ikon, time, zorluk, tip, zamanlama, miktar }) {
  const clean = String(name || '').trim();
  if (!clean) throw new Error('İsim boş olamaz');
  return {
    ...state,
    habits: state.habits.map((h) => (h.id !== id ? h : {
      ...h,
      name: clean.slice(0, 40),
      icon: (icon || '').trim() || h.icon,
      ikon: SIMGE_IDLER.includes(ikon) ? ikon : (h.ikon || 'genel'),
      time: /^\d{2}:\d{2}$/.test(time) ? time : h.time,
      ...ayarlariTemizle({ zorluk, tip, zamanlama, miktar }, h),
    })),
  };
}

/**
 * Alışkanlığı siler: önce 30 günlük çöp kutusuna gider, oradan geri getirilebilir (kural 10).
 */
export function removeHabit(state, id, today) {
  const h = state.habits.find((x) => x.id === id);
  if (!h) return state;
  return {
    ...state,
    habits: state.habits.filter((x) => x.id !== id),
    cop: [...(state.cop || []).filter((c) => c.habit.id !== id), { silinme: today, habit: h }],
  };
}

/** Çöp kutusundan geri getir (geçmiş, iz ve taban aynen). */
export function restoreHabit(state, id) {
  const c = (state.cop || []).find((x) => x.habit.id === id);
  if (!c) return state;
  return { ...state, habits: [...state.habits, c.habit], cop: state.cop.filter((x) => x !== c) };
}

/** Çöp kutusundan hemen ve kalıcı olarak sil. */
export function deleteForever(state, id) {
  return { ...state, cop: (state.cop || []).filter((x) => x.habit.id !== id) };
}

/** 30 günü dolan çöp kutusu kayıtlarını kalıcı olarak sil. Değişiklik yoksa aynı state. */
export function purgeTrash(state, today) {
  const cop = state.cop || [];
  const kalan = cop.filter((c) => addDays(c.silinme, COP_GUN) > today);
  return kalan.length === cop.length ? state : { ...state, cop: kalan };
}

/**
 * Arşivle / geri aç (kural 10). Geçmiş, iz (P) ve taban korunur. Arşivdeki süre
 * kaçırma olarak işlenir; geri açıldığında güç gerçekçi biçimde düşmüş olur.
 */
export function setArchived(state, id, arsiv) {
  return { ...state, habits: state.habits.map((h) => (h.id === id ? { ...h, arsiv: !!arsiv } : h)) };
}

function guncelle(state, id, f) {
  return { ...state, habits: state.habits.map((h) => (h.id === id ? f(h) : h)) };
}

// ---------------------------------------------------------------------------
// Günlük kayıt: yapıldı / mazeret / boş
// ---------------------------------------------------------------------------

export function isDoneOn(habit, key) {
  return habit.done.includes(key);
}

export function isExcused(habit, key) {
  return (habit.mazeret || []).includes(key);
}

/**
 * "Bugün yaptım". Günde yalnızca bir kez sayılır.
 * Dönüş: { state, changed, reachedGoal } — reachedGoal: bu işaretle ilk kez Otomatik aşamasına ulaşıldı.
 */
export function markDone(state, id, today) {
  const habit = state.habits.find((h) => h.id === id);
  if (!habit || isDoneOn(habit, today)) return { state, changed: false, reachedGoal: false };
  return setDayStatus(state, id, today, 'done', today);
}

/** Tarih aralığı içinde mi: bugün ve geriye dönük serbest düzenleme penceresi (son 3 gün). */
export function isEditable(habit, key, today) {
  return key <= today && key >= addDays(today, -GERIYE_DONUK_GUN) && key >= habit.createdAt;
}

/** Geç kayıt penceresi: 4–14 gün önce. İşaretlenebilir ama kazanımın yarısını verir (kural 9). */
export function isLateEditable(habit, key, today) {
  return key < addDays(today, -GERIYE_DONUK_GUN) && key >= addDays(today, -GEC_KAYIT_EN_ESKI)
    && key >= habit.createdAt;
}

/**
 * Geriye dönük kayıt (kural 9): bugün ve son 3 gün işaretlenebilir ya da işareti
 * kaldırılabilir. Daha eski günlere dokunulmaz.
 */
export function toggleDay(state, id, key, today) {
  const habit = state.habits.find((h) => h.id === id);
  if (!habit) return { state, changed: false, reachedGoal: false };
  return setDayStatus(state, id, key, isDoneOn(habit, key) ? 'bos' : 'done', today);
}

/**
 * Günün durumunu ayarla: 'done' (yapıldı), 'mazeret' (hastalık vb., kural 3), 'bos'.
 * Mazeret yalnızca geçmiş 3 gün içinde ve bugün için işaretlenebilir.
 */
export function setDayStatus(state, id, key, durum, today) {
  const habit = state.habits.find((h) => h.id === id);
  if (!habit) return { state, changed: false, reachedGoal: false };
  const gecPencere = isLateEditable(habit, key, today);
  // Geç kayıt penceresinde yalnızca yapıldı / boş (mazeret son 3 günle sınırlı)
  if (!isEditable(habit, key, today) && !(gecPencere && durum !== 'mazeret')) {
    return { state, changed: false, reachedGoal: false };
  }
  const done = habit.done.filter((d) => d !== key);
  const mazeret = (habit.mazeret || []).filter((d) => d !== key);
  const gecKayit = (habit.gecKayit || []).filter((d) => d !== key);
  const gunMiktar = { ...(habit.gunMiktar || {}) };
  delete gunMiktar[key];
  if (durum === 'done') {
    done.push(key);
    if (gecPencere) gecKayit.push(key);
    if (habit.miktar && habit.tip !== 'kotu') gunMiktar[key] = habit.miktar.hedef;
  }
  if (durum === 'mazeret') mazeret.push(key);
  done.sort();
  mazeret.sort();
  gecKayit.sort();
  return sonucuYaz(state, habit, { ...habit, done, mazeret, gecKayit, gunMiktar }, today);
}

/**
 * Miktarlı takip (kural 6): günün miktarını ayarla (son 3 gün + bugün).
 * İyi alışkanlıkta oran q ≥ 0,5 ise gün "yapıldı" sayılır; kötüde sınırın altı "temiz".
 */
export function setAmount(state, id, key, miktar, today) {
  const habit = state.habits.find((h) => h.id === id);
  if (!habit || !habit.miktar || !isEditable(habit, key, today)) return { state, changed: false, reachedGoal: false };
  const m = Math.max(0, Math.min(9999, Math.round(miktar)));
  const gunMiktar = { ...(habit.gunMiktar || {}), [key]: m };
  const basari = habit.tip === 'kotu' ? m <= habit.miktar.hedef : m >= habit.miktar.hedef * KISMI_ESIK;
  const done = habit.done.filter((d) => d !== key);
  if (basari) done.push(key);
  done.sort();
  const mazeret = (habit.mazeret || []).filter((d) => d !== key);
  return sonucuYaz(state, habit, { ...habit, gunMiktar, done, mazeret }, today);
}

/** Günün kayıtlı miktarı (yoksa kötü alışkanlıkta 0, iyide null) */
export function amountOn(habit, key) {
  const m = (habit.gunMiktar || {})[key];
  if (m != null) return m;
  return habit.tip === 'kotu' ? 0 : null;
}

function sonucuYaz(state, habit, yeni, today) {
  const reachedGoal = !habit.celebrated && computeState(yeni, today).asama === OTOMATIK;
  const updated = { ...yeni, celebrated: habit.celebrated || reachedGoal };
  return {
    state: { ...state, habits: state.habits.map((h) => (h.id === habit.id ? updated : h)) },
    changed: true,
    reachedGoal,
  };
}

/** Günün mevcut durumu: 'done' | 'mazeret' | 'bos' */
export function dayStatus(habit, key) {
  if (isDoneOn(habit, key)) return 'done';
  if (isExcused(habit, key)) return 'mazeret';
  return 'bos';
}

/** Toplam tamamlama sayısı (asla düşmez; motivasyon için gösterilir). */
export function doneCount(habit) {
  return habit.done.length;
}

// ---------------------------------------------------------------------------
// Duraklatma (tatil / seyahat, kural 4)
// ---------------------------------------------------------------------------

/** Şu an açık olan duraklatma (yoksa null). */
export function activePause(habit, today) {
  return (habit.duraklatmalar || []).find((d) => {
    const bit = d.bit || addDays(d.bas, DURAKLATMA_EN_UZUN - 1);
    return today >= d.bas && today <= bit;
  }) || null;
}

/** İleriye dönük duraklat: bugünden itibaren en fazla 30 gün. */
export function startPause(state, id, today) {
  return guncelle(state, id, (h) => (activePause(h, today) ? h : {
    ...h,
    duraklatmalar: [...(h.duraklatmalar || []), { bas: today, bit: null, soruldu: false }],
  }));
}

/** Duraklatmayı bitir: bugünden itibaren normal hesap. Bugün başladıysa tamamen kaldırılır. */
export function endPause(state, id, today) {
  return guncelle(state, id, (h) => {
    const acik = activePause(h, today);
    if (!acik) return h;
    const liste = (h.duraklatmalar || [])
      .filter((d) => !(d === acik && d.bas === today))
      .map((d) => (d === acik ? { ...d, bit: addDays(today, -1), soruldu: true } : d));
    return { ...h, duraklatmalar: liste };
  });
}

/** Süresi dolmuş (30 gün) ve kullanıcıya henüz sorulmamış duraklatma (uzat / arşivle / devam). */
export function expiredPause(habit, today) {
  return (habit.duraklatmalar || []).find((d) => !d.bit && !d.soruldu
    && addDays(d.bas, DURAKLATMA_EN_UZUN - 1) < today) || null;
}

/** Süresi dolan duraklatma soruldu olarak işaretlenir; istenirse bugünden yeni duraklatma başlar. */
export function answerExpiredPause(state, id, today, uzat) {
  let s = guncelle(state, id, (h) => ({
    ...h,
    duraklatmalar: (h.duraklatmalar || []).map((d) => (!d.bit && !d.soruldu && addDays(d.bas, DURAKLATMA_EN_UZUN - 1) < today
      ? { ...d, bit: addDays(d.bas, DURAKLATMA_EN_UZUN - 1), soruldu: true } : d)),
  }));
  if (uzat) s = startPause(s, id, today);
  return s;
}

// ---------------------------------------------------------------------------
// SRBAI otomatiklik anketi (§3.6)
// ---------------------------------------------------------------------------

/** 4 maddelik SRBAI (1–7) → S = (ortalama − 1) / 6 */
export function srbaiPuani(cevaplar) {
  const ort = cevaplar.reduce((a, b) => a + b, 0) / cevaplar.length;
  return Math.max(0, Math.min(1, (ort - 1) / 6));
}

export function addSrbai(state, id, today, cevaplar, asama) {
  const S = srbaiPuani(cevaplar);
  return guncelle(state, id, (h) => ({
    ...h,
    srbai: [...(h.srbai || []).filter((o) => o.tarih !== today), { tarih: today, S, asama }]
      .sort((a, b) => (a.tarih < b.tarih ? -1 : 1)),
  }));
}

/**
 * Anket zamanı geldi mi? 14 günde bir (bakım modunda 30), ve her aşama yükselişinde.
 * İlk anket alışkanlık 14 günlük olunca. Duraklatılmış ya da arşivdeki alışkanlıkta sorulmaz.
 */
export function srbaiDue(habit, durum, today) {
  if (habit.arsiv || durum.bugunDuraklatildi) return false;
  const liste = habit.srbai || [];
  const son = liste[liste.length - 1];
  if (!son) return addDays(habit.createdAt, SRBAI_ARALIK) <= today;
  if (son.tarih === today) return false;
  if (durum.asama > son.asama) return true;
  const aralik = durum.bakim ? SRBAI_BAKIM_ARALIK : SRBAI_ARALIK;
  return addDays(son.tarih, aralik) <= today;
}

// ---------------------------------------------------------------------------
// Kutlama ve kaçırma animasyonu
// ---------------------------------------------------------------------------

/**
 * Otomatik aşamasına ulaşmış ama kutlaması gösterilmemiş alışkanlıklar
 * (ör. bildirimdeki "Yaptım" ile, uygulama kapalıyken tamamlananlar).
 */
export function pendingCelebrations(state, today) {
  return state.habits.filter((h) => !h.arsiv && !h.celebrated && computeState(h, today).asama === OTOMATIK);
}

/** Kutlama gösterildi olarak işaretle. */
export function markCelebrated(state, id) {
  return guncelle(state, id, (h) => ({ ...h, celebrated: true }));
}

/**
 * Son onaydan (missAck) sonra dünden geriye gerçekten kaçırılan günler:
 * planlı, duraklatılmamış, mazeretsiz ve yapılmamış. (Haftalık hedefte gün bazlı kaçırma yok.)
 */
export function unseenMissedDays(habit, today) {
  if (habit.arsiv || (habit.zamanlama && habit.zamanlama.tur === 'haftalik')) return [];
  const out = [];
  const ilk = addDays(habit.createdAt, 1); // Eklendiği gün serbest (guc.js ile aynı kural)
  const kayitli = habit.missAck && habit.missAck >= habit.createdAt ? addDays(habit.missAck, 1) : habit.createdAt;
  const start = kayitli > ilk ? kayitli : ilk;
  for (let d = start; d < today; d = addDays(d, 1)) {
    if (!isDoneOn(habit, d) && planliMi(habit, d) && !duraklatildiMi(habit, d) && !isExcused(habit, d)) out.push(d);
  }
  return out;
}

/** Kaçırılan gün animasyonu oynatılmalı mı? (Her kaçırılan dönem için bir kez.) */
export function needsMissFlash(habit, today) {
  return unseenMissedDays(habit, today).length > 0;
}

/** Kaçırılan günler görüldü: dün dahil hepsini onayla, animasyon tekrar oynamasın. */
export function ackMisses(state, today) {
  const y = addDays(today, -1);
  return {
    ...state,
    habits: state.habits.map((h) => (h.missAck && h.missAck >= y ? h : { ...h, missAck: y })),
  };
}

/**
 * Türetilmiş alanları kayda yazar: bakım modu (bildirimler, kural 12), güç ve aşama
 * (ana ekran widget'ı).
 * Değişen yoksa aynı state döner (gereksiz kayıt olmasın).
 */
export function syncDerived(state, today) {
  let degisti = false;
  const habits = state.habits.map((h) => {
    const d = computeState(h, today);
    // guc (0–100) ve asama: ana ekran widget'ı (Kotlin) bu önbellekten gösterir
    const guc = Math.round(d.H * 100);
    const w = widgetOnbellegi(h, today);
    const ayni = d.bakim === !!h.bakim && guc === h.guc && d.asama === h.asama
      && h.widget && h.widget.bugun === w.bugun && h.widget.H0 === w.H0 && h.widget.a === w.a && h.widget.asama0 === w.asama0;
    if (ayni) return h;
    degisti = true;
    return { ...h, bakim: d.bakim, guc, asama: d.asama, widget: w };
  });
  return degisti ? { ...state, habits } : state;
}

/**
 * Widget, bugünün işaretini uygulamayı açmadan değiştirebilir (✓ / +1). Gücü doğru göstermek
 * için hesabın son adımını kendisi yapar: H = H0 + a · q · (1 − H0)
 *   H0: bugünün katkısı hariç güç, a: bugün tam yapılırsa etkin kazanım katsayısı
 *       (zorluk, geri dönüş hızı ve haftalık hedef dahil), q: bugünkü oran (0..1).
 * Hesabın kendisi yine tek yerde (guc.js) kalır.
 */
export function widgetOnbellegi(h, today) {
  const gunMiktar = { ...(h.gunMiktar || {}) };
  delete gunMiktar[today];
  const bugunsuz = { ...h, done: h.done.filter((g) => g !== today), gunMiktar };
  const once = computeState(bugunsuz, today);
  const tamGun = { ...bugunsuz, done: [...bugunsuz.done, today].sort() };
  if (h.miktar) tamGun.gunMiktar = { ...gunMiktar, [today]: h.tip === 'kotu' ? 0 : h.miktar.hedef };
  const tam = computeState(tamGun, today);
  const a = once.H < 1 ? Math.max(0, (tam.H - once.H) / (1 - once.H)) : 0;
  // Karşılaştırma kararlı olsun diye yuvarlanır (önbellek gereksiz yere değişmesin)
  const yuvarla = (x) => Math.round(x * 1e6) / 1e6;
  return { bugun: today, H0: yuvarla(once.H), a: yuvarla(a), asama0: once.asama };
}

/**
 * Son 30 günün takvim noktaları (eskiden yeniye).
 * status: 'done' yapıldı, 'missed' kaçırıldı, 'today' bugün (henüz yapılmadı),
 *         'none' alışkanlık o gün yoktu, 'mazeret', 'duraklatma', 'plansiz' (planlı gün değil),
 *         'kismi' (miktarlı takipte hedefin yarısından az), 'kayma' (kötü alışkanlıkta sınır aşıldı)
 * gec: geç kayıtla işaretlenmiş gün (kazanımın yarısı)
 */
export function last30(habit, today) {
  const days = [];
  const haftalik = habit.zamanlama && habit.zamanlama.tur === 'haftalik';
  for (let i = 29; i >= 0; i--) {
    const key = addDays(today, -i);
    let status;
    const m = habit.miktar ? (habit.gunMiktar || {})[key] : undefined;
    if (habit.miktar && habit.tip === 'kotu' && m != null && m > habit.miktar.hedef) status = 'kayma';
    else if (habit.miktar && habit.tip === 'kotu' && key >= habit.createdAt && key < today
      && !duraklatildiMi(habit, key) && planliMi(habit, key) && m == null) status = 'done'; // Kayıt yok = temiz
    else if (isDoneOn(habit, key)) status = 'done';
    else if (habit.miktar && m != null && m > 0 && habit.tip !== 'kotu') status = 'kismi';
    else if (key < habit.createdAt) status = 'none';
    else if (duraklatildiMi(habit, key)) status = 'duraklatma';
    else if (isExcused(habit, key)) status = 'mazeret';
    else if (key === today) status = 'today';
    else if (haftalik || !planliMi(habit, key)) status = 'plansiz';
    else if (key === habit.createdAt) status = 'plansiz'; // Eklendiği gün serbest
    else status = 'missed';
    days.push({
      key, status, isToday: key === today,
      gec: (habit.gecKayit || []).includes(key),
      duzenlenebilir: isEditable(habit, key, today),
    });
  }
  return days;
}
