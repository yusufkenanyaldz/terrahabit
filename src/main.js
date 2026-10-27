import { EP_PER_HABIT, loadState, toggleHabit, processNightHarvest, resetState, getView } from './state/game.js';
import { createPlanetScene } from './planet/scene.js';
import { renderHud } from './ui/hud.js';
import { bindDrawer, renderDrawer, toggleDrawer } from './ui/drawer.js';
import { bindDock, renderDock } from './ui/dock.js';
import { showToast } from './ui/toast.js';
import { vibrate } from './ui/haptics.js';

const planet = createPlanetScene(document.getElementById('canvas-container'));

function updateUI() {
  const view = getView();
  renderHud(view);
  renderDrawer(view);
  renderDock(view);
  planet.setTargets(view.vitality, view.drought);
}

// Gece hasadı sonucunu gezegene ve (simüle edilen günde) kullanıcıya yansıtır.
function applyHarvest(result, isSimulated) {
  if (result.earnedEP > 0) {
    planet.pulse(1.4);
    if (isSimulated) {
      vibrate([25, 45, 55]);
      showToast(`☀️ Sol ${result.day} Tamamlandı: +${result.earnedEP} EP Evrim!`);
    }
  } else if (isSimulated) {
    vibrate([70, 40, 70]);
    showToast(`⚠️ İhmal! Kuraklık ve Fırtına Artıyor (${result.droughtDays}. Gün)`, true);
  }
  updateUI();
}

bindDrawer({
  onToggleHabit(id) {
    if (toggleHabit(id)) {
      vibrate(25);
      planet.pulse(1.0);
      showToast(`🌱 +${EP_PER_HABIT} EP Biyo-Tohum Eklendi`);
    } else {
      vibrate(10);
    }
    updateUI();
  }
});

bindDock({
  onTasks: () => toggleDrawer(),
  onNextDay() {
    toggleDrawer(false);
    applyHarvest(processNightHarvest(), true);
  },
  onReset() {
    if (confirm('Gezegeni Sol 1 (Çorak Kaya) evresine sıfırlamak istiyor musun?')) {
      resetState();
      updateUI();
      showToast('🔄 Gezegen sıfırlandı.');
    }
  }
});

const startupHarvest = loadState();
if (startupHarvest) applyHarvest(startupHarvest, false);
updateUI();

planet.start();
