// Arayüz: liste, detay kartı, ekleme/silme, yedek, kutlama, model yükleme, Ayar paneli.
// Oyun mantığı habits.js'te (saf, testli); 3B sahne brain-scene.js'te.
import { createBrainScene, asamaBilgisiGetir } from './brain-scene.js';
import { varsayilanAyarlar } from './settings.js';
import {
  addHabit, removeHabit, markDone, setDayStatus, dayStatus, doneCount, isDoneOn,
  needsMissFlash, ackMisses, last30, migrate,
  updateHabit, pendingCelebrations, markCelebrated,
  setArchived, startPause, endPause, activePause, expiredPause, answerExpiredPause,
  addSrbai, srbaiDue, syncDerived,
  setAmount, amountOn, isLateEditable, restoreHabit, deleteForever, purgeTrash,
} from './habits.js';
import { todayKey, setNow, addDays } from './clock.js';
import { SIMGELER, simgeSvg } from './simgeler.js';
import { computeState, geriDonusTahmini, planliMi, yolKonumu } from './guc.js';
import {
  CABA_UYARI_SAYISI, DURAKLATMA_EN_UZUN, MAZERET_HAKKI, MAZERET_PENCERE,
  GERIYE_DONUK_GUN, GEC_KAYIT_EN_ESKI, COP_GUN,
} from './parametreler.js';
import {
  loadState, saveState, exportBackup, requestImport,
  loadSettings, saveSettings, modelInfo,
} from './storage.js';

// Geliştirici modu: tarayıcıda ?tarih=2026-05-01 ile sahte gün (test için).
const tarihParam = new URLSearchParams(location.search).get('tarih');
if (tarihParam) setNow(new Date(`${tarihParam}T12:00:00`));

const $ = (id) => document.getElementById(id);

// -------------------------------------------------------------------------
// Durum
// -------------------------------------------------------------------------
let state;
let kayitBozuk = false; // Kayıt okunamadıysa üzerine yazma (veri kaybolmasın)
try {
  state = loadState();
} catch (e) {
  state = { version: 1, habits: [] };
  kayitBozuk = true;
}
let seciliId = null;
let ayarlar = loadSettings(); // Ayar paneli değerleri (SharedPreferences)

function kaydet() {
  if (kayitBozuk) {
    bildirimGoster('Kayıt okunamadı; veriyi korumak için kaydedilmedi. Yedekten geri yükleyin.');
    return;
  }
  // Türetilmiş alanlar (bakım modu) bildirim tarafı için kayda yazılır
  state = syncDerived(state, todayKey());
  saveState(state);
}

/**
 * Kötü alışkanlıkta aşamaların kendi adları olur: "Yerleşiyor" okununca sanki alışkanlık
 * yerleşiyormuş gibi duruyordu, oysa yerleşen şey bırakma (Spesifikasyon kural 5).
 */
const KOTU_ASAMA_ADI = ['Çaba', 'Direnç', 'Güçleniyor', 'Özgür'];
function asamaBilgisi(asama, h) {
  const a = asamaBilgisiGetir(asama);
  if (h.tip !== 'kotu') return a;
  const kisa = KOTU_ASAMA_ADI[asama] || a.kisa;
  return { ...a, kisa, ad: `${asama + 1}. Aşama: ${kisa}` };
}
const gucAdi = (h) => (h.tip === 'kotu' ? 'Kontrol' : 'Güç');
const aktifler = () => state.habits.filter((h) => !h.arsiv);

// -------------------------------------------------------------------------
// 3B sahne
// -------------------------------------------------------------------------
const sahne = createBrainScene({
  container: $('canvas-container'),
  labelsContainer: $('labels-container'),
  leaderSvg: $('leader-svg'),
  ayarlar,
  onSelect: (id) => aliskanlikSec(id),
  onProgress: (p) => { $('loading').textContent = `Beyin modeli yükleniyor… %${Math.round(p * 100)}`; },
});

// -------------------------------------------------------------------------
// Beyin modeli: telefonda kayıtlıysa her açılışta otomatik yüklenir,
// yoksa karşılama ekranı "Beyin modeli yükle" ister.
// -------------------------------------------------------------------------
function yuklemeGoster(acik, metin = 'Beyin modeli yükleniyor…') {
  $('loading').hidden = !acik;
  $('loading').textContent = metin;
}

/** Sahne (beyin + etiketler) hazır: yumuşakça görünür olsun. */
function sahneyiGoster() {
  document.body.classList.add('sahne-hazir');
  sahne.etiketleriGoster(); // Etiketler sahne görününce 5 sn görünsün, sonra kaybolsun
}

/** APK'nın içindeki hazır beyin modeli (Draco + WebP, ~2 MB). */
const HAZIR_MODEL = 'brain.glb';

/**
 * Açılış: kullanıcının yüklediği model varsa o, yoksa APK'daki hazır model.
 * İkisi de açılamazsa (olmaması gerekir) basit örnek beyin gösterilir.
 */
async function kayitliModeliYukle() {
  const info = modelInfo();
  yuklemeGoster(true);
  let ok = false;
  if (info.exists) {
    ok = await sahne.loadBrain(info.url);
    if (!ok) bildirimGoster('Yüklediğin model açılamadı — hazır model kullanılıyor');
  }
  if (!ok) ok = await sahne.loadBrain(HAZIR_MODEL);
  yuklemeGoster(false);
  if (!ok) sahne.showFallbackBrain();
  sahneyiGoster();
}

/** Yeni seçilen model: yükle; başarılıysa ayarları sıfırla ve Ayar panelini aç. */
async function yeniModeliYukle(url) {
  yuklemeGoster(true);
  const ok = await sahne.loadBrain(url);
  yuklemeGoster(false);
  if (!ok) {
    sahne.showFallbackBrain(); // Önceden model yoksa sahne boş kalmasın
    sahneyiGoster();
    bildirimGoster('Model açılamadı (.glb dosyasını kontrol edin)');
    return;
  }
  sahneyiGoster();
  // Her modelin yönü farklı olabilir: ayarları sıfırla ve paneli aç.
  ayarlar = varsayilanAyarlar();
  sahne.applySettings(ayarlar);
  saveSettings(ayarlar);
  ayarPaneliniDoldur();
  ayarPaneliAc(true);
  bildirimGoster('Model yüklendi — yönü ve bölgeleri Ayar panelinden düzeltin');
}

// -------------------------------------------------------------------------
// Tek ayar butonu: dokununca seçenekler aşağı açılır
// -------------------------------------------------------------------------
function menuAc(acik) {
  $('menu').classList.toggle('open', acik);
  $('btn-menu').classList.toggle('open', acik);
}
$('btn-menu').addEventListener('click', (e) => {
  e.stopPropagation();
  menuAc(!$('menu').classList.contains('open'));
});
// Menü dışına dokununca kapan
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.menu-wrap')) menuAc(false);
});
// Aç/kapa düğmeleri dışındaki seçenekler menüyü kapatır
document.querySelectorAll('.menu-item:not(.toggle)').forEach((el) =>
  el.addEventListener('click', () => menuAc(false)));

// "Beyin modeli yükle" → gizli dosya seçici (Android'de sistem dosya seçicisi açılır)
const glbInput = $('glb-input');
$('btn-upload').addEventListener('click', () => glbInput.click());
// Yalnızca tarayıcıda çalışır; Android'de dosya doğrudan iç depolamaya kopyalanır.
glbInput.addEventListener('change', () => {
  const file = glbInput.files?.[0];
  glbInput.value = '';
  if (file) yeniModeliYukle(URL.createObjectURL(file));
});

// -------------------------------------------------------------------------
// Ayar paneli (döndürme ve bölge konumları) — değerler telefonda saklanır
// -------------------------------------------------------------------------
const sliderBaglantilari = [
  { id: 'rot-x', grup: 'modelRot', eksen: 'x', suffix: '°' },
  { id: 'rot-y', grup: 'modelRot', eksen: 'y', suffix: '°' },
  { id: 'rot-z', grup: 'modelRot', eksen: 'z', suffix: '°' },
  { id: 'pfc-x', grup: 'prefrontal', eksen: 'x', suffix: '' },
  { id: 'pfc-y', grup: 'prefrontal', eksen: 'y', suffix: '' },
  { id: 'pfc-z', grup: 'prefrontal', eksen: 'z', suffix: '' },
  { id: 'bg-x', grup: 'basalGanglia', eksen: 'x', suffix: '' },
  { id: 'bg-y', grup: 'basalGanglia', eksen: 'y', suffix: '' },
  { id: 'bg-z', grup: 'basalGanglia', eksen: 'z', suffix: '' },
];

function degerYazisi(s, deger) {
  return (s.suffix === '°' ? Math.round(deger) : Number(deger).toFixed(2)) + s.suffix;
}

