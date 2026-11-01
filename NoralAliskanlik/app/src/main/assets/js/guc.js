// Alışkanlık gücü (H) modeli — Spesifikasyon §3 ve §4 (kenar durumları).
// SAF FONKSİYON: H hiçbir yerde biriktirilmez; her seferinde kayıt geçmişinden
// baştan hesaplanır. Böylece geriye dönük düzeltmeler, silme, duraklatma ve
// parametre değişiklikleri her zaman tutarlı kalır.
import {
  LAMBDA_ILK, LAMBDA_ARDISIK, TABAN_ORANI, TASARRUF,
  ASAMA_YUKARI, ASAMA_ASAGI, YOL_NOKTALARI, PARLAKLIK_GUN,
  ZORLUK_T, alfaHesapla, MAZERET_HAKKI, MAZERET_PENCERE, DURAKLATMA_EN_UZUN,
  SRBAI_FARK, SRBAI_ADIM, T_EN_AZ, T_EN_COK, BAKIM_GUN, NUKS_PENCERE, NUKS_KAYMA,
} from './parametreler.js';
import { addDays } from './clock.js';

/** Aşamalar: 0 Çaba, 1 Tekrar, 2 Yerleşiyor, 3 Otomatik */
export const OTOMATIK = 3;

// ---------------------------------------------------------------------------
// Takvim yardımcıları
// ---------------------------------------------------------------------------

/** Haftanın günü: 0 Pazar … 6 Cumartesi (JS Date ile aynı). */
export function haftaGunu(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getDay();
}

/** Haftanın başı (Pazartesi) anahtarı. */
export function haftaBasi(key) {
  return addDays(key, -((haftaGunu(key) + 6) % 7));
}

/** Gün bir duraklatma aralığında mı? Açık uçlu aralık en fazla DURAKLATMA_EN_UZUN gün sürer. */
export function duraklatildiMi(habit, key) {
  for (const d of habit.duraklatmalar || []) {
    const bit = d.bit || addDays(d.bas, DURAKLATMA_EN_UZUN - 1);
    if (key >= d.bas && key <= bit) return true;
  }
  return false;
}

/** Gün planlı mı? (yalnızca "belirli günler" türünde false olabilir) */
export function planliMi(habit, key) {
  const z = habit.zamanlama;
  if (!z || z.tur !== 'gunler') return true;
  return z.gunler.includes(haftaGunu(key));
}

// ---------------------------------------------------------------------------
// Tek bir fırsatın sonucu (§3.3)
// ---------------------------------------------------------------------------

/**
 * @param {{H:number,P:number,k:number,asama:number,seri:number}} d durum (yerinde güncellenir)
 * @param {number} alfa kazanım hızı
 * @param {number} lambdaCarpani haftalık hedefte bir kaçırma daha çok takvim günü kapsar
 */
function kazan(d, alfa) {
  // Daha önce ulaşılan seviyenin altındaysa geri dönüş daha hızlı (tasarruf etkisi)
  const a = d.H < d.P ? alfa * (1 + TASARRUF * d.P) : alfa;
  d.H += a * (1 - d.H);
  d.k = 0;
  d.seri += 1;
  sonlandir(d);
}

function kaybet(d, ussu = 1) {
  d.k += 1;
  const lambdaTemel = d.k === 1 ? LAMBDA_ILK : LAMBDA_ARDISIK;
  const lambda = 1 - Math.pow(1 - lambdaTemel, ussu);
  const F = TABAN_ORANI * d.P; // İz asla tamamen silinmez
  d.H = F + (d.H - F) * (1 - lambda);
  if (d.k >= 2) d.seri = 0; // İki gün kuralı: tek kaçırma seriyi bozmaz, ikincisi bozar
  sonlandir(d);
}

function sonlandir(d) {
  d.P = Math.max(d.P, d.H);
  // Histerezis: yukarı ve aşağı eşikler farklı (sınırda küre titremesin)
  while (d.asama < 3 && d.H >= ASAMA_YUKARI[d.asama] - 1e-12) d.asama++;
  while (d.asama > 0 && d.H < ASAMA_ASAGI[d.asama - 1]) d.asama--;
}

/** Eski testler/araçlar için: tek günü uygula (true = yapıldı). Normal zorluk. */
export function gunuUygula(d, yapildi) {
  if (d.seri === undefined) d.seri = 0;
  if (yapildi) kazan(d, alfaHesapla(ZORLUK_T.normal));
  else kaybet(d);
  return d;
}

// ---------------------------------------------------------------------------
// Ana hesap
// ---------------------------------------------------------------------------

/**
 * Alışkanlığın bugünkü durumunu kayıt geçmişinden hesaplar.
 * Kapanmış günler (başlangıçtan düne kadar) sırayla işlenir; bugün henüz kapanmadığı
 * için kaçırma sayılmaz, ama yapıldıysa kazanım hemen görünür.
 *
 * @param {object} habit  createdAt, done[], ve (v2) zorluk, zamanlama, mazeret[], duraklatmalar[], srbai[]
 * @param {string} bugun  'YYYY-MM-DD'
 */
