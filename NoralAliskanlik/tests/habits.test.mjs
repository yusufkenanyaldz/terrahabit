// Alışkanlık mantığı testleri. Çalıştırma (repo kökünde): node --test NoralAliskanlik/tests
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, addHabit, removeHabit, markDone, doneCount,
  needsMissFlash, ackMisses, last30, migrate,
  updateHabit, pendingCelebrations, markCelebrated,
} from '../app/src/main/assets/js/habits.js';
import { addDays, setNow, todayKey } from '../app/src/main/assets/js/clock.js';
import { computeState } from '../app/src/main/assets/js/guc.js';
const GOAL_DAYS = 66; // Kusursuz takipte Otomatik'e ulaşılan gün

const D0 = '2026-03-01';
const make = () => addHabit(emptyState(), { name: 'Kitap', icon: '📚', time: '08:30' }, D0, 'h1');

test('alışkanlık eklenir ve silinir', () => {
  let s = make();
  assert.equal(s.habits.length, 1);
  assert.equal(s.habits[0].icon, '📚');
  assert.equal(s.habits[0].time, '08:30');
  s = removeHabit(s, 'h1');
  assert.equal(s.habits.length, 0);
});

test('boş isim reddedilir', () => {
  assert.throws(() => addHabit(emptyState(), { name: '  ' }, D0));
});

test('"Bugün yaptım" günde yalnızca bir kez sayılır', () => {
  let s = make();
  const r1 = markDone(s, 'h1', D0);
  assert.equal(r1.changed, true);
  const r2 = markDone(r1.state, 'h1', D0);
  assert.equal(r2.changed, false);
  assert.equal(doneCount(r2.state.habits[0]), 1);
});

test('kaçırılan gün toplam sayacı sıfırlamaz, güç yalnızca biraz düşer', () => {
  let s = make();
  s = markDone(s, 'h1', D0).state;
  // 1 gün kaçır, sonra devam et
  s = markDone(s, 'h1', addDays(D0, 2)).state;
  assert.equal(doneCount(s.habits[0]), 2);
  const g = computeState(s.habits[0], addDays(D0, 2));
  assert.equal(g.toplamTekrar, 2);
  assert.ok(g.H > 0.08 && g.H < 0.09, `H=${g.H}`); // 2 kazanım + 1 küçük çözülme
});

test('kaçırılan gün animasyonu bir kez oynar', () => {
  let s = make();
  s = markDone(s, 'h1', D0).state;
  const t = addDays(D0, 1);
  assert.equal(needsMissFlash(s.habits[0], t), false, 'dün yapıldıysa animasyon yok');
  const t2 = addDays(D0, 2); // D0+1 kaçırıldı
  assert.equal(needsMissFlash(s.habits[0], t2), true);
  s = ackMisses(s, t2);
  assert.equal(needsMissFlash(s.habits[0], t2), false, 'ikinci kez oynamaz');
  assert.equal(needsMissFlash(s.habits[0], addDays(t2, 1)), true, 'yeni kaçırılan gün yine oynar');
});

test('eklendiği gün kaçırılmış sayılmaz', () => {
  const s = make();
  assert.equal(needsMissFlash(s.habits[0], D0), false);
});

test('66. günde bir kez kutlama', () => {
  let s = make();
  let reached = 0;
  for (let i = 0; i < GOAL_DAYS + 3; i++) {
    const r = markDone(s, 'h1', addDays(D0, i));
    if (r.reachedGoal) reached++;
    if (i === GOAL_DAYS - 1) assert.equal(r.reachedGoal, true);
    s = r.state;
  }
  assert.equal(reached, 1);
  assert.ok(computeState(s.habits[0], addDays(D0, GOAL_DAYS + 2)).H > 0.95);
});

test('son 30 gün takvimi', () => {
  let s = make();
  const today = addDays(D0, 5);
  s = markDone(s, 'h1', D0).state;
  s = markDone(s, 'h1', addDays(D0, 3)).state;
  const days = last30(s.habits[0], today);
  assert.equal(days.length, 30);
  assert.equal(days.at(-1).status, 'today');
  assert.equal(days.at(-1).key, today);
  assert.equal(days.find((d) => d.key === D0).status, 'done');
  assert.equal(days.find((d) => d.key === addDays(D0, 1)).status, 'missed');
  assert.equal(days.find((d) => d.key === addDays(D0, -1)).status, 'none');
  s = markDone(s, 'h1', today).state;
  assert.equal(last30(s.habits[0], today).at(-1).status, 'done');
});

