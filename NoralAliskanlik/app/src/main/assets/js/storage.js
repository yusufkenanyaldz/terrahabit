// Kalıcı veri: Android'de JavascriptInterface (AndroidBridge) -> SharedPreferences.
// Bilgisayarda tarayıcıda denerken köprü yoktur; o zaman localStorage'a düşer.
import { migrate, emptyState } from './habits.js';
import { normalizeAyarlar } from './settings.js';

const bridge = window.AndroidBridge || null;
const DEV_KEY = 'noral-dev-data';
const DEV_AYAR_KEY = 'noral_aliskanlik_ayarlar_v1'; // Orijinal HTML'in anahtarı

/** Android içinde mi çalışıyoruz? */
export const androidMi = !!bridge;

/** Kayıtlı durumu yükler; bozuk kayıt varsa üzerine yazmamak için hatayı yukarı iletir. */
export function loadState() {
  const raw = bridge ? bridge.load() : safeLocalGet();
  return raw ? migrate(raw) : emptyState();
}

/** Durumu kaydeder (Android'de alarmlar da yeniden kurulur). */
export function saveState(state) {
  const json = JSON.stringify(state);
  if (bridge) return bridge.save(json);
  try { localStorage.setItem(DEV_KEY, json); } catch { /* tarayıcı izin vermezse geç */ }
  return true;
}

/** Yedeği Downloads'a yazar. Dönüş: { ok, message } */
export function exportBackup(state) {
  const json = JSON.stringify(state, null, 2);
  if (bridge) {
    const r = bridge.exportBackup(json);
    return r.startsWith('HATA') ? { ok: false, message: r } : { ok: true, message: r };
  }
  // Tarayıcıda: dosyayı indir.
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = 'noral-aliskanlik-yedek.json';
  a.click();
  return { ok: true, message: a.download };
}

/** Geri yükleme: Android dosya seçicisini açar; sonuç NoralApp.onImport ile gelir. */
export function requestImport(onText) {
  if (bridge) { bridge.requestImport(); return; }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = async () => input.files[0] && onText(await input.files[0].text());
  input.click();
}

/** Ayar panelinin değerleri (SharedPreferences, ayrı anahtar). */
export function loadSettings() {
  const raw = bridge ? bridge.loadSettings() : safeLocalGet(DEV_AYAR_KEY);
  return normalizeAyarlar(raw);
}

export function saveSettings(ayar) {
  const json = JSON.stringify(ayar);
  if (bridge) return bridge.saveSettings(json);
  try { localStorage.setItem(DEV_AYAR_KEY, json); } catch { /* geç */ }
  return true;
}

/**
 * Telefonda kayıtlı beyin modeli. Dönüş: { exists, url, name }.
 * url, iç depolamadaki dosyayı https://appassets.androidplatform.net/model/ altından verir.
 */
export function modelInfo() {
  if (!bridge) return { exists: false };
  try { return JSON.parse(bridge.modelInfo()); } catch { return { exists: false }; }
}

function safeLocalGet(key = DEV_KEY) {
  try { return localStorage.getItem(key); } catch { return null; }
}
