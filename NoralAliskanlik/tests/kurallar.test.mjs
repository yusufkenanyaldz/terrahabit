// Kenar durum kuralları testleri — Spesifikasyon §4 (v2 kayıt formatı)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeState, haftaBasi, haftaGunu } from '../app/src/main/assets/js/guc.js';
import { addDays } from '../app/src/main/assets/js/clock.js';
import {
  migrate, emptyState, addHabit, updateHabit, setDayStatus, startPause, endPause,
  activePause, expiredPause, answerExpiredPause, addSrbai, srbaiDue, srbaiPuani,
  setArchived, last30, unseenMissedDays, syncDerived, SCHEMA_VERSION,
} from '../app/src/main/assets/js/habits.js';

const D0 = '2026-01-05'; // Pazartesi
const gun = (n) => addDays(D0, n - 1); // n. gün (1'den başlar)
const ilkNGun = (n) => Array.from({ length: n }, (_, i) => gun(i + 1));
const tam = (ekstra = {}, done = ilkNGun(100)) => ({ createdAt: D0, done, ...ekstra });
/** n. günün sonu: ilk n gün kapanmış, bugün işaretsiz */
const sonu = (h, n) => {
  const bugun = addDays(D0, n);
  return computeState({ ...h, done: h.done.filter((d) => d < bugun) }, bugun);
};
const ilkOtomatik = (h, sinir = 400) => { for (let n = 1; n <= sinir; n++) if (sonu(h, n).asama === 3) return n; return -1; };

test('v1 kayıt v2\'ye taşınır; varsayılanlarla güç birebir aynı kalır', () => {
  const v1 = { version: 1, habits: [{ id: 'a', name: 'Kitap', icon: '📚', time: '08:00', createdAt: D0, done: ilkNGun(40), missAck: null, celebrated: false }] };
  const v2 = migrate(JSON.stringify(v1));
  assert.equal(v2.version, SCHEMA_VERSION);
  const h = v2.habits[0];
  assert.equal(h.zorluk, 'normal');
  assert.equal(h.tip, 'iyi');
  assert.deepEqual(h.zamanlama, { tur: 'gunluk' });
  assert.deepEqual(h.mazeret, []);
  assert.deepEqual(h.duraklatmalar, []);
  assert.equal(h.arsiv, false);
  assert.deepEqual(h.done, v1.habits[0].done, 'günler korunur');
  const bugun = gun(45);
  assert.equal(computeState(h, bugun).H, computeState(v1.habits[0], bugun).H);
  // Daha yeni sürümden gelen yedek reddedilir
  assert.throws(() => migrate({ version: 99, habits: [] }));
});

test('zorluk: kusursuz takipte Otomatik — Kolay 60, Normal 66, Zor 90. gün', () => {
  assert.equal(ilkOtomatik(tam({ zorluk: 'kolay' })), 60);
  assert.equal(ilkOtomatik(tam({ zorluk: 'normal' })), 66);
  // Zor: 89. gün. Normal'de 16/41/66 korunsun diye seçilen kalibrasyonla kusursuz takipte
  // T. günde H 0,950 değil 0,952 oluyor; 90 günlük eğride bu, eşiği bir gün öne çekiyor.
  assert.equal(ilkOtomatik(tam({ zorluk: 'zor' }, ilkNGun(120)), 120), 89);
});

test('mazeret: H değişmez; 30 günde 4 hak, fazlası kaçırma sayılır', () => {
  const done = ilkNGun(20);
  const temel = sonu(tam({}, done), 20).H;
  const tekMazeret = sonu(tam({ mazeret: [gun(21)] }, done), 21).H;
  assert.equal(tekMazeret, temel, 'mazeretli gün H\'yi değiştirmez');
  // 5 ardışık mazeret: ilk 4 nötr, 5.si kaçırma
  const bes = [21, 22, 23, 24, 25].map(gun);
  const dortluk = sonu(tam({ mazeret: bes.slice(0, 4) }, done), 24).H;
  assert.equal(dortluk, temel);
  const besli = sonu(tam({ mazeret: bes }, done), 25);
  assert.ok(besli.H < temel, '5. mazeret kotayı aşar');
  assert.equal(besli.ardisikKacirma, 1);
});

