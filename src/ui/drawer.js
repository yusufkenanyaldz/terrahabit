import { vibrate } from './haptics.js';

const drawer = document.getElementById('habit-drawer');
const backdrop = document.getElementById('backdrop');
const dailyPts = document.getElementById('daily-pts');
const habitItems = document.querySelectorAll('.habit-item');

export function toggleDrawer(force) {
  const isOpen = typeof force === 'boolean' ? force : !drawer.classList.contains('open');
  drawer.classList.toggle('open', isOpen);
  backdrop.classList.toggle('open', isOpen);
  vibrate(12);
}

export function bindDrawer({ onToggleHabit }) {
  backdrop.addEventListener('click', () => toggleDrawer(false));
  habitItems.forEach(el => {
    el.addEventListener('click', () => onToggleHabit(el.getAttribute('data-id')));
  });
}

export function renderDrawer(view) {
  dailyPts.innerText = `Tohum: +${view.dailyEarned} EP`;
  habitItems.forEach(el => {
    const id = el.getAttribute('data-id');
    el.classList.toggle('completed', view.completedToday.includes(id));
  });
}