export function computeState(habit, bugun) {
  const yapilan = new Set(habit.done);
  const mazeret = new Set(habit.mazeret || []);
  const z = habit.zamanlama || { tur: 'gunluk' };
  const haftalik = z.tur === 'haftalik';
  const n = haftalik ? Math.max(1, Math.min(7, z.hedef || 3)) : 7;

  // Zorluk → T; haftalık hedefte gereken tekrar R = T·√(n/7) (kural 2)
  let T = ZORLUK_T[habit.zorluk] || ZORLUK_T.normal;
  const alfaBul = () => alfaHesapla(haftalik ? T * Math.sqrt(n / 7) : T);
  let alfa = alfaBul();
  const haftalikUs = 7 / n; // Haftalıkta bir kaçırma daha uzun takvim süresini kapsar

  const d = { H: 0, P: 0, k: 0, asama: 0, seri: 0 };
  const sonuclar = []; // Son fırsatlar (parlaklık ve nüks için): true/false
  let bakimGun = 0;
  const kabulMazeret = []; // Kabul edilen mazeret günleri (kota için)

  // SRBAI kalibrasyonu: ölçümler tarih sırasıyla, gün döngüsüyle birlikte işlenir
  const olcumler = [...(habit.srbai || [])].sort((a, b) => (a.tarih < b.tarih ? -1 : 1));
  let olcumSira = 0;
  let yukari = 0, asagi = 0;
  const olcumleriUygula = (gun) => {
    while (olcumSira < olcumler.length && olcumler[olcumSira].tarih <= gun) {
      const fark = olcumler[olcumSira].S - d.H;
      if (fark > SRBAI_FARK) { yukari++; asagi = 0; }
      else if (-fark > SRBAI_FARK) { asagi++; yukari = 0; }
      else { yukari = 0; asagi = 0; }
      // Art arda iki ölçümde aynı yönde fark: kişisel hızı %10 ayarla
      if (yukari >= 2) { T = Math.max(T_EN_AZ, T * (1 - SRBAI_ADIM)); alfa = alfaBul(); yukari = 0; }
      if (asagi >= 2) { T = Math.min(T_EN_COK, T * (1 + SRBAI_ADIM)); alfa = alfaBul(); asagi = 0; }
      olcumSira++;
    }
  };

  /** Mazeret kotası: kayan 30 günde en fazla 4 gün; fazlası normal kaçırma (kural 3). */
  const mazeretGecerli = (gun) => {
    if (!mazeret.has(gun)) return false;
    const pencereBasi = addDays(gun, -(MAZERET_PENCERE - 1));
    const kullanilan = kabulMazeret.filter((m) => m >= pencereBasi).length;
    if (kullanilan >= MAZERET_HAKKI) return false;
    kabulMazeret.push(gun);
    return true;
  };

  // "Belirli günler" telafisi: planlı olmayan günde yapılan, aynı haftadaki
  // planlı bir kaçırmayı telafi eder (kural 1)
  const telafi = new Map();
  if (z.tur === 'gunler') {
    for (const g of yapilan) {
      if (g >= habit.createdAt && g <= bugun && !planliMi(habit, g)) {
        const h = haftaBasi(g);
        telafi.set(h, (telafi.get(h) || 0) + 1);
      }
    }
  }

  // Haftalık hedef sayaçları
  let hafta = null, haftaYapilan = 0, haftaAktifGun = 0, haftaMazeret = 0;
  const haftayiKapat = () => {
    if (hafta === null || haftaAktifGun === 0) return;
    const hedef = Math.round((n * haftaAktifGun) / 7); // Yarım haftalarda orantılı hedef
    const eksik = Math.max(0, hedef - haftaYapilan - haftaMazeret);
    for (let i = 0; i < eksik; i++) { kaybet(d, haftalikUs); sonuclar.push(false); }
  };

  const bakimSay = () => { bakimGun = d.H >= ASAMA_YUKARI[2] - 1e-12 ? bakimGun + 1 : 0; };

  for (let g = habit.createdAt; g < bugun; g = addDays(g, 1)) {
    olcumleriUygula(g);
    if (haftalik) {
      const hb = haftaBasi(g);
      if (hb !== hafta) { haftayiKapat(); hafta = hb; haftaYapilan = 0; haftaAktifGun = 0; haftaMazeret = 0; }
    }
    if (duraklatildiMi(habit, g)) { bakimSay(); continue; } // Duraklatma: H donar

    if (haftalik) {
      haftaAktifGun++;
      if (yapilan.has(g)) {
        // Hedefi aşan tamamlamalar ek kazanç vermez
        if (haftaYapilan < n) { kazan(d, alfa); sonuclar.push(true); }
        haftaYapilan++;
      } else if (mazeretGecerli(g)) {
        haftaMazeret++;
      }
    } else if (yapilan.has(g)) {
      kazan(d, alfa);
      sonuclar.push(true);
    } else if (!planliMi(habit, g)) {
      // Planlı olmayan gün: H değişmez
    } else if (mazeretGecerli(g)) {
      // Mazeret: H ve k değişmez
    } else if ((telafi.get(haftaBasi(g)) || 0) > 0) {
      telafi.set(haftaBasi(g), telafi.get(haftaBasi(g)) - 1);
    } else {
      kaybet(d);
      sonuclar.push(false);
    }
    bakimSay();
  }
  // Bugün: kapanmadı; kaçırma işlenmez, yapıldıysa kazanım hemen görünür
  olcumleriUygula(bugun);
  if (haftalik && haftaBasi(bugun) !== hafta) { haftayiKapat(); hafta = haftaBasi(bugun); haftaYapilan = 0; }
  const bugunDuraklatildi = duraklatildiMi(habit, bugun);
  if (yapilan.has(bugun) && !bugunDuraklatildi) {
    if (!haftalik || haftaYapilan < n) { kazan(d, alfa); sonuclar.push(true); }
    if (haftalik) haftaYapilan++;
    bakimSay();
  }

  // Parlaklık: son 7 fırsatın tamamlanma oranı (hiç fırsat yoksa tam parlak)
  const son = sonuclar.slice(-PARLAKLIK_GUN);
  const son7Oran = son.length ? son.filter(Boolean).length / son.length : 1;
  // Nüks (kötü alışkanlık): son 7 fırsatta 3+ kayma
  const sonNuks = sonuclar.slice(-NUKS_PENCERE);
  const kaymaSayisi = sonNuks.filter((x) => !x).length;

  // Son 30 gün: yapılan / fırsat (ikincil metrik, kural 16)
  let son30Yapilan = 0, son30Firsat = 0;
  for (let i = 29; i >= 0; i--) {
    const g = addDays(bugun, -i);
    if (g < habit.createdAt || duraklatildiMi(habit, g)) continue;
    const y = yapilan.has(g);
    if (y) son30Yapilan++;
    if (i === 0 && !y) continue; // Bugün henüz bitmedi
    if (haftalik ? false : (planliMi(habit, g) || y) && !mazeret.has(g)) son30Firsat++;
  }
  if (haftalik) son30Firsat = Math.round((n * 30) / 7);

  let toplamTekrar = 0;
  for (const g of habit.done) if (g >= habit.createdAt && g <= bugun) toplamTekrar++;

  return {
    H: d.H,
    P: d.P,
    asama: d.asama,
    toplamTekrar,
    son7Oran,
    ardisikKacirma: d.k,
    seri: d.seri,
    T,
    bakim: bakimGun >= BAKIM_GUN,
    nuks: kaymaSayisi >= NUKS_KAYMA,
    kaymaSayisi,
    son30: { yapilan: son30Yapilan, firsat: Math.max(son30Firsat, son30Yapilan) },
    bugunDuraklatildi,
    bugunPlanli: !bugunDuraklatildi && (haftalik || planliMi(habit, bugun)),
    hafta: haftalik ? { yapilan: haftaYapilan, hedef: n } : null,
  };
}