test('duraklatma: H donar; en fazla 30 gün sürer, sonra normal hesap', () => {
  const done = ilkNGun(30);
  const once = sonu(tam({}, done), 30).H;
  const h = tam({ duraklatmalar: [{ bas: gun(31), bit: null }] }, done);
  assert.equal(sonu(h, 45).H, once, 'duraklatma içinde H sabit');
  assert.equal(sonu(h, 60).H, once, '30. güne kadar sabit');
  assert.ok(sonu(h, 61).H < once, '30 günü aşınca kaçırmalar işlenir');
});

test('duraklat / devam et / süresi dolunca sor', () => {
  let s = addHabit(emptyState(), { name: 'X', time: '09:00' }, D0, 'h1');
  s = startPause(s, 'h1', gun(5));
  assert.ok(activePause(s.habits[0], gun(5)));
  s = endPause(s, 'h1', gun(9));
  assert.equal(activePause(s.habits[0], gun(9)), null);
  assert.equal(s.habits[0].duraklatmalar[0].bit, gun(8));
  // Aynı gün başlatılıp bitirilen duraklatma tamamen kalkar
  s = startPause(s, 'h1', gun(12));
  s = endPause(s, 'h1', gun(12));
  assert.equal(s.habits[0].duraklatmalar.length, 1);
  // 30 gün dolunca bir kez sorulur
  s = startPause(s, 'h1', gun(20));
  assert.equal(expiredPause(s.habits[0], gun(49)), null);
  assert.ok(expiredPause(s.habits[0], gun(50)));
  const uzatilmis = answerExpiredPause(s, 'h1', gun(50), true);
  assert.equal(expiredPause(uzatilmis.habits[0], gun(50)), null);
  assert.ok(activePause(uzatilmis.habits[0], gun(50)), 'uzat: bugünden yeni duraklatma');
  const bitirilmis = answerExpiredPause(s, 'h1', gun(50), false);
  assert.equal(activePause(bitirilmis.habits[0], gun(50)), null);
});

test('belirli günler: planlı olmayan gün H\'yi değiştirmez; orada yapılan, planlı kaçırmayı telafi eder', () => {
  // Pzt-Çar-Cum (1,3,5). D0 Pazartesi.
  const z = { tur: 'gunler', gunler: [1, 3, 5] };
  assert.equal(haftaGunu(D0), 1);
  const planli = ilkNGun(28).filter((g) => [1, 3, 5].includes(haftaGunu(g)));
  const h = tam({ zamanlama: z }, planli);
  const s = sonu(h, 28);
  assert.equal(s.ardisikKacirma, 0, 'plansız günler kaçırma değil');
  assert.equal(s.toplamTekrar, 12);
  // 4. hafta Çarşamba kaçırıldı ama Perşembe yapıldı → telafi
  const carsamba = gun(24), persembe = gun(25);
  const telafili = tam({ zamanlama: z }, [...planli.filter((g) => g !== carsamba), persembe].sort());
  assert.equal(sonu(telafili, 28).ardisikKacirma, 0);
  const telafisiz = tam({ zamanlama: z }, planli.filter((g) => g !== carsamba));
  assert.ok(sonu(telafisiz, 28).H < sonu(telafili, 28).H);
});

