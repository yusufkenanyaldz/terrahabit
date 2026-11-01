// Alışkanlık mantığı: saf fonksiyonlar, DOM/Three.js yok. Testleri: NoralAliskanlik/tests
import { addDays } from './clock.js';

/** Bir alışkanlığın "otomatik" sayılması için gereken gün sayısı. */
export const GOAL_DAYS = 66;
/** Kayıt biçimi sürümü. Alan eklerken artır ve migrate() içine taşıma adımı yaz. */
export const SCHEMA_VERSION = 1;

/** Boş durum. */
export function emptyState() {
  return { version: SCHEMA_VERSION, habits: [] };
}

/**
 * Ham veriyi (kayıt ya da yedek dosyası) geçerli duruma çevirir.
 * Tanınmayan/bozuk veri için hata fırlatır; böylece bozuk yedek mevcut veriyi ezmez.
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
  // Sürüm 1: alanları doğrula ve eksikleri tamamla.
  const habits = data.habits
    .filter((h) => h && typeof h.id === 'string' && typeof h.name === 'string')
    .map((h) => ({
      id: h.id,
      name: h.name,
      icon: typeof h.icon === 'string' && h.icon ? h.icon : '⭐',
      time: /^\d{2}:\d{2}$/.test(h.time) ? h.time : '09:00',
      createdAt: isKey(h.createdAt) ? h.createdAt : (Array.isArray(h.done) && h.done.filter(isKey).sort()[0]) || '2000-01-01',
      done: [...new Set((Array.isArray(h.done) ? h.done : []).filter(isKey))].sort(),
      missAck: isKey(h.missAck) ? h.missAck : null,
      celebrated: !!h.celebrated,
    }));
  return { version: SCHEMA_VERSION, habits };
}

function isKey(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Yeni alışkanlık ekler. Yeni durumu döndürür. */
export function addHabit(state, { name, icon, time }, today, id) {
  const clean = String(name || '').trim();
  if (!clean) throw new Error('İsim boş olamaz');
  const habit = {
    id: id || `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: clean.slice(0, 40),
    icon: (icon || '⭐').trim() || '⭐',
    time: /^\d{2}:\d{2}$/.test(time) ? time : '09:00',
    createdAt: today,
    done: [],
    missAck: addDays(today, -1), // Eklendiği günden önceki günler "kaçırılmış" sayılmaz
    celebrated: false,
  };
  return { ...state, habits: [...state.habits, habit] };
}

/** Alışkanlığı siler. */
export function removeHabit(state, id) {
  return { ...state, habits: state.habits.filter((h) => h.id !== id) };
}

export function isDoneOn(habit, key) {
  return habit.done.includes(key);
}

/**
 * "Bugün yaptım". Günde yalnızca bir kez sayılır.
 * Dönüş: { state, changed, reachedGoal } — reachedGoal: tam bu tıklamayla 66'ya ulaşıldı.
 */
export function markDone(state, id, today) {
  const habit = state.habits.find((h) => h.id === id);
  if (!habit || isDoneOn(habit, today)) return { state, changed: false, reachedGoal: false };
  const done = [...habit.done, today].sort();
  const reachedGoal = done.length >= GOAL_DAYS && !habit.celebrated;
  const updated = { ...habit, done, celebrated: habit.celebrated || reachedGoal };
  return {
    state: { ...state, habits: state.habits.map((h) => (h.id === id ? updated : h)) },
    changed: true,
    reachedGoal,
  };
}

/** Tamamlanan gün sayısı (sayaç asla sıfırlanmaz). */
export function doneCount(habit) {
  return habit.done.length;
}

/** İlerleme 0..1 = tamamlanan gün / 66. */
export function progress(habit) {
  return Math.min(habit.done.length / GOAL_DAYS, 1);
}

/** Bu alışkanlık için, son onaydan (missAck) sonra dünden geriye kaçırılan günler. */
export function unseenMissedDays(habit, today) {
  const out = [];
  const start = habit.missAck && habit.missAck >= habit.createdAt ? addDays(habit.missAck, 1) : habit.createdAt;
  for (let d = start; d < today; d = addDays(d, 1)) {
    if (!isDoneOn(habit, d)) out.push(d);
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
 * Son 30 günün takvim noktaları (eskiden yeniye).
 * status: 'done' (yapıldı), 'missed' (kaçırıldı), 'today' (bugün, henüz yapılmadı),
 *         'none' (alışkanlık o gün yoktu).
 */
export function last30(habit, today) {
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const key = addDays(today, -i);
    let status;
    if (isDoneOn(habit, key)) status = 'done';
    else if (key === today) status = 'today';
    else if (key < habit.createdAt) status = 'none';
    else status = 'missed';
    days.push({ key, status, isToday: key === today });
  }
  return days;
}
