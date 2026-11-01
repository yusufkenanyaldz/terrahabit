// Arayüz: liste, detay kartı, ekleme/silme, yedek, kutlama, model yükleme, Ayar paneli.
// Oyun mantığı habits.js'te (saf, testli); 3B sahne brain-scene.js'te.
import { createBrainScene, asamaBilgisiGetir } from './brain-scene.js';
import { varsayilanAyarlar } from './settings.js';
import {
  GOAL_DAYS, addHabit, removeHabit, markDone, doneCount, isDoneOn,
  needsMissFlash, ackMisses, last30, migrate,
} from './habits.js';
import { todayKey, setNow } from './clock.js';
import {
  loadState, saveState, exportBackup, requestImport,
  loadSettings, saveSettings, modelInfo, androidMi,
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
  saveState(state);
}

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

function karsilamaGoster(acik) {
  $('welcome').classList.toggle('open', acik);
}

async function kayitliModeliYukle() {
  const info = modelInfo();
  // Tarayıcıda denerken (köprü yok) klasördeki brain.glb denenir.
  const url = info.exists ? info.url : (androidMi ? null : 'brain.glb');
  if (!url) { karsilamaGoster(true); return; }
  yuklemeGoster(true);
  const ok = await sahne.loadBrain(url);
  yuklemeGoster(false);
  if (!ok) {
    if (info.exists) bildirimGoster('Kayıtlı model açılamadı — yeni bir model seçin');
    karsilamaGoster(true);
  }
}

/** Yeni seçilen model: yükle; başarılıysa ayarları sıfırla ve Ayar panelini aç. */
async function yeniModeliYukle(url) {
  karsilamaGoster(false);
  yuklemeGoster(true);
  const ok = await sahne.loadBrain(url);
  yuklemeGoster(false);
  if (!ok) {
    bildirimGoster('Model açılamadı (.glb dosyasını kontrol edin)');
    return;
  }
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
$('welcome-upload').addEventListener('click', () => glbInput.click());
$('welcome-skip').addEventListener('click', () => karsilamaGoster(false));
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
}
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

$('btn-copy-settings').addEventListener('click', async () => {
  const jsonStr = JSON.stringify(ayarlar, null, 2);
  try {
    await navigator.clipboard.writeText(jsonStr);
  } catch {
    // WebView panoya izin vermezse eski yöntem
    const ta = document.createElement('textarea');
    ta.value = jsonStr;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    if (!ok) { bildirimGoster('Kopyalama başarısız oldu'); return; }
  }
  bildirimGoster('JSON değerleri panoya kopyalandı');
});

ayarPaneliniDoldur();

// Beyin, üst bar ile alttaki panel (liste ya da detay kartı) arasındaki boş alanda
// ortalansın; etiketler de bu alanın dışına taşmasın.
function gorunurAlanGuncelle() {
  const ust = document.querySelector('.top-bar').getBoundingClientRect().bottom;
  document.documentElement.style.setProperty('--ust-bar-h', `${Math.round(ust)}px`);
  const altPanel = document.body.classList.contains('detay-acik') ? $('detail-card') : document.querySelector('.bottom-sheet');
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
  sahne.setHabits(state.habits.map((h) => ({ id: h.id, name: h.name, icon: h.icon, count: doneCount(h) })));

  const listEl = $('habit-list-el');
  listEl.innerHTML = '';
  if (state.habits.length === 0) {
    listEl.innerHTML = '<div class="empty-hint">Henüz alışkanlık yok.<br>＋ Ekle ile ilk nöral yolunu başlat.</div>';
  }
  state.habits.forEach((h) => {
    const gun = doneCount(h);
    const yuzde = Math.min(100, Math.round((gun / GOAL_DAYS) * 100));
    const asama = asamaBilgisiGetir(gun);
    const bugunYapildi = isDoneOn(h, bugun);
    const row = document.createElement('div');
    row.className = `habit-item ${seciliId === h.id ? 'selected' : ''} ${bugunYapildi ? 'done-today' : ''}`;
    row.innerHTML = `
      <div class="habit-item-top">
        <span>${esc(h.icon)} ${esc(h.name)}${bugunYapildi ? '<span class="done-mark">✓</span>' : ''}</span>
        <span class="habit-day-badge">Gün ${gun} / ${GOAL_DAYS} (${asama.kisa})</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${yuzde}%; background:${asama.hex};"></div>
      </div>`;
    uzunBasmaBagla(row, () => aliskanlikSec(h.id), () => silmeOnayi(h));
    listEl.appendChild(row);
  });

  cizDetay();
}

