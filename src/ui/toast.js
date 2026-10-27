const toastEl = document.getElementById('toast');
let toastTimer = null;

export function showToast(msg, isWarn = false) {
  toastEl.innerText = msg;
  toastEl.className = 'toast-pill show' + (isWarn ? ' warn' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.className = 'toast-pill'; }, 2400);
}