test('kayıt/yedek doğrulama ve taşıma', () => {
  const s = markDone(make(), 'h1', D0).state;
  const back = migrate(JSON.stringify(s));
  assert.deepEqual(back, s);
  assert.deepEqual(migrate(''), emptyState());
  assert.throws(() => migrate('{"foo":1}'));
  assert.throws(() => migrate('bozuk'));
  // Eksik alanlar tamamlanır, mükerrer tarihler temizlenir
  const m = migrate({ habits: [{ id: 'a', name: 'X', done: ['2026-01-02', '2026-01-02', 'x'] }] });
  assert.deepEqual(m.habits[0].done, ['2026-01-02']);
  assert.equal(m.habits[0].createdAt, '2026-01-02');
  assert.equal(m.version, 3);
});

test('tarih yardımcıları ay/yıl geçişinde doğru', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  setNow(new Date(2026, 4, 9, 23, 59));
  assert.equal(todayKey(), '2026-05-09');
  // Gün 04:00'te başlar: gece 01:30 hâlâ önceki gün, 04:00 yeni gün
  setNow(new Date(2026, 4, 10, 1, 30));
  assert.equal(todayKey(), '2026-05-09');
  setNow(new Date(2026, 4, 10, 4, 0));
  assert.equal(todayKey(), '2026-05-10');
  setNow(null);
});

// --- Ayarlar ---
import { normalizeAyarlar, varsayilanAyarlar } from '../app/src/main/assets/js/settings.js';

test('ayarlar: bozuk/eksik veri varsayılana döner, geçerli alanlar korunur', () => {
  assert.deepEqual(normalizeAyarlar(''), varsayilanAyarlar());
  assert.deepEqual(normalizeAyarlar('bozuk{'), varsayilanAyarlar());
  const a = normalizeAyarlar(JSON.stringify({ modelRot: { x: 90, y: 'a' }, prefrontal: { x: 1.2 }, modelYazar: 'Ali' }));
  assert.deepEqual(a.modelRot, { x: 90, y: 0, z: 0 });
  assert.equal(a.prefrontal.x, 1.2);
  assert.equal(a.prefrontal.y, 0.24);
  assert.equal(a.modelYazar, 'Ali');
  // Eski HTML'in yer tutucusu boş sayılır
  assert.equal(normalizeAyarlar({ modelYazar: '[yazar adı]' }).modelYazar, '');
});

test('ayarlar: varsayılan kopyası değiştirilince asıl varsayılan bozulmaz', () => {
  const a = varsayilanAyarlar();
  a.modelRot.x = 45;
  assert.equal(varsayilanAyarlar().modelRot.x, 0);
});

test('düzenleme: isim/ikon/saat değişir, günler korunur', () => {
  let s = markDone(make(), 'h1', D0).state;
  s = updateHabit(s, 'h1', { name: '  Roman oku ', icon: '📖', time: '22:15' });
  const h = s.habits[0];
  assert.equal(h.name, 'Roman oku');
  assert.equal(h.icon, '📖');
  assert.equal(h.time, '22:15');
  assert.deepEqual(h.done, [D0]);
  assert.throws(() => updateHabit(s, 'h1', { name: '' }));
  // Geçersiz saat ve boş ikon eskisini korur
  s = updateHabit(s, 'h1', { name: 'X', icon: '', time: 'bozuk' });
  assert.equal(s.habits[0].icon, '📖');
  assert.equal(s.habits[0].time, '22:15');
});

test('bekleyen kutlama: uygulama dışında 66. gün tamamlanınca bir kez', () => {
  let s = make();
  // Bildirimden işaretlenmiş gibi: done doğrudan 66 gün
  s.habits[0].done = Array.from({ length: GOAL_DAYS }, (_, i) => addDays(D0, i));
  const t = addDays(D0, GOAL_DAYS - 1);
  assert.equal(pendingCelebrations(s, t).length, 1);
  s = markCelebrated(s, 'h1');
  assert.equal(pendingCelebrations(s, t).length, 0);
});