function ayarPaneliniDoldur() {
  sliderBaglantilari.forEach((s) => {
    const deger = ayarlar[s.grup][s.eksen];
    $(s.id).value = deger;
    $(`val-${s.id}`).textContent = degerYazisi(s, deger);
  });
  $('credit-input').value = ayarlar.modelYazar || '';
}

// Kaydırıcı her oynadığında diske yazmamak için kısa gecikmeyle kaydet.
let ayarKayitZaman = null;
function ayarlariKaydetGecikmeli() {
  clearTimeout(ayarKayitZaman);
  ayarKayitZaman = setTimeout(() => saveSettings(ayarlar), 300);
}

sliderBaglantilari.forEach((s) => {
  $(s.id).addEventListener('input', (e) => {
    ayarlar[s.grup][s.eksen] = parseFloat(e.target.value);
    $(`val-${s.id}`).textContent = degerYazisi(s, ayarlar[s.grup][s.eksen]);
    sahne.applySettings(ayarlar);
    ayarlariKaydetGecikmeli();
  });
});

$('credit-input').addEventListener('input', (e) => {
  ayarlar.modelYazar = e.target.value;
  ayarlariKaydetGecikmeli();
});

function ayarPaneliAc(acik) {
  $('settings-panel').classList.toggle('open', acik);
  // Panel alttan açılır: liste/detay gizlenir, beyin üstteki boş alanda ortalanır.
  document.body.classList.toggle('ayar-acik', acik);
  gorunurAlanGuncelle();
}
$('btn-settings-done').addEventListener('click', () => ayarPaneliAc(false));

// Panelin dışına kısa dokunuş paneli kapatır; beyni döndürmek için sürüklemek kapatmaz.
let disDokunus = null;
document.addEventListener('pointerdown', (e) => {
  disDokunus = $('settings-panel').classList.contains('open')
    && !e.target.closest('#settings-panel') && !e.target.closest('.menu-wrap')
    ? { x: e.clientX, y: e.clientY } : null;
});
document.addEventListener('pointerup', (e) => {
  if (disDokunus && Math.hypot(e.clientX - disDokunus.x, e.clientY - disDokunus.y) < 8) ayarPaneliAc(false);
  disDokunus = null;
});
$('btn-settings').addEventListener('click', () =>
  ayarPaneliAc(!$('settings-panel').classList.contains('open')));

$('btn-reset-settings').addEventListener('click', () => {
  const yazar = ayarlar.modelYazar; // Model aynı; yazar bilgisi korunur
  ayarlar = { ...varsayilanAyarlar(), modelYazar: yazar };
  sahne.applySettings(ayarlar);
  saveSettings(ayarlar);
  ayarPaneliniDoldur();
  bildirimGoster('Ayarlar sıfırlandı');
});


ayarPaneliniDoldur();

// Beyin, üst bar ile alttaki panel (liste ya da detay kartı) arasındaki boş alanda
// ortalansın; etiketler de bu alanın dışına taşmasın.
function gorunurAlanGuncelle() {
  const ust = document.querySelector('.top-bar').getBoundingClientRect().bottom;
  document.documentElement.style.setProperty('--ust-bar-h', `${Math.round(ust)}px`);
  // Ekleme penceresi alttan açılıyor: beyin üstte kalan boşluğa sığsın
  if (document.body.classList.contains('ekle-acik')) {
    sahne.setGorunurAlan(ust, $('add-form').getBoundingClientRect().top);
    return;
  }
  const altPanel = document.body.classList.contains('ayar-acik') ? $('settings-panel')
    : document.body.classList.contains('detay-acik') ? $('detail-card')
    : document.querySelector('.bottom-sheet');
  // Panelin son konumu (kayma animasyonundan bağımsız): CSS'teki alt boşluk + yükseklik
  const altBosluk = parseFloat(getComputedStyle(altPanel).bottom) || 0;
  const alt = window.innerHeight - altBosluk - altPanel.offsetHeight;
  sahne.setGorunurAlan(ust, alt);
}
window.addEventListener('resize', gorunurAlanGuncelle);
document.fonts?.ready.then(gorunurAlanGuncelle);

// -------------------------------------------------------------------------
// Liste ve detay kartı
// -------------------------------------------------------------------------
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function ciz() {
  const bugun = todayKey();
  // Alışkanlık gücü her çizimde kayıt geçmişinden baştan hesaplanır (saf fonksiyon)
  const liste = aktifler();
  const durumlar = new Map(liste.map((h) => [h.id, computeState(h, bugun)]));
  sahne.setHabits(liste.map((h) => {
    const d = durumlar.get(h.id);
    return { id: h.id, name: h.name, ikon: h.ikon, H: d.H, P: d.P, asama: d.asama, son7Oran: d.son7Oran };
  }));

  const listEl = $('habit-list-el');
  listEl.innerHTML = '';
  if (liste.length === 0) {
    listEl.innerHTML = '<div class="empty-hint">Henüz alışkanlık yok.<br>＋ Ekle ile ilk nöral yolunu başlat.</div>';
  }
  liste.forEach((h) => {
    const d = durumlar.get(h.id);
    const yuzde = Math.round(d.H * 100);
    const asama = asamaBilgisi(d.asama, h);
    const bugunYapildi = isDoneOn(h, bugun);
    const miktarYazi = d.miktar ? ` · ${d.miktar.bugun}/${d.miktar.hedef}` : '';
    const rozet = d.bugunDuraklatildi ? 'Duraklatıldı' : `${gucAdi(h)} %${yuzde} · ${asama.kisa}${miktarYazi}`;
    // Miktarlı alışkanlıkta onay yerine "+1" sayacı (iyide hedefe ulaşınca onay işareti)
    const sayac = d.miktar && !(h.tip !== 'kotu' && d.miktar.bugun >= d.miktar.hedef);
    const row = document.createElement('div');
    row.dataset.id = h.id;
    row.className = `habit-item ${seciliId === h.id ? 'selected' : ''} ${bugunYapildi ? 'done-today' : ''} ${d.bugunDuraklatildi ? 'durakli' : ''}`;
    row.innerHTML = `
      <div class="habit-item-top">
        <span class="satir-ikon" style="color:${asama.hex}">${simgeSvg(h.ikon, 17)}</span>
        <span class="habit-name">${esc(h.name)}</span>
        <span class="habit-day-badge">${rozet}</span>
        ${sayac ? '<button class="row-check sayac" aria-label="Bir tane ekle">+1</button>'
    : `<button class="row-check ${bugunYapildi ? 'done' : ''}" aria-label="Bugün yaptım"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>`}
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${yuzde}%; background:${asama.hex};"></div>
      </div>`;
    uzunBasmaBagla(row, () => aliskanlikSec(h.id), () => silmeOnayi(h));
    const onayEl = row.querySelector('.row-check');
    onayEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onayEl.dataset.uzun === '1') { onayEl.dataset.uzun = '0'; return; } // uzun basma zaten iş yaptı
      if (d.bugunDuraklatildi) bildirimGoster('Duraklatıldı — devam etmek için alışkanlığa dokun');
      else if (sayac) miktarDegistir(h.id, todayKey(), +1, row);
      else if (isDoneOn(h, todayKey())) bildirimGoster('Bugün zaten işaretli');
      else yaptimIsaretle(h.id, row);
    });
    // "+1"e uzun basmak miktarı doğrudan hedefe çeker: 10 sayfalık alışkanlık için
    // listede 10 kez dokunmak gerekmesin (widget'taki ✓ de aynı işi yapıyor).
    if (sayac && d.miktar && !d.bugunDuraklatildi && h.tip !== 'kotu') {
      let zamanlayici = null;
      const iptal = () => { clearTimeout(zamanlayici); zamanlayici = null; };
      onayEl.addEventListener('pointerdown', () => {
        zamanlayici = setTimeout(() => {
          onayEl.dataset.uzun = '1';
          if (navigator.vibrate) navigator.vibrate(30);
          const eksik = d.miktar.hedef - (amountOn(h, todayKey()) ?? 0);
          if (eksik > 0) miktarDegistir(h.id, todayKey(), eksik);
          bildirimGoster(`Hedefe çekildi — ${d.miktar.hedef} ${d.miktar.birim}`.trim());
        }, 500);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((o) => onayEl.addEventListener(o, iptal));
    }
    listEl.appendChild(row);
  });

  // Tutamak yalnız liste sığmıyorsa anlamlı
  const genis = document.body.classList.contains('liste-genis');
  $('btn-liste-genis').hidden = !genis && listEl.scrollHeight <= listEl.clientHeight + 4;

  cizDetay();
}

/**
 * Listeyi genişlet/daralt. Beyin ekranda kalır: görünür alan daraldıkça kamera
 * oransal olarak uzaklaşır (brain-scene → setGorunurAlan).
 */