const HALKA_CEVRE = 2 * Math.PI * 27; // index.html'deki halka (r=27)

function cizDetay() {
  const h = state.habits.find((x) => x.id === seciliId);
  document.body.classList.toggle('detay-acik', !!h);
  if (!h) {
    $('detail-card').classList.remove('visible');
    gorunurAlanGuncelle();
    return;
  }
  const bugun = todayKey();
  const gun = doneCount(h);
  const asama = asamaBilgisiGetir(gun);
  const oran = Math.min(gun / GOAL_DAYS, 1);

  $('det-icon').textContent = h.icon;
  $('det-name').textContent = h.name;
  const stageEl = $('det-stage');
  stageEl.textContent = asama.kisa;
  stageEl.style.background = `${asama.hex}22`;
  stageEl.style.color = asama.hex;
  stageEl.style.border = `1px solid ${asama.hex}66`;
  $('det-time').textContent = `⏰ ${h.time}`;

  // İlerleme halkası
  $('det-days').textContent = gun;
  const halka = $('det-ring');
  halka.style.stroke = asama.hex;
  halka.style.color = asama.hex;
  halka.style.strokeDashoffset = String(HALKA_CEVRE * (1 - oran));
  $('det-percent').textContent = gun >= GOAL_DAYS ? 'Artık otomatik!' : `%${Math.round(oran * 100)} otomatikleşti`;

  // Son 30 gün: yapıldı / kaçırıldı / bugün
  const cal = $('det-calendar');
  cal.innerHTML = '';
  last30(h, bugun).forEach((d) => {
    const dot = document.createElement('div');
    dot.className = `cal-dot ${d.status}${d.isToday ? ' is-today' : ''}`;
    cal.appendChild(dot);
  });

  const btn = $('btn-do-today');
  const yapildi = isDoneOn(h, bugun);
  btn.disabled = yapildi;
  btn.textContent = yapildi ? 'Bugün tamamlandı ✓' : 'Bugün yaptım';
  $('detail-card').classList.add('visible');
  gorunurAlanGuncelle();
}

