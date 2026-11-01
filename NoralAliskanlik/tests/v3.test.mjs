// v3: miktarlı takip, geç kayıt, çöp kutusu
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeState } from '../app/src/main/assets/js/guc.js';
import { addDays } from '../app/src/main/assets/js/clock.js';
import {
  migrate, emptyState, addHabit, setAmount, setDayStatus, amountOn, removeHabit,
  restoreHabit, deleteForever, purgeTrash, last30, SCHEMA_VERSION,
} from '../app/src/main/assets/js/habits.js';

const D0 = '2026-01-05';
const gun = (n) => addDays(D0, n - 1);
const ilkNGun = (n) => Array.from({ length: n }, (_, i) => gun(i + 1));
const sonu = (h, n) => {
  const bugun = addDays(D0, n);
  return computeState({ ...h, done: h.done.filter((d) => d < bugun) }, bugun);
};

test('v2 → v3 geçişi: yeni alanlar boş, hesap aynı', () => {
  const v2 = { version: 2, habits: [{ id: 'a', name: 'X', createdAt: D0, done: ilkNGun(20), zorluk: 'normal' }] };
  const v3 = migrate(v2);
  assert.equal(v3.version, SCHEMA_VERSION);
  assert.equal(v3.habits[0].miktar, null);
  assert.deepEqual(v3.habits[0].gunMiktar, {});
  assert.deepEqual(v3.habits[0].gecKayit, []);
  assert.deepEqual(v3.cop, []);
  assert.equal(computeState(v3.habits[0], gun(21)).H, computeState(v2.habits[0], gun(21)).H);
});

test('miktarlı takip: q = miktar / hedef; q ≥ 0,5 kazanım α·q, altı hafif kaçırma', () => {
  const temel = { createdAt: D0, miktar: { hedef: 8, birim: 'bardak' } };
  const tam = { ...temel, done: [gun(1)], gunMiktar: { [gun(1)]: 8 } };
  const yarim = { ...temel, done: [gun(1)], gunMiktar: { [gun(1)]: 4 } };
  const fazla = { ...temel, done: [gun(1)], gunMiktar: { [gun(1)]: 12 } };
  assert.ok(Math.abs(sonu(yarim, 1).H - sonu(tam, 1).H / 2) < 1e-12, 'yarım miktar yarım kazanım');
  assert.equal(sonu(fazla, 1).H, sonu(tam, 1).H, 'hedefi aşmak bonus vermez');
  // 20 gün tam, 21. gün 2 bardak (q=0,25): kaçırma ama λ·0,75
  const yirmi = Object.fromEntries(ilkNGun(20).map((g) => [g, 8]));
  const kismi = { ...temel, done: ilkNGun(20), gunMiktar: { ...yirmi, [gun(21)]: 2 } };
  const hic = { ...temel, done: ilkNGun(20), gunMiktar: yirmi };
  const once = sonu(hic, 20).H;
  assert.ok(sonu(kismi, 21).H < once && sonu(kismi, 21).H > sonu(hic, 21).H, 'kısmi gün tam kaçırmadan hafif');
});

test('miktar girişi: son 3 gün düzenlenir, q ≥ 0,5 ise gün yapıldı sayılır', () => {
  let s = addHabit(emptyState(), { name: 'Su', time: '09:00', miktar: { hedef: 8, birim: 'bardak' } }, D0, 'h1');
  assert.deepEqual(s.habits[0].miktar, { hedef: 8, birim: 'bardak' });
  s = setAmount(s, 'h1', gun(3), 3, gun(3)).state;
  assert.deepEqual(s.habits[0].done, [], '3/8 < yarı: yapıldı değil');
  s = setAmount(s, 'h1', gun(3), 5, gun(3)).state;
  assert.deepEqual(s.habits[0].done, [gun(3)]);
  assert.equal(amountOn(s.habits[0], gun(3)), 5);
  assert.equal(setAmount(s, 'h1', gun(1), 5, gun(6)).changed, false, '5 gün önce miktar girilmez');
  // "Yaptım" (markDone yolu) miktarlı alışkanlıkta hedefi yazar
  s = setDayStatus(s, 'h1', gun(4), 'done', gun(4)).state;
  assert.equal(amountOn(s.habits[0], gun(4)), 8);
});

test('kötü alışkanlıkta günlük sınır: kayıt yoksa temiz, sınır üstü kısmi kayma', () => {
  const h = { createdAt: D0, tip: 'kotu', miktar: { hedef: 5, birim: 'sigara' }, done: [], gunMiktar: {} };
  const temiz = sonu(h, 10);
  assert.equal(temiz.toplamTekrar, 10, 'kayıt yok = sınırın altında (temiz gün)');
  assert.equal(temiz.ardisikKacirma, 0);
  const asim = sonu({ ...h, gunMiktar: { [gun(10)]: 10 } }, 10);
  assert.equal(asim.ardisikKacirma, 1, 'sınır aşıldı: kayma');
  assert.ok(asim.H < temiz.H);
  const g = Object.fromEntries(last30({ ...h, gunMiktar: { [gun(10)]: 10 } }, gun(11)).map((d) => [d.key, d.status]));
  assert.equal(g[gun(9)], 'done');
  assert.equal(g[gun(10)], 'kayma');
});

test('geç kayıt (4–14 gün önce): işaretlenir ama kazanımın yarısını verir', () => {
  let s = addHabit(emptyState(), { name: 'X', time: '09:00' }, D0, 'h1');
  const bugun = gun(20);
  s = setDayStatus(s, 'h1', gun(10), 'done', bugun).state;
  assert.deepEqual(s.habits[0].gecKayit, [gun(10)]);
  const zamaninda = { createdAt: D0, done: [gun(10)] };
  const gec = s.habits[0];
  // 10. güne kadar hiç yapılmamış; 10. gün kazanımı: zamanındaysa α, geçse α/2
  assert.ok(Math.abs(sonu(gec, 10).H - sonu(zamaninda, 10).H / 2) < 0.002);
  assert.equal(setDayStatus(s, 'h1', gun(5), 'done', bugun).changed, false, '15 gün önce olmaz');
  assert.equal(setDayStatus(s, 'h1', gun(12), 'mazeret', bugun).changed, false, 'geç pencerede mazeret yok');
  // İşaret kaldırılınca geç bayrağı da kalkar
  s = setDayStatus(s, 'h1', gun(10), 'bos', bugun).state;
  assert.deepEqual(s.habits[0].gecKayit, []);
});

test('çöp kutusu: silinen 30 gün geri getirilebilir, sonra kalıcı silinir', () => {
  let s = addHabit(emptyState(), { name: 'X', time: '09:00' }, D0, 'h1');
  s = removeHabit(s, 'h1', gun(5));
  assert.equal(s.habits.length, 0);
  assert.equal(s.cop.length, 1);
  const geri = restoreHabit(s, 'h1');
  assert.equal(geri.habits.length, 1);
  assert.equal(geri.cop.length, 0);
  assert.equal(purgeTrash(s, gun(34)), s, '30 gün dolmadan silinmez');
  assert.equal(purgeTrash(s, gun(35)).cop.length, 0, '30 gün dolunca silinir');
  assert.equal(deleteForever(s, 'h1').cop.length, 0);
  // Çöp kutusu yedeğe girer ve geri yüklenir
  assert.equal(migrate(JSON.stringify(s)).cop[0].habit.id, 'h1');
});
