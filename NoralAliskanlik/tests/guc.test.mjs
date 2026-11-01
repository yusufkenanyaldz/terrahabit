// Alışkanlık gücü modeli testleri — Spesifikasyon §3.4 senaryoları (T=66).
// Çalıştırma (repo kökünde): node --test "NoralAliskanlik/tests/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeState, yolKonumu, OTOMATIK } from '../app/src/main/assets/js/guc.js';
import { addDays } from '../app/src/main/assets/js/clock.js';
import {
  emptyState, addHabit, toggleDay, markDone, last30,
} from '../app/src/main/assets/js/habits.js';

const D0 = '2026-01-01';

/** Desenden alışkanlık üret: desen[i] === true ise (i+1). gün yapıldı. */
function aliskanlik(desen) {
  return { createdAt: D0, done: desen.flatMap((y, i) => (y ? [addDays(D0, i)] : [])) };
}
/** n. günün sonundaki durum: ilk n gün kapanmış, bugün (n+1. gün) henüz işaretlenmemiş */
const gunSonu = (h, n) => {
  const bugun = addDays(D0, n);
  return computeState({ ...h, done: h.done.filter((d) => d < bugun) }, bugun);
};
/** Aşamanın ilk ulaşıldığı gün */
function ilkGun(h, asama, sinir = 300) {
  for (let n = 1; n <= sinir; n++) if (gunSonu(h, n).asama >= asama) return n;
  return -1;
}
const yakin = (gercek, beklenen, tol = 0.0015) =>
  assert.ok(Math.abs(gercek - beklenen) <= tol, `beklenen ≈${beklenen}, gelen ${gercek.toFixed(4)}`);

test('A) kusursuz takip: 66. günde H≈0,952, aşama günleri 16/41/66', () => {
  const h = aliskanlik(Array(100).fill(true));
  const tablo = { 7: 0.276, 15: 0.499, 16: 0.521, 30: 0.749, 40: 0.841, 41: 0.849, 50: 0.900, 66: 0.952, 100: 0.990 };
  for (const [g, H] of Object.entries(tablo)) yakin(gunSonu(h, +g).H, H);
  assert.equal(ilkGun(h, 1), 16);
  assert.equal(ilkGun(h, 2), 41);
  assert.equal(ilkGun(h, 3), 66);
});

test('B) haftada bir kaçırma (6 yap, 1 kaçır): Otomatik ≈81. gün', () => {
  // Not: Spesifikasyon tablosu 89. gün diyor; ancak §3.3 kuralı hangi gün kaçırılırsa
  // kaçırılsın 81–84. günü veriyor. A, C, D, E kurala birebir uyduğu için tablo hatalı sayıldı.
  const h = aliskanlik(Array.from({ length: 130 }, (_, i) => (i + 1) % 7 !== 0));
  yakin(gunSonu(h, 28).H, 0.668);
  yakin(gunSonu(h, 66).H, 0.920);
  assert.equal(ilkGun(h, OTOMATIK), 81);
  // Otomatik'e girdikten sonraki tek kaçırma histerezis sayesinde aşamayı düşürmez
  for (let n = 81; n <= 120; n++) assert.equal(gunSonu(h, n).asama, OTOMATIK, `gün ${n}`);
});

test('C) 50. günde 2 haftalık ara (51–64 kaçırıldı)', () => {
  const h = aliskanlik(Array.from({ length: 130 }, (_, i) => !(i + 1 >= 51 && i + 1 <= 64)));
  const tablo = { 50: 0.900, 51: 0.893, 57: 0.817, 59: 0.794, 64: 0.739, 79: 0.905 };
  for (const [g, H] of Object.entries(tablo)) yakin(gunSonu(h, +g).H, H);
  assert.equal(gunSonu(h, 57).asama, 2, '57. gün Yerleşiyor');
  assert.equal(gunSonu(h, 59).asama, 1, '59. gün Tekrar');
  assert.equal(ilkGun(h, OTOMATIK), 93);
});

test('D) Otomatik sonrası 3 ay terk: 90 gün sonra H≈0,369, sıfıra inmez', () => {
  const h = aliskanlik([...Array(100).fill(true), ...Array(90).fill(false)]);
  yakin(gunSonu(h, 100).H, 0.990);
  const tablo = { 1: 0.983, 7: 0.899, 14: 0.813, 30: 0.657, 60: 0.471, 90: 0.369 };
  for (const [g, H] of Object.entries(tablo)) yakin(gunSonu(h, 100 + +g).H, H);
  assert.equal(gunSonu(h, 190).asama, 0, 'Çaba');
  assert.ok(gunSonu(h, 190).H > 0.25 * 0.99 - 1e-9, 'taban F = 0,25·P korunur');
  assert.ok(gunSonu(h, 190).P > 0.989, 'iz (P) asla düşmez');
});

