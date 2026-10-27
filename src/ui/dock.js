import { HABIT_COUNT } from '../state/game.js';

const dockCount = document.getElementById('dock-count');

export function bindDock({ onTasks, onNextDay, onReset }) {
  document.getElementById('btn-tasks').addEventListener('click', onTasks);
  document.getElementById('btn-next-day').addEventListener('click', onNextDay);
  document.getElementById('btn-reset').addEventListener('click', onReset);
}

export function renderDock(view) {
  dockCount.innerText = `${view.completedToday.length} / ${HABIT_COUNT}`;
}