test('haftalık hedef: hafta içinde ulaşılabilirse kaçırma yok; hafta sonunda eksik kadar kaçırma', () => {
  const z = { tur: 'haftalik', hedef: 3 };
  // 1. hafta: Pzt, Çar, Cum yapıldı → hedef tamam
  const tamHafta = tam({ zamanlama: z }, [gun(1), gun(3), gun(5)]);
  const s1 = sonu(tamHafta, 7);
  assert.equal(s1.ardisikKacirma, 0);
  assert.deepEqual(s1.hafta, { yapilan: 0, hedef: 3 }, 'yeni haftanın sayacı');
  // Hafta içinde (Çarşamba sonu) yalnızca 1 yapılmış: henüz kaçırma işlenmez
  const yarim = tam({ zamanlama: z }, [gun(1)]);
  assert.equal(sonu(yarim, 3).ardisikKacirma, 0);
  // Hafta kapandı, 1/3 → 2 kaçırma
  assert.equal(sonu(yarim, 7).ardisikKacirma, 2);
  // Hedefi aşan tamamlamalar ek kazanç vermez
  const fazla = tam({ zamanlama: z }, ilkNGun(7));
  assert.equal(sonu(fazla, 7).H, sonu(tamHafta, 7).H);
  // Haftada 3 kez kusursuz: Otomatik ≈ 66·√(3/7) ≈ 43 tekrar ≈ 14,3 hafta
  const uzun = tam({ zamanlama: z }, Array.from({ length: 30 }, (_, w) => [gun(w * 7 + 1), gun(w * 7 + 3), gun(w * 7 + 5)]).flat());
  const hafta = Math.ceil(ilkOtomatik(uzun, 250) / 7);
  assert.ok(hafta >= 14 && hafta <= 15, `Otomatik ${hafta}. haftada`);
});

test('SRBAI: puan 1–7 ölçeğinden 0–1\'e; art arda iki yüksek ölçüm hızı %10 artırır', () => {
  assert.equal(srbaiPuani([1, 1, 1, 1]), 0);
  assert.equal(srbaiPuani([7, 7, 7, 7]), 1);
  assert.equal(srbaiPuani([4, 4, 4, 4]), 0.5);
  const done = ilkNGun(60);
  const normal = sonu(tam({}, done), 40);
  // 14. ve 28. günde H'den çok yüksek otomatiklik bildirilmiş → T %10 kısalır
  const kalibre = sonu(tam({ srbai: [{ tarih: gun(14), S: 0.9, asama: 0 }, { tarih: gun(28), S: 0.95, asama: 1 }] }, done), 40);
  assert.ok(Math.abs(kalibre.T - 66 * 0.9) < 1e-9, `T=${kalibre.T}`);
  assert.ok(kalibre.H > normal.H, 'kişisel hız artınca güç daha hızlı yükselir');
  // Tek ölçüm yetmez
  const tek = sonu(tam({ srbai: [{ tarih: gun(14), S: 0.9, asama: 0 }] }, done), 40);
  assert.equal(tek.T, 66);
});

test('SRBAI zamanı: 14 günde bir, aşama yükselince, duraklatmada değil', () => {
  let s = addHabit(emptyState(), { name: 'X', time: '09:00' }, D0, 'h1');
  const h0 = s.habits[0];
  const d = (h, t) => computeState(h, t);
  assert.equal(srbaiDue(h0, d(h0, gun(10)), gun(10)), false);
  assert.equal(srbaiDue(h0, d(h0, gun(15)), gun(15)), true);
  s = addSrbai(s, 'h1', gun(15), [3, 3, 3, 3], 0);
  const h1 = s.habits[0];
  assert.equal(srbaiDue(h1, d(h1, gun(20)), gun(20)), false);
  assert.equal(srbaiDue(h1, d(h1, gun(29)), gun(29)), true);
  assert.equal(srbaiDue(h1, { ...d(h1, gun(20)), asama: 1 }, gun(20)), true, 'aşama yükselişinde');
  assert.equal(srbaiDue(h1, { ...d(h1, gun(29)), bugunDuraklatildi: true }, gun(29)), false);
});

