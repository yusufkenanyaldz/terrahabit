// Kalıcı veri: Android'de JavascriptInterface (AndroidBridge) -> SharedPreferences.
// Bilgisayarda tarayıcıda denerken köprü yoktur; o zaman localStorage'a düşer.
import { migrate, emptyState } from './habits.js';

const bridge = window.AndroidBridge || null;
const DEV_KEY = 'noral-dev-data';

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

function safeLocalGet() {
  try { return localStorage.getItem(DEV_KEY); } catch { return null; }
}