$('btn-liste-genis').addEventListener('click', () => {
  const genis = !document.body.classList.contains('liste-genis');
  document.body.classList.toggle('liste-genis', genis);
  const t = $('btn-liste-genis');
  t.setAttribute('aria-expanded', String(genis));
  t.setAttribute('aria-label', genis ? 'Listeyi daralt' : 'Listeyi genişlet');
  // Yükseklik animasyonu sürerken beyin de her karede yeniden yerleşsin
  const bitis = performance.now() + 340;
  const takip = () => {
    gorunurAlanGuncelle();
    if (performance.now() < bitis) requestAnimationFrame(takip);
  };
  takip();
});


function cizDetay() {
  const h = state.habits.find((x) => x.id === seciliId && !x.arsiv);
  document.body.classList.toggle('detay-acik', !!h);
  if (!h) {
    $('detail-card').classList.remove('visible');
    gorunurAlanGuncelle();
    return;
  }
  const bugun = todayKey();
  const d = computeState(h, bugun);
  const asama = asamaBilgisi(d.asama, h);
  const kotu = h.tip === 'kotu';

  $('det-name').textContent = h.name;
  $('det-ikon').innerHTML = simgeSvg(h.ikon, 17);
  $('det-ikon').style.color = asamaBilgisi(d.asama, h).hex;
  const stageEl = $('det-stage');
  stageEl.textContent = asama.kisa;
  stageEl.style.background = `${asama.hex}22`;
  stageEl.style.color = asama.hex;
  stageEl.style.border = `1px solid ${asama.hex}66`;
  $('det-time').textContent = `${siklikYazisi(h)} · ${h.time}`;

  // Güç: başlıkta sayı, altındaki mini yolda kürenin konumu (ana sahneyle aynı eşleme)
  $('det-guc').textContent = `%${Math.round(d.H * 100)}`;
  $('det-guc').style.color = asama.hex;
  const konum = Math.round(yolKonumu(d.H) * 1000) / 10;
  const kure = $('det-yol-kure');
  kure.style.left = `${konum}%`;
  kure.style.background = `radial-gradient(circle at 34% 32%, #fff, ${asama.hex} 62%)`;
  kure.style.boxShadow = `0 0 10px ${asama.hex}`;
  const dolu = $('det-yol-dolu');
  dolu.style.width = `${konum}%`;
  dolu.style.background = `linear-gradient(90deg, ${asamaBilgisi(0, h).hex}, ${asama.hex})`;
  $('det-yol-hedef').textContent = `~${Math.round(d.T)} gün`;
  // Asla düşmeyen sayılar: toplam tekrar ve ulaşılan en yüksek güç (iz)
  const iz = d.P - d.H > 0.02 ? ` · en yüksek %${Math.round(d.P * 100)}` : '';
  $('det-meta').textContent = `${d.toplamTekrar} ${kotu ? 'temiz gün' : 'tekrar'}${iz}`;
  // İkincil metrikler: son 30 gün oranı (haftalıkta bu hafta) ve iki gün kuralı serisi
  const oran = d.hafta ? `bu hafta ${Math.min(d.hafta.yapilan, d.hafta.hedef)}/${d.hafta.hedef}`
    : `${d.son30.yapilan}/${d.son30.firsat}`;
  $('det-percent').textContent = `${oran} · seri ${d.seri}`;

  // Duraklatma bandı
  const durak = activePause(h, bugun);
  $('det-durak').hidden = !durak;
  if (durak) {
    const bit = durak.bit || addDays(durak.bas, DURAKLATMA_EN_UZUN - 1);
    const kalan = Math.round((tarihSayisi(bit) - tarihSayisi(bugun)) / 864e5) + 1;
    $('det-durak-metin').textContent = `Duraklatıldı · güç donduruldu · ${kalan} gün kaldı`;
  }
  $('btn-pause').hidden = !!durak;

  // Nazik not: kötü alışkanlıkta kayma / geri dönüş vaadi
  let not = '';
  if (kotu && d.nuks) not = 'Bir kayma, yolun sonu değil. Bugün temiz bir gün yeniden başlıyor. Kaymayı tetikleyen durum neydi?';
  else {
    const tahmin = !durak && geriDonusTahmini(h, bugun);
    if (tahmin) not = `Daha önce ${kotu ? 'Özgür' : 'Otomatik'} aşamasına ulaştın; iz duruyor. Düzenli devam edersen yaklaşık ${tahmin} günde geri dönersin.`;
  }
  $('det-not').hidden = !not;
  $('det-not').textContent = not;

  // Son 30 gün
  const cal = $('det-calendar');
  cal.innerHTML = '';
  last30(h, bugun).forEach((g) => {
    const dot = document.createElement('div');
    dot.className = `cal-dot ${g.status}${g.isToday ? ' is-today' : ''}`;
    cal.appendChild(dot);
  });

  // Geriye dönük kayıt: son 3 gün + bugün.
  // Normal: dokunuş sırası boş → yapıldı → mazeret → boş. Miktarlı: dokunuş günü seçer.
  if (!miktarGun || miktarGun > bugun || miktarGun < addDays(bugun, -GERIYE_DONUK_GUN)) miktarGun = bugun;
  const gecmis = $('det-gecmis');
  gecmis.innerHTML = '';
  for (let i = -GERIYE_DONUK_GUN; i <= 0; i++) {
    const key = addDays(bugun, i);
    if (key < h.createdAt) continue;
    const durum = dayStatus(h, key);
    const b = document.createElement('button');
    const ad = i === 0 ? 'Bugün' : i === -1 ? 'Dün' : gunAdi(key);
    if (d.miktar) {
      const m = amountOn(h, key);
      b.className = `gun-btn ${durum}${i === 0 ? ' bugun' : ''}${key === miktarGun ? ' secili' : ''}`;
      b.textContent = durum === 'mazeret' ? `${ad} · M` : `${ad} ${m ?? 0}`;
      b.addEventListener('click', () => { miktarGun = key; cizDetay(); });
    } else {
      b.className = `gun-btn ${durum}${i === 0 ? ' bugun' : ''}`;
      b.textContent = durum === 'mazeret' ? `${ad} · M` : ad;
      b.addEventListener('click', () => gunDegistir(h.id, key));
    }
    gecmis.appendChild(b);
  }

  // Miktar ayarlayıcı (seçili gün)
  $('det-miktar').hidden = !d.miktar || !!durak;
  if (d.miktar) {
    $('miktar-sayi').textContent = amountOn(h, miktarGun) ?? 0;
    $('miktar-hedef').textContent = `${kotu ? 'sınır' : '/'} ${d.miktar.hedef} ${d.miktar.birim}`.trim();
  }
  // Geç kayıt: miktarlı alışkanlıkta ve gün yeterince eskiyse anlamlı
  $('btn-gec').hidden = !!d.miktar || addDays(bugun, -GERIYE_DONUK_GUN - 1) < h.createdAt;

  const btn = $('btn-do-today');
  btn.hidden = !!(d.miktar && kotu); // Sınırlı kötü alışkanlıkta sayaç yeterli
  // Miktarlı iyi alışkanlıkta "tamamlandı" ancak hedef miktara ulaşınca (yarısı güç verir ama hedef değil)
  const yapildi = d.miktar && !kotu ? (amountOn(h, bugun) ?? 0) >= d.miktar.hedef : isDoneOn(h, bugun);
  btn.disabled = yapildi || !!durak;
  if (durak) btn.textContent = 'Duraklatıldı';
  else if (d.miktar && !kotu) btn.textContent = yapildi ? 'Bugün tamamlandı' : `Hedefi tamamla (${d.miktar.hedef} ${d.miktar.birim})`.replace(' )', ')');
  else if (yapildi) btn.textContent = kotu ? 'Bugün temiz' : 'Bugün tamamlandı';
  else if (!kotu && !planliMi(h, bugun)) btn.textContent = 'Bugün plan dışı · yine de yaptım';
  else btn.textContent = kotu ? 'Bugün temiz geçti' : 'Bugün yaptım';
  $('detail-card').classList.add('visible');
  gorunurAlanGuncelle();
}

let miktarGun = null; // Miktarlı alışkanlıkta ayarlanan gün (varsayılan bugün)