test('bakım modu: H ≥ 0,95 olduktan 14 gün sonra', () => {
  const h = tam();
  assert.equal(sonu(h, 70).bakim, false);
  assert.equal(sonu(h, 66 + 13).bakim, true);
  let s = { version: 2, habits: [{ ...migrate({ habits: [{ id: 'a', name: 'X', createdAt: D0, done: ilkNGun(90) }] }).habits[0] }] };
  s = syncDerived(s, gun(91));
  assert.equal(s.habits[0].bakim, true);
  assert.equal(syncDerived(s, gun(91)), s, 'değişiklik yoksa aynı nesne');
});

test('iki gün kuralı serisi: tek kaçırma bozmaz, art arda iki kaçırma bozar', () => {
  const tekKacirma = tam({}, ilkNGun(10).filter((g) => g !== gun(5)));
  assert.equal(sonu(tekKacirma, 10).seri, 9);
  const ikiKacirma = tam({}, ilkNGun(10).filter((g) => g !== gun(5) && g !== gun(6)));
  assert.equal(sonu(ikiKacirma, 10).seri, 4);
});

test('kötü alışkanlıkta nüks: son 7 günde 3+ kayma', () => {
  const temiz = ilkNGun(20).filter((g) => ![gun(15), gun(17), gun(19)].includes(g));
  assert.equal(sonu(tam({ tip: 'kotu' }, temiz), 20).nuks, true);
  const ikiKayma = ilkNGun(20).filter((g) => ![gun(15), gun(19)].includes(g));
  assert.equal(sonu(tam({ tip: 'kotu' }, ikiKayma), 20).nuks, false);
});

test('son 30 gün oranı: planlı fırsatlar, mazeret ve duraklatma hariç', () => {
  const h = tam({ mazeret: [gun(26)] }, ilkNGun(30).filter((g) => g !== gun(25) && g !== gun(26)));
  const s = sonu(h, 30);
  // Pencere bugünü (31. gün, henüz işaretsiz) içerir: 2–30. günler kapanmış = 29 gün;
  // 26. gün mazeretli (fırsat değil), 25. gün kaçırıldı → 27 / 28
  assert.deepEqual(s.son30, { yapilan: 27, firsat: 28 });
});

test('mazeret yalnızca son 3 gün + bugün için işaretlenebilir; yapıldı ile mazeret birbirini değiştirir', () => {
  let s = addHabit(emptyState(), { name: 'X', time: '09:00' }, D0, 'h1');
  const bugun = gun(10);
  let r = setDayStatus(s, 'h1', gun(8), 'mazeret', bugun);
  assert.equal(r.changed, true);
  s = r.state;
  assert.deepEqual(s.habits[0].mazeret, [gun(8)]);
  s = setDayStatus(s, 'h1', gun(8), 'done', bugun).state;
  assert.deepEqual(s.habits[0].mazeret, []);
  assert.deepEqual(s.habits[0].done, [gun(8)]);
  assert.equal(setDayStatus(s, 'h1', gun(5), 'mazeret', bugun).changed, false);
});

test('takvim durumları ve kaçırma animasyonu yeni kurallara uyar', () => {
  const z = { tur: 'gunler', gunler: [1, 3, 5] };
  const h = { ...tam({ zamanlama: z, mazeret: [gun(10)], duraklatmalar: [{ bas: gun(15), bit: gun(17) }] }, [gun(1)]), missAck: null };
  const bugun = gun(20);
  const g = Object.fromEntries(last30(h, bugun).map((d) => [d.key, d.status]));
  assert.equal(g[gun(1)], 'done');
  assert.equal(g[gun(2)], 'plansiz'); // Salı
  assert.equal(g[gun(3)], 'missed');  // Çarşamba
  assert.equal(g[gun(10)], 'mazeret');
  assert.equal(g[gun(16)], 'duraklatma');
  const kacan = unseenMissedDays(h, bugun);
  assert.ok(!kacan.includes(gun(2)) && !kacan.includes(gun(10)) && !kacan.includes(gun(16)));
  assert.ok(kacan.includes(gun(3)));
});