function aliskanlikSec(id) {
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

// "Bugün yaptım": günde yalnızca bir kez
$('btn-do-today').addEventListener('click', () => {
  if (!seciliId) return;
  const r = markDone(state, seciliId, todayKey());
  if (!r.changed) return;
  state = r.state;
  kaydet();
  ciz();
  if (r.reachedGoal) kutlamaGoster(state.habits.find((h) => h.id === seciliId));
  else bildirimGoster('+1 gün — nöral yol güçleniyor');
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

async function silmeOnayi(h) {
  const evet = await onayIste('Alışkanlık silinsin mi?',
    `"${h.icon} ${h.name}" ve ${doneCount(h)} günlük kaydı silinecek. Bu işlem geri alınamaz.`, 'Sil');
  if (!evet) return;
  state = removeHabit(state, h.id);
  if (seciliId === h.id) { seciliId = null; sahne.select(null); }
  kaydet();
  ciz();
  bildirimGoster('Alışkanlık silindi');
}

// -------------------------------------------------------------------------
// Açılır pencereler
// -------------------------------------------------------------------------
let onayCoz = null;
function onayIste(baslik, metin, evetYazi = 'Evet') {
  $('confirm-title').textContent = baslik;
  $('confirm-text').textContent = metin;
  $('confirm-yes').textContent = evetYazi;
  $('modal-confirm').classList.add('open');
  return new Promise((resolve) => { onayCoz = resolve; });
}
function onayKapat(sonuc) {
  $('modal-confirm').classList.remove('open');
  if (onayCoz) { onayCoz(sonuc); onayCoz = null; }
}
$('confirm-yes').addEventListener('click', () => onayKapat(true));
$('confirm-no').addEventListener('click', () => onayKapat(false));

// Alışkanlık ekleme
const EMOJILER = ['💧', '📚', '🏃', '🧘', '🌙', '🍎', '💪', '✍️', '🎸', '🧠', '🚭', '☀️', '🦷', '💊', '🚶', '🙏'];
let secilenEmoji = EMOJILER[0];
const emojiGrid = $('emoji-grid');
EMOJILER.forEach((em) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'emoji-btn';
  b.textContent = em;
  b.addEventListener('click', () => {
    secilenEmoji = em;
    $('add-emoji').value = '';
    emojiGrid.querySelectorAll('.emoji-btn').forEach((x) => x.classList.toggle('selected', x === b));
  });
  emojiGrid.appendChild(b);
});

/** Yazılan metnin ilk karakteri (emoji birden çok kod noktasından oluşabilir). */
function ilkGrafem(s) {
  const t = s.trim();
  if (!t) return '';
  if (window.Intl && Intl.Segmenter) {
    const it = new Intl.Segmenter('tr', { granularity: 'grapheme' }).segment(t)[Symbol.iterator]();
    return it.next().value?.segment || '';
  }
  return Array.from(t)[0];
}

$('btn-add').addEventListener('click', () => {
  $('add-form').reset();
  $('add-time').value = '09:00';
  secilenEmoji = EMOJILER[0];
  emojiGrid.querySelectorAll('.emoji-btn').forEach((x, i) => x.classList.toggle('selected', i === 0));
  $('modal-add').classList.add('open');
  setTimeout(() => $('add-name').focus(), 50);
});
$('add-cancel').addEventListener('click', () => $('modal-add').classList.remove('open'));
$('add-form').addEventListener('submit', (e) => {
  e.preventDefault();
  try {
    const ozel = ilkGrafem($('add-emoji').value);
    state = addHabit(state, {
      name: $('add-name').value,
      icon: ozel || secilenEmoji,
      time: $('add-time').value,
    }, todayKey());
  } catch (err) {
    bildirimGoster(err.message);
    return;
  }
  $('modal-add').classList.remove('open');
  $('add-name').blur();
  kaydet();
  aliskanlikSec(state.habits.at(-1).id);
  bildirimGoster('Alışkanlık eklendi — hatırlatma kuruldu');
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

// 66. gün kutlaması
function kutlamaGoster(h) {
  if (!h) return;
  sahne.celebrate(h.id);
  $('cel-icon').textContent = h.icon;
  $('cel-sub').textContent = `"${h.name}" ${GOAL_DAYS} gündür nöral yolunda. Bazal gangliyona yerleşti!`;
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
    ? `${kacirilan[0].icon} ${kacirilan[0].name}: kaçırılan gün var — sayaç korunuyor`
    : `${kacirilan.length} alışkanlıkta kaçırılan gün var — sayaçlar korunuyor`);
  state = ackMisses(state, bugun); // Animasyon bir daha oynamasın
  kaydet();
}

// -------------------------------------------------------------------------
// Android köprüsü için genel fonksiyonlar (MainActivity çağırır)
// -------------------------------------------------------------------------
window.NoralApp = {
  /** Geri tuşu: açık pencere varsa kapat ve true döndür. */
  handleBack() {
    if ($('menu').classList.contains('open')) { menuAc(false); return true; }
    if ($('celebration').classList.contains('open')) { $('celebration').classList.remove('open'); return true; }
    if ($('modal-confirm').classList.contains('open')) { onayKapat(false); return true; }
    for (const id of ['modal-add', 'modal-backup']) {
      if ($(id).classList.contains('open')) { $(id).classList.remove('open'); return true; }
    }
    if ($('settings-panel').classList.contains('open')) { ayarPaneliAc(false); return true; }
    if (seciliId) { detayKapat(); return true; }
    return false;
  },
  /** Uygulama öne gelince: gün değişmiş olabilir. */
  onResume() {
    ciz();
    kacirilanlariKontrolEt();
  },
  /** Seçilen yedek dosyasının içeriği. */
  onImport(metin) { yedekGeldi(metin); },
  /** Model dosyası iç depolamaya kopyalanmaya başladı (büyük dosyada birkaç saniye). */
  onModelCopyStart() {
    karsilamaGoster(false);
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
    if (!modelInfo().exists) karsilamaGoster(true);
  },
};

// Açılış
ciz();
kayitliModeliYukle();
if (kayitBozuk) bildirimGoster('Kayıt okunamadı. Yedekten geri yükleyebilirsiniz.');
else setTimeout(kacirilanlariKontrolEt, 1200);
