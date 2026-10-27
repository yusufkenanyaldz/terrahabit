// Oyun durumu ve kuralları. DOM'a ve Three.js'e dokunmaz; sonuçları döndürür,
// geri bildirimi (titreşim, bildirim, gezegen dalgası) çağıran taraf uygular.
import { readSave, writeSave } from './storage.js';

export const MAX_EP = 1000;
export const EP_PER_HABIT = 4;
export const HABIT_COUNT = 5;

function freshState() {
  return { day: 1, ep: 0, droughtDays: 0, completedToday: [], lastRealDate: new Date().toDateString() };
}

export let state = freshState();

export function saveState() {
  writeSave(state);
}

// Kayıt varsa yükler; gerçek takvim günü değiştiyse gece hasadını sessizce işler.
// Hasat olduysa sonucunu döndürür, olmadıysa null.
export function loadState() {
  const saved = readSave();
  let harvest = null;
  if (saved) {
    try {
      state = JSON.parse(saved);
      const todayStr = new Date().toDateString();
      if (state.lastRealDate && state.lastRealDate !== todayStr) {
        harvest = processNightHarvest();
        state.lastRealDate = todayStr;
        saveState();
      }
    } catch (e) { console.error(e); }
  }
  return harvest;
}

// Görevi işaretler/kaldırır. true: görev eklendi, false: kaldırıldı.
export function toggleHabit(id) {
  const idx = state.completedToday.indexOf(id);
  const added = idx === -1;
  if (added) state.completedToday.push(id);
  else state.completedToday.splice(idx, 1);
  saveState();
  return added;
}

// Günü kapatır. Dönen nesne: { day (kapanan sol), earnedEP, droughtDays }.
export function processNightHarvest() {
  const closedDay = state.day;
  const earnedEP = state.completedToday.length * EP_PER_HABIT;
  if (earnedEP > 0) {
    state.ep = Math.min(MAX_EP, state.ep + earnedEP);
    state.droughtDays = Math.max(0, state.droughtDays - 1);
  } else {
    state.droughtDays += 1;
    if (state.droughtDays >= 2) {
      state.ep = Math.max(0, state.ep - 5);
    }
  }
  state.day += 1;
  state.completedToday = [];
  saveState();
  return { day: closedDay, earnedEP, droughtDays: state.droughtDays };
}

export function resetState() {
  state = freshState();
  saveState();
}

// Ekranda ve gezegende gösterilecek türetilmiş değerler.
export function getView() {
  const evoRatio = state.ep / MAX_EP;
  const dailyEarned = state.completedToday.length * EP_PER_HABIT;
  const previewBoost = (dailyEarned / MAX_EP) * 0.35;
  const effectiveRatio = Math.min(1.0, evoRatio + previewBoost);

  let evreNo = 1;
  let evreName = "KEPLER-25B (Ölü Kaya)";
  if (state.ep >= 800) { evreNo = 5; evreName = "KEPLER-25B (Yörünge Uygarlığı)"; }
  else if (state.ep >= 420) { evreNo = 4; evreName = "KEPLER-25B (Canlı Biyosfer)"; }
  else if (state.ep >= 200) { evreNo = 3; evreName = "KEPLER-25B (Kıtasal Yeşerme)"; }
  else if (state.ep >= 60) { evreNo = 2; evreName = "KEPLER-25B (Hidrosfer Doğuşu)"; }

  return {
    day: state.day,
    droughtDays: state.droughtDays,
    completedToday: state.completedToday,
    evreNo,
    evreName,
    evoRatio,
    dailyEarned,
    waterMeters: Math.round(effectiveRatio * 3850),
    tempC: Math.round(-48 + effectiveRatio * 63 - state.droughtDays * 3),
    vitality: effectiveRatio,
    drought: Math.min(1.0, state.droughtDays / 3.0)
  };
}