/** Miktarı değiştir (+1 / −1); son 3 gün + bugün. */
function miktarDegistir(id, key, fark, kaynakEl) {
  const h = state.habits.find((x) => x.id === id);
  if (!h) return;
  const simdi = amountOn(h, key) ?? 0;
  const r = setAmount(state, id, key, simdi + fark, todayKey());
  if (!r.changed) return;
  const hedefeUlasti = h.miktar && key === todayKey()
    && simdi < h.miktar.hedef && simdi + fark >= h.miktar.hedef;
  const oncekiAsama = asamaOnce(id);
  state = r.state;
  kaydet();
  ciz();
  // Ödül yalnız günün hedefi tamamlanınca; ara adımlarda satır parlar ve titreşir
  const el = kaynakEl ? $('habit-list-el').querySelector(`[data-id="${id}"]`) || kaynakEl : null;
  if (hedefeUlasti && h.tip !== 'kotu') odulAnimasyonu(id, el);
  else if (el) {
    el.style.setProperty('--parla', asamaBilgisi(computeState(state.habits.find((x) => x.id === id), todayKey()).asama, h).hex);
    el.classList.add('parladi');
    setTimeout(() => el.classList.remove('parladi'), 700);
    if (navigator.vibrate) navigator.vibrate(10);
  }
  if (r.reachedGoal) kutlamaGoster(state.habits.find((x) => x.id === id));
  else asamaSonra(id, oncekiAsama);
}
$('miktar-arti').addEventListener('click', () => { if (seciliId) miktarDegistir(seciliId, miktarGun, +1); });
$('miktar-eksi').addEventListener('click', () => { if (seciliId) miktarDegistir(seciliId, miktarGun, -1); });

// Geç kayıt (kural 9): 4–14 gün önceki unutulan gün; kazanımın yarısını verir
$('btn-gec').addEventListener('click', () => {
  const h = state.habits.find((x) => x.id === seciliId);
  if (!h) return;
  const bugun = todayKey();
  const input = $('gec-tarih');
  const enEski = addDays(bugun, -GEC_KAYIT_EN_ESKI);
  input.min = enEski < h.createdAt ? h.createdAt : enEski;
  input.max = addDays(bugun, -GERIYE_DONUK_GUN - 1);
  input.value = input.max;
  if (input.showPicker) input.showPicker(); else input.click();
});
$('gec-tarih').addEventListener('change', async (e) => {
  const key = e.target.value;
  const h = state.habits.find((x) => x.id === seciliId);
  if (!h || !key) return;
  const bugun = todayKey();
  if (!isLateEditable(h, key, bugun)) {
    bildirimGoster(`Yalnızca ${GERIYE_DONUK_GUN + 1}–${GEC_KAYIT_EN_ESKI} gün önceki günler geç kaydedilebilir`);
    return;
  }
  const yapili = isDoneOn(h, key);
  const [y, m, g] = key.split('-');
  const secim = await secimIste(`${g}.${m}.${y}`,
    yapili ? 'Bu gün işaretli (geç kayıt). İşaret kaldırılsın mı?'
      : 'Unuttuğun bu günü işaretle. Geç kayıt olduğu için kazanımın yarısı sayılır.',
    [{ id: 'hayir', yazi: 'Vazgeç' }, { id: 'evet', yazi: yapili ? 'Kaldır' : 'İşaretle', sinif: 'btn-small primary' }]);
  if (secim !== 'evet') return;
  const r = setDayStatus(state, h.id, key, yapili ? 'bos' : 'done', bugun);
  if (!r.changed) return;
  state = r.state;
  kaydet();
  ciz();
  if (r.reachedGoal) kutlamaGoster(state.habits.find((x) => x.id === h.id));
});

function tarihSayisi(key) {
  const [y, m, g] = key.split('-').map(Number);
  return new Date(y, m - 1, g, 12).getTime();
}

function siklikYazisi(h) {
  const z = h.zamanlama || { tur: 'gunluk' };
  if (z.tur === 'gunler') return [1, 2, 3, 4, 5, 6, 0].filter((g) => z.gunler.includes(g)).map((g) => GUN_ADLARI[g]).join(' ');
  if (z.tur === 'haftalik') return `Haftada ${z.hedef}`;
  return 'Her gün';
}

function aliskanlikSec(id) {
  if (seciliId !== id) miktarGun = null;
  seciliId = id;
  sahne.select(id);
  ciz();
}

function detayKapat() {
  seciliId = null;
  sahne.select(null);
  ciz();
}

$('btn-close-detail').addEventListener('click', detayKapat);

const GUN_ADLARI = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
function gunAdi(key) {
  const [y, m, g] = key.split('-').map(Number);
  return GUN_ADLARI[new Date(y, m - 1, g, 12).getDay()];
}

/**
 * Geriye dönük kayıt (son 3 gün + bugün): dokunuş sırası boş → yapıldı → mazeret → boş.
 * Mazeret (hastalık vb.) günü gücü değiştirmez; kayan 30 günde 4 hak var.
 */
function gunDegistir(id, key) {
  const h = state.habits.find((x) => x.id === id);
  const simdi = dayStatus(h, key);
  const sonraki = simdi === 'bos' ? 'done' : simdi === 'done' ? 'mazeret' : 'bos';
  const r = setDayStatus(state, id, key, sonraki, todayKey());
  if (!r.changed) return;
  state = r.state;
  kaydet();
  ciz();
  if (sonraki === 'mazeret') {
    const yeni = state.habits.find((x) => x.id === id);
    const pencere = addDays(key, -(MAZERET_PENCERE - 1));
    const kullanilan = yeni.mazeret.filter((m) => m >= pencere && m <= key).length;
    bildirimGoster(kullanilan <= MAZERET_HAKKI
      ? `Mazeret: bu gün gücün değişmez (30 günde ${MAZERET_HAKKI - kullanilan} hak kaldı)`
      : 'Mazeret hakkı doldu: bu gün kaçırma sayılır');
  }
  if (r.reachedGoal) kutlamaGoster(state.habits.find((x) => x.id === id));
}

/**
 * Aşama atlama anı: günlük ödülün bir üstü, 66. gün kutlamasının bir altı.
 * Yılda birkaç kez olur, o yüzden günlükten belirgin biçimde büyük ama hâlâ kısa.
 * 4. aşamanın (Otomatik / Özgür) kendi kutlama ekranı var, buraya girmez.
 */
const ASAMA_MESAJI = {
  iyi: { 1: 'Tekrar aşaması — yol belirginleşiyor', 2: 'Yerleşiyor — çaba azalmaya başladı' },
  kotu: { 1: 'Direnç aşaması — dürtü zayıflıyor', 2: 'Güçleniyor — artık daha az uğraşıyorsun' },
};
/** İşaretlemeden önceki aşama (sonra karşılaştırmak için). */
function asamaOnce(id) {
  const h = state.habits.find((x) => x.id === id);
  return h ? computeState(h, todayKey()).asama : 0;
}
/** Aşama atladıysa dalgayı ve mesajı göster. Atladıysa true döner. */
function asamaSonra(id, onceki) {
  const h = state.habits.find((x) => x.id === id);
  if (!h) return false;
  const yeni = computeState(h, todayKey()).asama;
  const mesaj = (ASAMA_MESAJI[h.tip === 'kotu' ? 'kotu' : 'iyi'] || {})[yeni];
  if (yeni <= onceki || !mesaj) return false;
  sahne.asamaDalgasi(id);
  bildirimGoster(mesaj);
  if (navigator.vibrate) navigator.vibrate([12, 60, 22]);
  return true;
}

/**
 * İşaretleme ödülü. Üç parça, hepsi kısa:
 *  1. Dokunulan satır aşama renginde hafifçe parlar (parmağın altında, anında).
 *  2. Panelin ARKASINDAN ince bir ışık çıkıp küreye doğru yükselir — havai fişek gibi
 *     hızlı başlar, tepede yavaşlar. Panel yarı saydam ve bulanık olduğu için ışık
 *     panelin altındayken sızıntı gibi görünür, üstüne çıkınca netleşir.
 *  3. Küreye varınca küre parlar ve beyin kısa bir an aydınlanır (brain-scene).
 * Her gün tekrarlanacağı için ses, konfeti ve puan yok; süre ~0,8 sn.
 */
function odulAnimasyonu(id, kaynakEl) {
  const asama = (() => {
    const h = state.habits.find((x) => x.id === id);
    return h ? asamaBilgisi(computeState(h, todayKey()).asama, h).hex : '#00e5ff';
  })();

  // 1) Satır parlaması
  if (kaynakEl) {
    kaynakEl.style.setProperty('--parla', asama);
    kaynakEl.classList.remove('parladi');
    void kaynakEl.offsetWidth;            // animasyonu yeniden başlat
    kaynakEl.classList.add('parladi');
    setTimeout(() => kaynakEl.classList.remove('parladi'), 700);
  }
  if (navigator.vibrate) navigator.vibrate(15);

  // 2) Işık: satırdan küreye
  const hedef = sahne.kureEkranKonumu(id);
  if (!hedef || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (hedef) sahne.tikParlamasi(id);
    return;
  }
  const kutu = (kaynakEl || $('habit-list-el')).getBoundingClientRect();
  const bas = { x: kutu.left + kutu.width / 2, y: kutu.top + kutu.height / 2 };
  const dx = hedef.x - bas.x;
  const dy = hedef.y - bas.y;
  const aci = Math.atan2(dy, dx) * 180 / Math.PI + 90; // ışık kendi yönüne baksın

  const isik = document.createElement('div');
  isik.className = 'odul-isigi';
  isik.style.setProperty('--renk', asama);
  document.body.appendChild(isik);
  const hareket = isik.animate([
    { transform: `translate3d(${bas.x}px, ${bas.y}px, 0) rotate(${aci}deg) scaleY(0.5)`, opacity: 0.9 },
    { transform: `translate3d(${bas.x + dx * 0.55}px, ${bas.y + dy * 0.55}px, 0) rotate(${aci}deg) scaleY(1)`, opacity: 1, offset: 0.45 },
    { transform: `translate3d(${hedef.x}px, ${hedef.y}px, 0) rotate(${aci}deg) scaleY(0.35)`, opacity: 0 },
  ], { duration: 700, easing: 'cubic-bezier(0.22, 0.62, 0.3, 1)' });
  hareket.onfinish = () => {
    isik.remove();
    sahne.tikParlamasi(id);   // 3) küre parlar, beyin aydınlanır
  };
}