/** H (0..1) → kürenin yol üzerindeki konumu (0..1), parçalı doğrusal (§3.5). */
export function yolKonumu(H) {
  const h = Math.max(0, Math.min(1, H));
  for (let i = 1; i < YOL_NOKTALARI.length; i++) {
    const [h0, y0] = YOL_NOKTALARI[i - 1];
    const [h1, y1] = YOL_NOKTALARI[i];
    if (h <= h1) return y0 + ((h - h0) / (h1 - h0)) * (y1 - y0);
  }
  return 1;
}

/**
 * Geri dönüş vaadi (Spesifikasyon §5): daha önce Otomatik'e ulaşmış ama şu an altında
 * olan alışkanlık, bugünden itibaren planlı her gün yapılırsa kaç günde Otomatik'e döner?
 * Rakam uydurulmaz, modelin kendisiyle simüle edilir. Uygun değilse null.
 */
export function geriDonusTahmini(habit, bugun, sinir = 200) {
  const simdi = computeState(habit, bugun);
  if (simdi.asama === OTOMATIK || simdi.P < ASAMA_YUKARI[2] - 1e-12) return null;
  const done = new Set(habit.done);
  for (let i = 0; i < sinir; i++) {
    const g = addDays(bugun, i);
    if (planliMi(habit, g)) done.add(g);
    if (computeState({ ...habit, done: [...done].sort() }, g).asama === OTOMATIK) return i + 1;
  }
  return null;
}
