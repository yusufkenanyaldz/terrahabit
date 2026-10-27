// Dokunmatik/fare ile döndürme, fare tekerleği ve iki parmak (pinch) zoom.
export function createControls(container, planetGroup) {
  const controls = {
    isDragging: false,
    velX: 0.0012,
    velY: 0.0,
    targetZoom: 5.4
  };
  let prevX = 0, prevY = 0;
  let initialPinchDist = null;

  container.addEventListener('pointerdown', (e) => {
    controls.isDragging = true;
    prevX = e.clientX;
    prevY = e.clientY;
  });
  window.addEventListener('pointerup', () => { controls.isDragging = false; initialPinchDist = null; });
  window.addEventListener('pointermove', (e) => {
    if (!controls.isDragging) return;
    const dx = e.clientX - prevX;
    const dy = e.clientY - prevY;
    controls.velX = dx * 0.0055;
    controls.velY = dy * 0.0055;
    planetGroup.rotation.y += controls.velX;
    planetGroup.rotation.x = Math.max(-1.2, Math.min(1.2, planetGroup.rotation.x + controls.velY));
    prevX = e.clientX;
    prevY = e.clientY;
  });

  container.addEventListener('wheel', (e) => {
    controls.targetZoom = Math.max(2.8, Math.min(8.0, controls.targetZoom + e.deltaY * 0.003));
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      controls.isDragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (initialPinchDist) {
        const delta = initialPinchDist - dist;
        controls.targetZoom = Math.max(2.9, Math.min(7.5, controls.targetZoom + delta * 0.012));
      }
      initialPinchDist = dist;
    }
  }, { passive: true });

  return controls;
}