// "Bugün yaptım": günde yalnızca bir kez (detay kartı ve listedeki ✓ aynı işi yapar)
function yaptimIsaretle(id, kaynakEl) {
  const onceki = asamaOnce(id);
  const r = markDone(state, id, todayKey());
  if (!r.changed) return;
  state = r.state;
  kaydet();
  ciz();
  const h = state.habits.find((x) => x.id === id);
  // Satır yeniden çizildi: parlayacak öğeyi listeden tazele
  odulAnimasyonu(id, kaynakEl ? $('habit-list-el').querySelector(`[data-id="${id}"]`) || kaynakEl : null);
  if (r.reachedGoal) kutlamaGoster(h);
  else if (!asamaSonra(id, onceki)) {
    bildirimGoster(h.tip === 'kotu' ? 'Temiz bir gün daha — kontrol güçleniyor' : '+1 tekrar — nöral yol güçleniyor');
  }
}
$('btn-do-today').addEventListener('click', () => {
  if (!seciliId) return;
  const h = state.habits.find((x) => x.id === seciliId);
  // Miktarlı alışkanlık: bugünün miktarını hedefe çek
  if (h && h.miktar && h.tip !== 'kotu') {
    miktarDegistir(h.id, todayKey(), h.miktar.hedef - (amountOn(h, todayKey()) ?? 0), $('detail-card'));
    return;
  }
  yaptimIsaretle(seciliId, $('detail-card'));
});

// -------------------------------------------------------------------------
// Uzun basma (silme) / kısa dokunma (seçme)
// -------------------------------------------------------------------------
function uzunBasmaBagla(el, kisaDokunma, uzunBasma) {
  let zamanlayici = null;
  let baslangic = null;
  let uzunOldu = false;
  const iptal = () => {
    clearTimeout(zamanlayici);
    zamanlayici = null;
    el.classList.remove('pressing');
  };
  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.row-check')) return; // Onay butonu seçme/silme başlatmaz
    uzunOldu = false;
    baslangic = { x: e.clientX, y: e.clientY };
    el.classList.add('pressing');
    zamanlayici = setTimeout(() => {
      uzunOldu = true;
      iptal();
      if (navigator.vibrate) navigator.vibrate(30);
      uzunBasma();
    }, 600);
  });
  el.addEventListener('pointermove', (e) => {
    if (baslangic && Math.hypot(e.clientX - baslangic.x, e.clientY - baslangic.y) > 10) iptal();
  });
  el.addEventListener('pointerup', () => {
    const kisa = zamanlayici !== null && !uzunOldu;
    iptal();
    if (kisa) kisaDokunma();
  });
  el.addEventListener('pointercancel', iptal);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

/**
 * Uzun basma: arşivle (geçmiş ve iz korunur, geri açılabilir) ya da kalıcı sil (kural 10).
 */
async function silmeOnayi(h) {
  const secim = await secimIste(`"${h.name}"`,
    `Arşivlersen geçmişin ve izin korunur, istediğinde geri açabilirsin. Silersen ${COP_GUN} gün çöp kutusunda durur, sonra ${doneCount(h)} tekrarlık kayıt kalıcı olarak silinir.`,
    [{ id: 'vazgec', yazi: 'Vazgeç' }, { id: 'arsiv', yazi: 'Arşivle', sinif: 'btn-small primary' },
     { id: 'sil', yazi: 'Silmek için küreyi kaydır', kaydir: true }]);
  if (secim === 'arsiv') {
    state = setArchived(state, h.id, true);
    bildirimGoster('Arşivlendi — ⚙ → Arşiv ve silinenler\'den geri açabilirsin');
  } else if (secim === 'sil') {
    state = removeHabit(state, h.id, todayKey());
    bildirimGoster(`Silindi — ${COP_GUN} gün içinde ⚙ → Arşiv ve silinenler'den geri getirebilirsin`);
  } else return;
  if (seciliId === h.id) { seciliId = null; sahne.select(null); }
  kaydet();
  ciz();
}

// -------------------------------------------------------------------------
// Açılır pencereler
// -------------------------------------------------------------------------
/**
 * Kaydırarak onay: küre sağ uca sürüklenince onay verilir, bırakılırsa başa döner.
 * Yalnız nadir ve bilerek yapılan işlerde kullanılır (ilk oluşturma, kalıcı silme);
 * günlük tamamlama tek dokunuş olarak kalır.
 */
function kaydirBagla(iz, onay) {
  const kure = iz.querySelector('.kaydir-kure');
  let suruyor = false, baslangic = 0, x = 0;
  const enCok = () => Math.max(1, iz.clientWidth - kure.offsetWidth - 8);
  const koy = (v) => {
    x = Math.max(0, Math.min(enCok(), v));
    kure.style.left = `${4 + x}px`;
    iz.classList.toggle('tamam', x > enCok() * 0.55);
  };
  const geri = () => {
    iz.classList.add('yumusak');
    koy(0);
    setTimeout(() => iz.classList.remove('yumusak'), 260);
  };
  kure.addEventListener('pointerdown', (e) => {
    suruyor = true; baslangic = e.clientX - x;
    iz.classList.remove('yumusak');
    kure.setPointerCapture(e.pointerId);
  });
  kure.addEventListener('pointermove', (e) => { if (suruyor) koy(e.clientX - baslangic); });
  const birak = () => {
    if (!suruyor) return;
    suruyor = false;
    const yeterli = x >= enCok() * 0.9;
    geri();
    if (yeterli) onay();
  };
  kure.addEventListener('pointerup', birak);
  kure.addEventListener('pointercancel', birak);
  return { sifirla: geri };
}

let secimCoz = null;
/**
 * Genel seçim penceresi. secenekler: [{ id, yazi, sinif? }]. Seçilen id döner;
 * geri tuşu ya da kapatma ilk seçeneği (vazgeç) döndürür.
 */
function secimIste(baslik, metin, secenekler) {
  if (secimCoz) secimKapat(null);
  $('confirm-title').textContent = baslik;
  $('confirm-text').textContent = metin;
  const kutu = $('confirm-actions');
  kutu.innerHTML = '';
  for (const o of secenekler) {
    if (o.kaydir) {
      const sar = document.createElement('div');
      sar.className = 'kaydir';
      const iz = document.createElement('div');
      iz.className = 'kaydir-iz tehlike';
      iz.innerHTML = '<span class="kaydir-metin"></span><div class="kaydir-kure"></div>';
      iz.querySelector('.kaydir-metin').textContent = o.yazi;
      sar.appendChild(iz);
      kutu.appendChild(sar);
      kaydirBagla(iz, () => secimKapat(o.id));
      continue;
    }
    const b = document.createElement('button');
    b.className = o.sinif || 'btn-small';
    b.textContent = o.yazi;
    b.addEventListener('click', () => secimKapat(o.id));
    kutu.appendChild(b);
  }
  secimIlk = secenekler[0].id;
  $('modal-confirm').classList.add('open');
  return new Promise((resolve) => { secimCoz = resolve; });
}
let secimIlk = null;
function secimKapat(sonuc) {
  $('modal-confirm').classList.remove('open');
  if (secimCoz) { const c = secimCoz; secimCoz = null; c(sonuc ?? secimIlk); }
}
async function onayIste(baslik, metin, evetYazi = 'Evet', kaydir = false) {
  return (await secimIste(baslik, metin, [
    { id: 'hayir', yazi: 'Vazgeç' },
    kaydir ? { id: 'evet', yazi: evetYazi, kaydir: true } : { id: 'evet', yazi: evetYazi, sinif: 'btn-danger' },
  ])) === 'evet';
}

// Alışkanlık ekleme
let duzenlenenId = null; // null: yeni alışkanlık, değilse düzenleme

// Form seçim grupları (tek seçim; "Belirli günler" çoklu)
const form = { tip: 'iyi', siklik: 'gunluk', gunler: new Set([1, 3, 5]), hedef: 3, zorluk: 'normal', ikon: 'genel' };

