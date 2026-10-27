// Kalıcı hafıza. Anahtar tek dosyalık sürümle aynı kalır ki mevcut ilerleme kaybolmasın.
export const STORAGE_KEY = 'terrahabit_phase1_v2_save';

export function readSave() {
  return localStorage.getItem(STORAGE_KEY);
}

export function writeSave(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
