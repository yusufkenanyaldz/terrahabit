// Alışkanlık mantığı testleri. Çalıştırma (repo kökünde): node --test NoralAliskanlik/tests
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, addHabit, removeHabit, markDone, progress, doneCount,
  needsMissFlash, ackMisses, last30, migrate, GOAL_DAYS,
} from '../app/src/main/assets/js/habits.js';
import { addDays, setNow, todayKey } from '../app/src/main/assets/js/clock.js';

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

test('ilerleme = gün / 66 ve kaçırılan gün sayacı sıfırlamaz', () => {
  let s = make();
  s = markDone(s, 'h1', D0).state;
  // 1 gün kaçır, sonra devam et
  s = markDone(s, 'h1', addDays(D0, 2)).state;
  assert.equal(doneCount(s.habits[0]), 2);
  assert.equal(progress(s.habits[0]), 2 / GOAL_DAYS);
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
  assert.equal(progress(s.habits[0]), 1);
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
  assert.equal(m.version, 1);
});

test('tarih yardımcıları ay/yıl geçişinde doğru', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  setNow(new Date(2026, 4, 9, 23, 59));
  assert.equal(todayKey(), '2026-05-09');
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
  assert.equal(a.prefrontal.y, 0.34);
  assert.equal(a.modelYazar, 'Ali');
  // Eski HTML'in yer tutucusu boş sayılır
  assert.equal(normalizeAyarlar({ modelYazar: '[yazar adı]' }).modelYazar, '');
});

test('ayarlar: varsayılan kopyası değiştirilince asıl varsayılan bozulmaz', () => {
  const a = varsayilanAyarlar();
  a.modelRot.x = 45;
  assert.equal(varsayilanAyarlar().modelRot.x, 0);
});