// Simge seçici düğmeleri bir kez kurulur
$('sec-simge').innerHTML = SIMGELER.map((sg) =>
  `<button type="button" data-v="${sg.id}" title="${sg.ad}" aria-label="${sg.ad}">${simgeSvg(sg.id, 20)}</button>`).join('');
$('sec-simge').querySelectorAll('button').forEach((b) => {
  b.addEventListener('click', () => { form.ikon = b.dataset.v; formuCiz(); });
});

function secimGrubu(id, deger, coklu = false) {
  $(id).querySelectorAll('button').forEach((b) => {
    const v = b.dataset.v;
    b.classList.toggle('on', coklu ? deger.has(Number(v)) : String(deger) === v);
  });
}
function formuCiz() {
  secimGrubu('sec-tip', form.tip);
  secimGrubu('sec-siklik', form.siklik);
  secimGrubu('sec-gunler', form.gunler, true);
  secimGrubu('sec-hedef', form.hedef);
  secimGrubu('sec-zorluk', form.zorluk);
  secimGrubu('sec-simge', form.ikon);
  // Beyindeki etikette artık yalnız simge görünüyor: aynı simgeden iki alışkanlık olursa
  // hangisi hangisi belli olmaz. Başkasının kullandığı simgeler soluk gösterilir (engel değil).
  const kullanilan = new Set(aktifler().filter((x) => x.id !== duzenlenenId).map((x) => x.ikon));
  $('sec-simge').querySelectorAll('button').forEach((b) => {
    const dolu = kullanilan.has(b.dataset.v) && b.dataset.v !== form.ikon;
    b.classList.toggle('kullanilan', dolu);
    b.title = dolu ? `${b.getAttribute('aria-label')} — başka bir alışkanlıkta kullanılıyor`
      : b.getAttribute('aria-label');
  });
  $('sec-gunler').hidden = form.siklik !== 'gunler';
  $('sec-hedef').hidden = form.siklik !== 'haftalik';
  // Miktar yalnızca her gün / belirli günlerde (haftalık hedefle birlikte kullanılmaz)
  $('miktar-alani').hidden = form.siklik === 'haftalik';
  $('miktar-etiket').textContent = form.tip === 'kotu' ? 'Günlük sınır (isteğe bağlı, ör. en fazla 5)' : 'Günlük miktar (isteğe bağlı, ör. 8 bardak)';
  const T = { kolay: 60, normal: 66, zor: 90 }[form.zorluk];
  $('form-not').textContent = form.siklik === 'haftalik'
    ? `Daha seyrek davranışlar daha yavaş otomatikleşir (haftada ${form.hedef}: yaklaşık ${Math.round(T * Math.sqrt(form.hedef / 7))} tekrar).`
    : `Kusursuz takipte ortalama ${T} günde otomatikleşir; kişiden kişiye çok değişir.`;
}
$('sec-tip').addEventListener('click', (e) => { if (e.target.dataset.v) { form.tip = e.target.dataset.v; formuCiz(); } });
$('sec-siklik').addEventListener('click', (e) => { if (e.target.dataset.v) { form.siklik = e.target.dataset.v; formuCiz(); } });
$('sec-hedef').addEventListener('click', (e) => { if (e.target.dataset.v) { form.hedef = Number(e.target.dataset.v); formuCiz(); } });
$('sec-zorluk').addEventListener('click', (e) => { if (e.target.dataset.v) { form.zorluk = e.target.dataset.v; formuCiz(); } });
$('sec-gunler').addEventListener('click', (e) => {
  if (!e.target.dataset.v) return;
  const g = Number(e.target.dataset.v);
  if (form.gunler.has(g)) { if (form.gunler.size > 1) form.gunler.delete(g); } else form.gunler.add(g);
  if (form.gunler.size === 7) form.siklik = 'gunluk'; // 7 gün = her gün
  formuCiz();
});

function formAc(h) {
  duzenlenenId = h ? h.id : null;
  $('add-form').reset();
  $('add-title').textContent = h ? 'Alışkanlığı düzenle' : 'Yeni alışkanlık';
  $('add-name').value = h ? h.name : '';
  $('add-time').value = h ? h.time : '09:00';
  const z = (h && h.zamanlama) || { tur: 'gunluk' };
  form.tip = h ? h.tip || 'iyi' : 'iyi';
  form.siklik = z.tur;
  form.gunler = new Set(z.tur === 'gunler' ? z.gunler : [1, 3, 5]);
  form.hedef = z.tur === 'haftalik' ? z.hedef : 3;
  form.zorluk = h ? h.zorluk || 'normal' : 'normal';
  form.ikon = (h && h.ikon) || 'genel';
  $('add-miktar').value = h && h.miktar ? h.miktar.hedef : '';
  $('add-birim').value = h && h.miktar ? h.miktar.birim : '';
  formuCiz();
  // Aynı anda çok yeni alışkanlık: uyarı formun içinde, en baştan görünür (kural 13).
  // Eskiden kaydırdıktan sonra ayrı bir pencere çıkıyordu; üst üste iki onay fazlaydı.
  const caba = h ? 0 : aktifler().filter((x) => computeState(x, todayKey()).asama === 0).length;
  const uyari = $('form-uyari');
  uyari.hidden = caba < CABA_UYARI_SAYISI;
  uyari.textContent = uyari.hidden ? ''
    : `${caba} alışkanlık zaten Çaba aşamasında. Biri Tekrar'a geçince yenisini eklemen daha iyi olur; aynı anda çok başlangıç tutarlılığı zorlaştırır. Yine de ekleyebilirsin.`;
  // Yeni alışkanlık: kaydırarak onay. Düzenleme: sıradan Kaydet düğmesi.
  $('add-kaydir').hidden = !!h;
  $('add-save').hidden = !h;
  kaydirEkle.sifirla();
  ekleModali(true);
  if (!h) setTimeout(() => $('add-name').focus(), 50);
}

/** Ekleme penceresini aç/kapat: beyin de kalan boşluğa göre yeniden yerleşir. */
function ekleModali(acik) {
  $('modal-add').classList.toggle('open', acik);
  document.body.classList.toggle('ekle-acik', acik);
  gorunurAlanGuncelle();
}
const kaydirEkle = kaydirBagla($('add-kaydir').querySelector('.kaydir-iz'),
  () => $('add-form').requestSubmit());

function formZamanlama() {
  if (form.siklik === 'gunler') return { tur: 'gunler', gunler: [...form.gunler] };
  if (form.siklik === 'haftalik') return { tur: 'haftalik', hedef: form.hedef };
  return { tur: 'gunluk' };
}

$('btn-add').addEventListener('click', () => formAc(null));
$('btn-edit-habit').addEventListener('click', () => {
  const h = state.habits.find((x) => x.id === seciliId);
  if (h) formAc(h);
});
$('add-cancel').addEventListener('click', () => ekleModali(false));
$('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const veri = {
    name: $('add-name').value,
    ikon: form.ikon,
    time: $('add-time').value,
    tip: form.tip,
    zamanlama: formZamanlama(),
    zorluk: form.zorluk,
    // Boş bırakılırsa miktarsız (kötüde 0 = "hiç" geçerli bir sınır)
    miktar: form.siklik !== 'haftalik' && $('add-miktar').value !== ''
      ? { hedef: Number($('add-miktar').value), birim: $('add-birim').value } : null,
  };
  try {
    state = duzenlenenId ? updateHabit(state, duzenlenenId, veri) : addHabit(state, veri, todayKey());
  } catch (err) {
    bildirimGoster(err.message);
    return;
  }
  ekleModali(false);
  $('add-name').blur();
  kaydet(); // Android tarafı alarmları yeni saate göre yeniden kurar
  if (duzenlenenId) {
    ciz();
    bildirimGoster('Değişiklikler kaydedildi');
  } else {
    aliskanlikSec(state.habits.at(-1).id);
    bildirimGoster('Alışkanlık eklendi — hatırlatma kuruldu');
  }
  duzenlenenId = null;
});

// Yedek
$('btn-backup').addEventListener('click', () => $('modal-backup').classList.add('open'));
$('backup-close').addEventListener('click', () => $('modal-backup').classList.remove('open'));
$('backup-export').addEventListener('click', () => {
  const r = exportBackup(state);
  bildirimGoster(r.ok ? `Kaydedildi: İndirilenler/${r.message}` : r.message);
  if (r.ok) $('modal-backup').classList.remove('open');
});
$('backup-import').addEventListener('click', () => requestImport(yedekGeldi));