test('arşiv ve ayar düzenleme: geçmiş korunur, güç yeni ayarla yeniden hesaplanır', () => {
  let s = addHabit(emptyState(), { name: 'X', time: '09:00', zorluk: 'zor', zamanlama: { tur: 'haftalik', hedef: 4 } }, D0, 'h1');
  assert.equal(s.habits[0].zorluk, 'zor');
  assert.deepEqual(s.habits[0].zamanlama, { tur: 'haftalik', hedef: 4 });
  s = updateHabit(s, 'h1', { name: 'Y', time: '10:00', zorluk: 'kolay' });
  assert.equal(s.habits[0].zorluk, 'kolay');
  assert.deepEqual(s.habits[0].zamanlama, { tur: 'haftalik', hedef: 4 }, 'verilmeyen ayar korunur');
  s = setArchived(s, 'h1', true);
  assert.equal(s.habits[0].arsiv, true);
  assert.equal(haftaBasi(gun(7)), D0);
});

test('geri dönüş vaadi modelden hesaplanır (Senaryo E: ≈37 gün)', async () => {
  const { geriDonusTahmini } = await import('../app/src/main/assets/js/guc.js');
  const h = tam({}, ilkNGun(100)); // 100 gün yap, sonra 90 gün terk
  const bugun = gun(191);
  assert.equal(geriDonusTahmini(h, bugun), 37);
  assert.equal(geriDonusTahmini(tam({}, ilkNGun(20)), gun(21)), null, 'hiç Otomatik olmamışsa vaat yok');
});

// --- v5: kötü alışkanlıkta sınırlı / sınırsız ayrımı kalktı ---
test('v5: sınırsız kötü alışkanlık da "kayıt yok = temiz" çalışır', () => {
  const D = '2026-03-01';
  const g = (i) => addDays(D, i);
  // Sınır verilmeden eklenen kötü alışkanlık 0 sınırı alır
  let st = addHabit(emptyState(), { name: 'Sigara', tip: 'kotu', time: '21:00' }, D, 'k');
  const h = st.habits[0];
  assert.deepEqual(h.miktar, { hedef: 0, birim: '' });

  // 30 gün hiç dokunulmadı: hepsi temiz, güç yükselmiş olmalı
  const s30 = computeState(h, g(30));
  assert.ok(s30.H > 0.7, `temiz günler sayılmalı, H=${s30.H.toFixed(3)}`);

  // Sınırlı kurulumla birebir aynı davranmalı
  const sinirli = { ...h, miktar: { hedef: 0, birim: 'kez' } };
  assert.ok(Math.abs(computeState(sinirli, g(30)).H - s30.H) < 1e-9);

  // Bir kayma (+1) o günü kaçırmaya çevirir
  const kaymali = { ...h, gunMiktar: { [g(10)]: 1 } };
  assert.ok(computeState(kaymali, g(30)).H < s30.H, 'kayma gücü düşürmeli');

  // Eski kayıt (v4, sınırsız) taşınınca sınır 0 olur
  const tasinan = migrate({ version: 4, habits: [{ id: 'k', name: 'Sigara', tip: 'kotu', createdAt: D, done: [] }] });
  assert.deepEqual(tasinan.habits[0].miktar, { hedef: 0, birim: '' });
});

