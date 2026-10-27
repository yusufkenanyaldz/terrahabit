export function vibrate(ms) {
  if (navigator.vibrate) navigator.vibrate(ms);
}