/** Seçilen yedek dosyasının metni (Android'den ya da tarayıcıdan). */
async function yedekGeldi(metin) {
  let yeni;
  try {
    yeni = migrate(metin);
  } catch (e) {
    bildirimGoster(`Yedek okunamadı: ${e.message}`);
    return;
  }
  const evet = await onayIste('Yedek geri yüklensin mi?',
    `Yedekte ${yeni.habits.length} alışkanlık var. Telefondaki mevcut veriler bu yedekle değiştirilecek.`,
    'Geri yükle');
  if (!evet) return;
  state = yeni;
  kayitBozuk = false; // Geçerli veri geldi; artık kaydetmek güvenli
  seciliId = null;
  sahne.select(null);
  kaydet();
  ciz();
  $('modal-backup').classList.remove('open');
  bildirimGoster('Yedek geri yüklendi');
}

// Otomatik aşamasına ilk ulaşma kutlaması
function kutlamaGoster(h) {
  if (!h) return;
  sahne.celebrate(h.id);
  $('cel-sub').textContent = `"${h.name}" bazal gangliyona yerleşti. Artık daha az çaba istiyor.`;
  $('celebration').classList.add('open');
  if (navigator.vibrate) navigator.vibrate([60, 80, 60, 80, 160]);
}
$('celebration').addEventListener('click', () => $('celebration').classList.remove('open'));

// Şeffaf mod / kesit
const btnTransparent = $('btn-transparent');
let seffaf = true;
btnTransparent.addEventListener('click', () => {
  seffaf = !seffaf;
  btnTransparent.classList.toggle('on', seffaf);
  sahne.setTransparent(seffaf);
});
$('btn-clip').addEventListener('click', (e) => {
  e.currentTarget.classList.toggle('on', sahne.toggleClip());
});

// Bildirim hapı
let toastZaman = null;
function bildirimGoster(mesaj) {
  const toast = $('toast');
  toast.textContent = mesaj;
  toast.classList.add('show');
  clearTimeout(toastZaman);
  toastZaman = setTimeout(() => toast.classList.remove('show'), 2600);
}

// -------------------------------------------------------------------------
// Kaçırılan gün kontrolü: sayaç sıfırlanmaz, küre bir kez sönükleşip titrer
// -------------------------------------------------------------------------
function kacirilanlariKontrolEt() {
  const bugun = todayKey();
  const kacirilan = state.habits.filter((h) => needsMissFlash(h, bugun));
  if (kacirilan.length === 0) return;
  kacirilan.forEach((h, i) => setTimeout(() => sahne.flashMiss(h.id), 600 + i * 700));
  bildirimGoster(kacirilan.length === 1
    ? `${kacirilan[0].name}: küren biraz uykuya daldı; bir tekrar onu uyandırır`
    : `${kacirilan.length} küre biraz uykuya daldı; bir tekrar onları uyandırır`);
  state = ackMisses(state, bugun); // Animasyon bir daha oynamasın
  kaydet();
}

/** Uygulama kapalıyken (bildirimden) Otomatik'e ulaşanlar için kutlamayı şimdi göster. */
function bekleyenKutlamalar() {
  const h = pendingCelebrations(state, todayKey())[0];
  if (!h) return;
  state = markCelebrated(state, h.id);
  kaydet();
  kutlamaGoster(h);
}

// -------------------------------------------------------------------------
// Android köprüsü için genel fonksiyonlar (MainActivity çağırır)
// -------------------------------------------------------------------------
window.NoralApp = {
  /** Geri tuşu: açık pencere varsa kapat ve true döndür. */
  handleBack() {
    if ($('menu').classList.contains('open')) { menuAc(false); return true; }
    if ($('celebration').classList.contains('open')) { $('celebration').classList.remove('open'); return true; }
    if ($('modal-confirm').classList.contains('open')) { secimKapat(null); return true; }
    if ($('modal-srbai').classList.contains('open')) { srbaiKapat(); return true; }
    for (const id of ['modal-add', 'modal-backup', 'modal-arsiv']) {
      if ($(id).classList.contains('open')) {
        if (id === 'modal-add') ekleModali(false); else $(id).classList.remove('open');
        return true;
      }
    }
    if ($('settings-panel').classList.contains('open')) { ayarPaneliAc(false); return true; }
    if (seciliId) { detayKapat(); return true; }
    return false;
  },
  /** Uygulama öne gelince: gün değişmiş, bildirimden "Yaptım" denmiş olabilir. */
  onResume() {
    this.reload();
    acilisKontrolleri();
    // Geri dönüşte boyut olayı kaçmış olabilir: kamera ve yerleşim yeniden ölçülsün.
    window.dispatchEvent(new Event('resize'));
  },
  /** Kayıt dışarıda (bildirim butonu) değişti: ekrandaki veriyi yenile. */
  reload() {
    if (kayitBozuk) return;
    try {
      state = loadState();
    } catch {
      return;
    }
    if (seciliId && !state.habits.some((h) => h.id === seciliId)) { seciliId = null; sahne.select(null); }
    ciz();
    bekleyenKutlamalar();
  },
  /** Seçilen yedek dosyasının içeriği. */
  onImport(metin) { yedekGeldi(metin); },
  /** Model dosyası iç depolamaya kopyalanmaya başladı (büyük dosyada birkaç saniye). */
  onModelCopyStart() {
    yuklemeGoster(true, 'Model telefona kaydediliyor…');
  },
  /** Kopyalama bitti: { exists, url, name } */
  onModelSaved(infoJson) {
    const info = JSON.parse(infoJson);
    yeniModeliYukle(info.url);
  },
  onModelError(mesaj) {
    yuklemeGoster(false);
    bildirimGoster(mesaj);
  },
};

// -------------------------------------------------------------------------
// Gizli ölçüm göstergesi: başlığa hızlıca 3 kez dokun → fps ve takılmalar
// -------------------------------------------------------------------------
let baslikDokunus = [];
let olcumZaman = null;
$('brand-title').addEventListener('click', () => {
  const simdi = Date.now();
  baslikDokunus = baslikDokunus.filter((t) => simdi - t < 800);
  baslikDokunus.push(simdi);
  if (baslikDokunus.length < 3) return;
  baslikDokunus = [];
  const hud = $('hud');
  hud.hidden = !hud.hidden;
  clearInterval(olcumZaman);
  if (!hud.hidden) {
    olcumZaman = setInterval(() => {
      const s = sahne.getStats();
      hud.textContent = `${s.fps} fps · en uzun kare ${s.enUzun} ms · takılma ${s.takilma}/sn · oran ${s.oran}`;
    }, 500);
  }
});

// -------------------------------------------------------------------------
// Duraklatma (tatil / seyahat): ileriye dönük, en fazla 30 gün (kural 4)
// -------------------------------------------------------------------------
$('btn-pause').addEventListener('click', async () => {
  const h = state.habits.find((x) => x.id === seciliId);
  if (!h) return;
  const evet = await secimIste('Duraklatılsın mı?',
    `Tatil ya da yolculuk gibi bağlamın olmadığı günler için. Duraklatmada güç donar, hatırlatma gelmez. En fazla ${DURAKLATMA_EN_UZUN} gün sürer; istediğin an devam edebilirsin.`,
    [{ id: 'hayir', yazi: 'Vazgeç' }, { id: 'evet', yazi: 'Duraklat', sinif: 'btn-small primary' }]);
  if (evet !== 'evet') return;
  state = startPause(state, h.id, todayKey());
  kaydet();
  ciz();
});
$('btn-resume').addEventListener('click', () => {
  if (!seciliId) return;
  state = endPause(state, seciliId, todayKey());
  kaydet();
  ciz();
  bildirimGoster('Devam ediliyor — hoş geldin');
});