test('v5: eklendiği gün kaçırma sayılmaz, bakım sayacı duraklatmada durur', () => {
  const D = '2026-03-01';
  const g = (i) => addDays(D, i);
  // Eklendiği gün yapılmadı: ertesi gün hâlâ sıfır kayıp (taban zaten 0) ve kaçırma listesi boş
  const h = { createdAt: D, done: [], mazeret: [], duraklatmalar: [], srbai: [], gecKayit: [],
    gunMiktar: {}, zorluk: 'normal', tip: 'iyi', zamanlama: { tur: 'gunluk' }, missAck: addDays(D, -1) };
  assert.deepEqual(unseenMissedDays(h, g(1)), []);
  assert.deepEqual(unseenMissedDays(h, g(3)), [g(1), g(2)]);

  // Bakım: duraklatmada geçen günler "14 gün ≥ %95" sayacına eklenmemeli.
  // 70 gün kusursuz (H %95'i 65. günde geçer, yani sayaç ~5) → 20 gün duraklatma.
  // Eskiden duraklatma günleri de sayıldığı için bakım açılıyordu.
  const done70 = Array.from({ length: 70 }, (_, i) => g(i));
  const duraklamali = { ...h, done: done70, duraklatmalar: [{ bas: g(70), bit: g(89) }] };
  assert.equal(computeState(duraklamali, g(90)).bakim, false, 'duraklatma günleri bakım saymaz');
  // 14 gün çalışarak ulaşılırsa açılır
  const calisarak = { ...h, done: Array.from({ length: 85 }, (_, i) => g(i)) };
  assert.equal(computeState(calisarak, g(85)).bakim, true, 'çalışılan günlerle bakım açılmalı');
});

test('v6: "neyin ardından" ipucu eklenir, eski kayıtlarda boş gelir, düzenlemede korunur', () => {
  // Eski kayıt (v5): alan yok → boş metin, başka hiçbir şey değişmez
  const eski = { version: 5, habits: [{ id: 'a', name: 'Kitap', createdAt: D0, done: ilkNGun(10) }] };
  const yeni = migrate(eski);
  assert.equal(yeni.version, 6);
  assert.equal(yeni.habits[0].ardindan, '');
  assert.deepEqual(yeni.habits[0].done, ilkNGun(10));

  // Ekleme: kırpılır ve 40 karakterle sınırlanır
  let s = addHabit(emptyState(), { name: 'Kitap', ardindan: '  Evden çıkınca  ' }, D0, 'k');
  assert.equal(s.habits[0].ardindan, 'Evden çıkınca');
  s = addHabit(s, { name: 'Su', ardindan: 'x'.repeat(60) }, D0, 's');
  assert.equal(s.habits[1].ardindan.length, 40);

  // Düzenleme: verilmezse korunur, boş verilirse silinir
  s = updateHabit(s, 'k', { name: 'Kitap oku' });
  assert.equal(s.habits[0].ardindan, 'Evden çıkınca');
  s = updateHabit(s, 'k', { name: 'Kitap oku', ardindan: '' });
  assert.equal(s.habits[0].ardindan, '');
  // Yedekten geri gelince bozuk tür temizlenir
  assert.equal(migrate({ version: 6, habits: [{ id: 'a', name: 'X', createdAt: D0, done: [], ardindan: 42 }] }).habits[0].ardindan, '');
});

test('güç geçmişi: her takvim günü için bir değer, sonu bugünkü güce eşit', () => {
  const h = tam({}, ilkNGun(30).filter((_, i) => i !== 9 && i !== 10)); // 10. ve 11. gün kaçtı
  const bugun = gun(30);
  const d = computeState(h, bugun);
  assert.equal(d.gecmis.length, 30, 'eklendiği günden bugüne her gün');
  assert.equal(d.gecmis.at(-1), d.H);
  assert.ok(d.gecmis[8] > d.gecmis[10], 'kaçırılan günlerde güç düşer');
  assert.ok(d.gecmis[10] > 0.25 * d.gecmis[8], 'ama tabanın altına inmez');
  for (let i = 1; i < 9; i++) assert.ok(d.gecmis[i] > d.gecmis[i - 1], 'yapılan günlerde artar');

  // Duraklatmada düz çizgi
  const durakli = tam({ duraklatmalar: [{ bas: gun(11), bit: gun(20) }] }, ilkNGun(10));
  const dd = computeState(durakli, gun(21));
  assert.equal(dd.gecmis.length, 21);
  assert.equal(dd.gecmis[19], dd.gecmis[9], 'duraklatmada güç donar');

  // Eklendiği gün: tek nokta
  assert.equal(computeState({ createdAt: D0, done: [] }, D0).gecmis.length, 1);
});
