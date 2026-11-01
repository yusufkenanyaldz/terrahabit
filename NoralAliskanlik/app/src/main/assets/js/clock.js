// Tek saat kaynağı. Testlerde sahte tarih vermek için setNow kullanılır.
import { GUN_BASLANGIC_SAATI } from './parametreler.js';

let fakeNow = null;

/** Şu anki zaman (Date). */
export function now() {
  return fakeNow ? new Date(fakeNow.getTime()) : new Date();
}

/** Test/geliştirme: sahte saati ayarla (null = gerçek saat). */
export function setNow(date) {
  fakeNow = date ? new Date(date) : null;
}

/** Yerel tarihe göre 'YYYY-MM-DD' anahtarı. */
export function dateKey(d = now()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Bugünün anahtarı. Gün 04:00'te başlar (Spesifikasyon kural 7): gece 01:00'de
 * işaretlenen "akşam" alışkanlığı önceki güne yazılır.
 */
export function todayKey() {
  const t = now();
  t.setHours(t.getHours() - GUN_BASLANGIC_SAATI);
  return dateKey(t);
}

/** 'YYYY-MM-DD' anahtarına n gün ekle (negatif olabilir). Öğlen saati: yaz saati kaymalarından etkilenmez. */
export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0);
  date.setDate(date.getDate() + n);
  return dateKey(date);
}