// -------------------------------------------------------------------------
// Arşivdekiler: geri aç ya da kalıcı sil
// -------------------------------------------------------------------------
function arsivCiz() {
  copCiz();
  const kutu = $('arsiv-liste');
  kutu.innerHTML = '';
  const liste = state.habits.filter((h) => h.arsiv);
  if (!liste.length) {
    kutu.innerHTML = '<div class="empty-hint">Arşiv boş.</div>';
    return;
  }
  for (const h of liste) {
    const satir = document.createElement('div');
    satir.className = 'arsiv-satir';
    satir.innerHTML = `<span>${esc(h.name)}</span>`;
    const ac = document.createElement('button');
    ac.className = 'btn-small primary';
    ac.textContent = 'Geri aç';
    ac.addEventListener('click', () => {
      state = setArchived(state, h.id, false);
      kaydet();
      ciz();
      arsivCiz();
      bildirimGoster('Geri açıldı — arşivdeki süre gücüne yansıdı, iz duruyor');
    });
    const sil = document.createElement('button');
    sil.className = 'btn-danger';
    sil.textContent = 'Sil';
    sil.addEventListener('click', async () => {
      state = removeHabit(state, h.id, todayKey());
      kaydet();
      ciz();
      arsivCiz();
    });
    satir.append(ac, sil);
    kutu.appendChild(satir);
  }
}
/** Son 30 günde silinenler: geri getir ya da hemen kalıcı sil */
function copCiz() {
  const kutu = $('cop-liste');
  kutu.innerHTML = '';
  const cop = state.cop || [];
  $('cop-baslik').hidden = cop.length === 0;
  for (const c of cop) {
    const satir = document.createElement('div');
    satir.className = 'arsiv-satir';
    const kalan = Math.max(0, Math.round((tarihSayisi(addDays(c.silinme, COP_GUN)) - tarihSayisi(todayKey())) / 864e5));
    satir.innerHTML = `<span>${esc(c.habit.name)} · ${kalan} gün</span>`;
    const geri = document.createElement('button');
    geri.className = 'btn-small primary';
    geri.textContent = 'Geri getir';
    geri.addEventListener('click', () => {
      state = restoreHabit(state, c.habit.id);
      kaydet();
      ciz();
      arsivCiz();
      bildirimGoster('Geri getirildi — geçmişin ve izin duruyor');
    });
    const sil = document.createElement('button');
    sil.className = 'btn-danger';
    sil.textContent = 'Kalıcı sil';
    sil.addEventListener('click', async () => {
      if (!(await onayIste('Kalıcı olarak silinsin mi?', `"${c.habit.name}" geri alınamaz şekilde silinecek.`,
        'Silmek için küreyi kaydır', true))) return;
      state = deleteForever(state, c.habit.id);
      kaydet();
      arsivCiz();
    });
    satir.append(geri, sil);
    kutu.appendChild(satir);
  }
}
$('btn-arsiv').addEventListener('click', () => { arsivCiz(); $('modal-arsiv').classList.add('open'); });
$('arsiv-kapat').addEventListener('click', () => $('modal-arsiv').classList.remove('open'));

// -------------------------------------------------------------------------
// SRBAI otomatiklik anketi: 14 günde bir 4 madde (§3.6). İsteğe bağlı.
// -------------------------------------------------------------------------
const SRBAI_MADDELER = [
  'Otomatik olarak yaparım',
  'Bilinçli olarak hatırlamaya gerek duymadan yaparım',
  'Düşünmeden yaparım',
  'Farkına varmadan yapmaya başlarım',
];
let srbaiAliskanlik = null;
let srbaiCevaplar = [];
const srbaiErtelenen = new Set(); // "Şimdi değil" → bu oturumda tekrar sorma

function srbaiAc(h) {
  srbaiAliskanlik = h.id;
  srbaiCevaplar = [0, 0, 0, 0];
  $('srbai-baslik').textContent = `"${h.name}" ne kadar otomatik?`;
  const kutu = $('srbai-maddeler');
  kutu.innerHTML = '';
  SRBAI_MADDELER.forEach((metin, i) => {
    const satir = document.createElement('div');
    satir.className = 'srbai-madde';
    satir.innerHTML = `<div class="srbai-metin">${metin}</div><div class="secim srbai-olcek"></div>`;
    const olcek = satir.querySelector('.srbai-olcek');
    for (let v = 1; v <= 7; v++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = v;
      b.addEventListener('click', () => {
        srbaiCevaplar[i] = v;
        olcek.querySelectorAll('button').forEach((x, j) => x.classList.toggle('on', j + 1 === v));
        $('srbai-kaydet').disabled = srbaiCevaplar.some((c) => !c);
      });
      olcek.appendChild(b);
    }
    kutu.appendChild(satir);
  });
  $('srbai-kaydet').disabled = true;
  $('modal-srbai').classList.add('open');
}
function srbaiKapat() {
  if (srbaiAliskanlik) srbaiErtelenen.add(srbaiAliskanlik);
  srbaiAliskanlik = null;
  $('modal-srbai').classList.remove('open');
}
$('srbai-sonra').addEventListener('click', srbaiKapat);
$('srbai-kaydet').addEventListener('click', () => {
  const h = state.habits.find((x) => x.id === srbaiAliskanlik);
  if (h) {
    const bugun = todayKey();
    state = addSrbai(state, h.id, bugun, srbaiCevaplar, computeState(h, bugun).asama);
    kaydet();
    ciz();
    bildirimGoster('Teşekkürler — kişisel hızın buna göre ayarlanacak');
  }
  srbaiAliskanlik = null;
  $('modal-srbai').classList.remove('open');
});

const btnSrbai = $('btn-srbai');
btnSrbai.classList.toggle('on', ayarlar.srbaiAcik !== false);
btnSrbai.addEventListener('click', () => {
  ayarlar.srbaiAcik = !(ayarlar.srbaiAcik !== false);
  btnSrbai.classList.toggle('on', ayarlar.srbaiAcik);
  saveSettings(ayarlar);
});

// -------------------------------------------------------------------------
// Açılış kontrolleri (sırayla, aynı anda en fazla bir pencere)
// -------------------------------------------------------------------------
let kontrolSuruyor = false;
async function acilisKontrolleri() {
  if (kayitBozuk || kontrolSuruyor) return;
  kontrolSuruyor = true;
  try {
    const bugun = todayKey();
    // 30 günü dolan silinenler kalıcı olarak silinir
    const temiz = purgeTrash(state, bugun);
    if (temiz !== state) { state = temiz; kaydet(); }
    // Widget ya da bildirimden işaretlendiyse aşama atlaması uygulamada görülmemiş olur.
    // Kayıtta duran aşama (Kotlin tarafı güncellemez) taze hesapla karşılaştırılır —
    // syncDerived üzerine yazmadan önce.
    const atlayanlar = aktifler()
      .filter((h) => Number.isInteger(h.asama) && computeState(h, bugun).asama > h.asama)
      .map((h) => [h.id, h.asama]);
    // Widget önbelleği (güç, aşama, bugünkü kazanç) yeni güne göre tazelensin
    if (syncDerived(state, bugun) !== state) kaydet();
    for (const [id, onceki] of atlayanlar) asamaSonra(id, onceki);
    // Uzun yokluktan dönüş (14+ gün): kayıp grafiği yerine sıcak karşılama
    const son = ayarlar.sonAcilis;
    ayarlar.sonAcilis = bugun;
    saveSettings(ayarlar);
    if (son && addDays(son, 14) <= bugun && aktifler().length) {
      await secimIste('Hoş geldin', 'Kürelerin biraz uykuya daldı ama izleri duruyor; geri dönüş ilk seferden hızlı olur. Ara verdiğin bir alışkanlık varsa ona dokunup duraklatabilir ya da uzun basıp arşivleyebilirsin.',
        [{ id: 'tamam', yazi: 'Devam edelim', sinif: 'btn-small primary' }]);
      state = ackMisses(state, bugun); // Uzun aradan sonra her küreyi tek tek titretme
      kaydet();
    }
    kacirilanlariKontrolEt();
    bekleyenKutlamalar();
    // Süresi dolan duraklatmalar: uzat / arşivle / devam (kural 4)
    for (const h of aktifler()) {
      if (!expiredPause(h, bugun)) continue;
      const secim = await secimIste(`"${h.name}" duraklatması bitti`,
        `${DURAKLATMA_EN_UZUN} günlük duraklatma doldu. Ne yapalım?`,
        [{ id: 'devam', yazi: 'Devam et', sinif: 'btn-small primary' }, { id: 'uzat', yazi: 'Uzat' }, { id: 'arsiv', yazi: 'Arşivle' }]);
      state = answerExpiredPause(state, h.id, bugun, secim === 'uzat');
      if (secim === 'arsiv') state = setArchived(state, h.id, true);
      kaydet();
      ciz();
    }
    // Yeni başlangıç etkisi: Pazartesi ya da ayın 1'inde, ara verilmiş alışkanlık varsa
    const [, , gunNo] = bugun.split('-').map(Number);
    const pazartesi = new Date(tarihSayisi(bugun)).getDay() === 1;
    if ((pazartesi || gunNo === 1) && aktifler().some((h) => computeState(h, bugun).ardisikKacirma >= 2)) {
      bildirimGoster(pazartesi ? 'Yeni bir hafta: yeniden başlamak için güzel bir gün' : 'Yeni bir ay: yeniden başlamak için güzel bir gün');
    }
    // Otomatiklik anketi (iyi alışkanlıklar; oturumda bir kez)
    if (ayarlar.srbaiAcik !== false) {
      const aday = aktifler().find((h) => h.tip !== 'kotu' && !srbaiErtelenen.has(h.id)
        && srbaiDue(h, computeState(h, bugun), bugun));
      if (aday) setTimeout(() => { if (!document.querySelector('.modal-backdrop.open')) srbaiAc(aday); }, 2500);
    }
  } finally {
    kontrolSuruyor = false;
  }
}

// Açılış
ciz();
kayitliModeliYukle();
if (kayitBozuk) bildirimGoster('Kayıt okunamadı. Yedekten geri yükleyebilirsiniz.');
else setTimeout(acilisKontrolleri, 1200);
