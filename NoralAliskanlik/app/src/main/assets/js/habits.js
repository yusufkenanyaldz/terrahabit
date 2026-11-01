// Alışkanlık mantığı: saf fonksiyonlar, DOM/Three.js yok. Testleri: NoralAliskanlik/tests
import { addDays } from './clock.js';
import { computeState, OTOMATIK, duraklatildiMi, planliMi } from './guc.js';
import {
  GERIYE_DONUK_GUN, ZORLUK_T, DURAKLATMA_EN_UZUN, SRBAI_ARALIK, SRBAI_BAKIM_ARALIK,
} from './parametreler.js';

/** Kayıt biçimi sürümü. Alan eklerken artır ve migrate() içine taşıma adımı yaz. */
export const SCHEMA_VERSION = 2;

/** Boş durum. */
export function emptyState() {
  return { version: SCHEMA_VERSION, habits: [] };
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
    .map((h) => ({
      // v1 alanları
      id: h.id,
      name: h.name,
      icon: typeof h.icon === 'string' ? h.icon : '', // Artık gösterilmiyor; eski kayıtlarla uyum için duruyor
      time: /^\d{2}:\d{2}$/.test(h.time) ? h.time : '09:00',
      createdAt: isKey(h.createdAt) ? h.createdAt : (Array.isArray(h.done) && h.done.filter(isKey).sort()[0]) || '2000-01-01',
      done: [...new Set((Array.isArray(h.done) ? h.done : []).filter(isKey))].sort(),
      missAck: isKey(h.missAck) ? h.missAck : null,
      celebrated: !!h.celebrated,
      // v2 alanları (eksikse varsayılan)
      zorluk: ZORLUKLAR.includes(h.zorluk) ? h.zorluk : 'normal',
      tip: TIPLER.includes(h.tip) ? h.tip : 'iyi',
      zamanlama: temizZamanlama(h.zamanlama),
      mazeret: [...new Set((Array.isArray(h.mazeret) ? h.mazeret : []).filter(isKey))].sort(),
      duraklatmalar: temizDuraklatmalar(h.duraklatmalar),
      arsiv: !!h.arsiv,
      srbai: temizSrbai(h.srbai),
      bakim: !!h.bakim, // Türetilmiş; bildirim tarafı (Kotlin) okur
    }));
  return { version: SCHEMA_VERSION, habits };
}

// ---------------------------------------------------------------------------
// Ekleme / düzenleme / silme / arşiv
// ---------------------------------------------------------------------------

function ayarlariTemizle({ zorluk, tip, zamanlama }, eski = {}) {
  return {
    zorluk: ZORLUKLAR.includes(zorluk) ? zorluk : (eski.zorluk || 'normal'),
    tip: TIPLER.includes(tip) ? tip : (eski.tip || 'iyi'),
    zamanlama: zamanlama ? temizZamanlama(zamanlama) : (eski.zamanlama || { tur: 'gunluk' }),
  };
}

/** Yeni alışkanlık ekler. Yeni durumu döndürür. */
export function addHabit(state, { name, icon, time, zorluk, tip, zamanlama }, today, id) {
  const clean = String(name || '').trim();
  if (!clean) throw new Error('İsim boş olamaz');
  const habit = {
    id: id || `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: clean.slice(0, 40),
    icon: (icon || '').trim(), // Arayüzde ikon yok (emoji kullanılmıyor)
    time: /^\d{2}:\d{2}$/.test(time) ? time : '09:00',
    createdAt: today,
    done: [],
    missAck: addDays(today, -1), // Eklendiği günden önceki günler "kaçırılmış" sayılmaz
    celebrated: false,
    ...ayarlariTemizle({ zorluk, tip, zamanlama }),
    mazeret: [],
    duraklatmalar: [],
    arsiv: false,
    srbai: [],
    bakim: false,
  };
  return { ...state, habits: [...state.habits, habit] };
}

/**
 * Alışkanlığın ismini, saatini, zorluğunu, türünü veya sıklığını değiştirir.
 * Tamamlanan günler korunur; güç yeni ayarlarla geçmişten yeniden hesaplanır.
 */
export function updateHabit(state, id, { name, icon, time, zorluk, tip, zamanlama }) {
  const clean = String(name || '').trim();
  if (!clean) throw new Error('İsim boş olamaz');
  return {
    ...state,
    habits: state.habits.map((h) => (h.id !== id ? h : {
      ...h,
      name: clean.slice(0, 40),
      icon: (icon || '').trim() || h.icon,
      time: /^\d{2}:\d{2}$/.test(time) ? time : h.time,
      ...ayarlariTemizle({ zorluk, tip, zamanlama }, h),
    })),
  };
}

/** Alışkanlığı kalıcı olarak siler. */
export function removeHabit(state, id) {
  return { ...state, habits: state.habits.filter((h) => h.id !== id) };
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

/** Tarih aralığı içinde mi: bugün ve geriye dönük serbest düzenleme penceresi. */
export function isEditable(habit, key, today) {
  return key <= today && key >= addDays(today, -GERIYE_DONUK_GUN) && key >= habit.createdAt;
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
  if (!habit || !isEditable(habit, key, today)) return { state, changed: false, reachedGoal: false };
  const done = habit.done.filter((d) => d !== key);
  const mazeret = (habit.mazeret || []).filter((d) => d !== key);
  if (durum === 'done') done.push(key);
  if (durum === 'mazeret') mazeret.push(key);
  done.sort();
  mazeret.sort();
  const yeni = { ...habit, done, mazeret };
  const reachedGoal = !habit.celebrated && computeState(yeni, today).asama === OTOMATIK;
  const updated = { ...yeni, celebrated: habit.celebrated || reachedGoal };
  return {
    state: { ...state, habits: state.habits.map((h) => (h.id === id ? updated : h)) },
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
  const start = habit.missAck && habit.missAck >= habit.createdAt ? addDays(habit.missAck, 1) : habit.createdAt;
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
 * Türetilmiş "bakım modu" bayrağını kayda yazar (bildirim tarafı okur; kural 12).
 * Değişen yoksa aynı state döner (gereksiz kayıt olmasın).
 */
export function syncDerived(state, today) {
  let degisti = false;
  const habits = state.habits.map((h) => {
    const bakim = computeState(h, today).bakim;
    if (bakim === !!h.bakim) return h;
    degisti = true;
    return { ...h, bakim };
  });
  return degisti ? { ...state, habits } : state;
}

/**
 * Son 30 günün takvim noktaları (eskiden yeniye).
 * status: 'done' yapıldı, 'missed' kaçırıldı, 'today' bugün (henüz yapılmadı),
 *         'none' alışkanlık o gün yoktu, 'mazeret', 'duraklatma', 'plansiz' (planlı gün değil)
 */
export function last30(habit, today) {
  const days = [];
  const haftalik = habit.zamanlama && habit.zamanlama.tur === 'haftalik';
  for (let i = 29; i >= 0; i--) {
    const key = addDays(today, -i);
    let status;
    if (isDoneOn(habit, key)) status = 'done';
    else if (key < habit.createdAt) status = 'none';
    else if (duraklatildiMi(habit, key)) status = 'duraklatma';
    else if (isExcused(habit, key)) status = 'mazeret';
    else if (key === today) status = 'today';
    else if (haftalik || !planliMi(habit, key)) status = 'plansiz';
    else status = 'missed';
    days.push({ key, status, isToday: key === today, duzenlenebilir: isEditable(habit, key, today) });
  }
  return days;
}