test('E) terk sonrası yeniden başlama: Tekrar 4, Yerleşiyor 21, Otomatik 37 gün', () => {
  const desen = [...Array(100).fill(true), ...Array(90).fill(false), ...Array(80).fill(true)];
  const h = aliskanlik(desen);
  const donus = (asama) => ilkGun(h, asama, 400) - 190;
  // 190. gün sonunda aşama Çaba; geri dönüşte eşiklere ulaşma süreleri
  const ilkYukari = (esik) => { for (let n = 191; n < 280; n++) if (gunSonu(h, n).H >= esik - 1e-12) return n - 190; return -1; };
  assert.equal(ilkYukari(0.50), 4);
  assert.equal(ilkYukari(0.845), 21);
  assert.equal(ilkYukari(0.95), 37);
  assert.ok(donus(OTOMATIK) <= 37);
});

test('tek kaçırma tepede yalnızca ≈0,7 puan götürür (42 puanlık ölçekte)', () => {
  const tam = aliskanlik(Array(100).fill(true));
  const tek = aliskanlik(Array.from({ length: 100 }, (_, i) => i !== 99));
  const fark = (gunSonu(tam, 99).H - gunSonu(tek, 100).H) * 42;
  assert.ok(fark < 0.75, `fark ${fark.toFixed(2)}`);
});

test('bugün henüz kapanmadı: yapılmadıysa kaçırma sayılmaz, yapıldıysa hemen kazanım', () => {
  const h = { createdAt: D0, done: [] };
  assert.equal(computeState(h, D0).H, 0);
  const y = computeState({ createdAt: D0, done: [D0] }, D0);
  assert.ok(y.H > 0.04 && y.toplamTekrar === 1);
});

test('parlaklık: son 7 günün tamamlanma oranı', () => {
  const desen = Array.from({ length: 20 }, (_, i) => i < 13 || i % 2 === 0);
  const h = aliskanlik(desen);
  const s = gunSonu(h, 20);
  // 14..20. günler: 15, 17, 19 yapıldı; 14, 16, 18, 20 kaçırıldı
  assert.equal(s.son7Oran, 3 / 7);
});

test('yol konumu: aşama sınırları yolu dörde böler', () => {
  assert.equal(yolKonumu(0), 0);
  assert.equal(yolKonumu(0.5), 0.25);
  assert.equal(yolKonumu(0.845), 0.5);
  assert.equal(yolKonumu(0.95), 0.75);
  assert.equal(yolKonumu(1), 1);
  assert.ok(yolKonumu(0.97) > 0.75 && yolKonumu(0.97) < 1);
});

test('geriye dönük kayıt: bugün + son 3 gün düzenlenebilir, daha eskisi değil', () => {
  const bugun = addDays(D0, 10);
  let s = addHabit(emptyState(), { name: 'Kitap', time: '09:00' }, D0, 'h1');
  let r = toggleDay(s, 'h1', addDays(bugun, -3), bugun);
  assert.equal(r.changed, true);
  s = r.state;
  assert.deepEqual(s.habits[0].done, [addDays(bugun, -3)]);
  r = toggleDay(s, 'h1', addDays(bugun, -4), bugun);
  assert.equal(r.changed, false, '4 gün önce düzenlenemez');
  r = toggleDay(s, 'h1', addDays(bugun, 1), bugun);
  assert.equal(r.changed, false, 'gelecek düzenlenemez');
  // Yanlışlıkla basılan "yaptım" geri alınabilir
  s = markDone(s, 'h1', bugun).state;
  s = toggleDay(s, 'h1', bugun, bugun).state;
  assert.ok(!s.habits[0].done.includes(bugun));
  const gunler = last30(s.habits[0], bugun);
  assert.deepEqual(gunler.filter((d) => d.duzenlenebilir).map((d) => d.key),
    [addDays(bugun, -3), addDays(bugun, -2), addDays(bugun, -1), bugun]);
});

test('alışkanlığın başladığı günden önce düzenleme yapılamaz', () => {
  const s = addHabit(emptyState(), { name: 'X', time: '09:00' }, D0, 'h1');
  assert.equal(toggleDay(s, 'h1', addDays(D0, -1), D0).changed, false);
});

test('geriye dönük işaret Otomatik eşiğini geçirirse kutlama tetiklenir', () => {
  // 65 gün yapılmış, 66. gün (dün) unutulmuş; bugün dünü işaretle
  const bugun = addDays(D0, 66);
  const done = Array.from({ length: 65 }, (_, i) => addDays(D0, i));
  let s = { version: 1, habits: [{ id: 'h1', name: 'X', icon: '', time: '09:00', createdAt: D0, done, missAck: null, celebrated: false }] };
  const r = toggleDay(s, 'h1', addDays(D0, 65), bugun);
  assert.equal(r.reachedGoal, true);
  assert.equal(r.state.habits[0].celebrated, true);
});
