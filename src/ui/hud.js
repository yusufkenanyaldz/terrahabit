const dayBadge = document.getElementById('day-badge');
const stageTitle = document.getElementById('stage-title');
const epText = document.getElementById('ep-text');
const waterText = document.getElementById('water-text');
const tempText = document.getElementById('temp-text');
const drStatus = document.getElementById('drought-status');
const dot = document.getElementById('status-dot');

export function renderHud(view) {
  dayBadge.innerText = `SOL ${view.day} • EVRE ${view.evreNo}`;
  stageTitle.innerText = view.evreName;
  epText.innerText = `%${(view.evoRatio * 100).toFixed(1)}`;
  waterText.innerText = `${view.waterMeters} m`;
  tempText.innerText = `${view.tempC} °C`;

  if (view.droughtDays === 0) {
    drStatus.innerText = "Yüzey: Aktif Tektonik • İklim: Stabil";
    drStatus.style.color = "#94a3b8";
    dot.style.background = "#10b981";
    dot.style.boxShadow = "0 0 8px #10b981";
  } else if (view.droughtDays === 1) {
    drStatus.innerText = "İklim Uyarısı: Toz Fırtınası Başlangıcı";
    drStatus.style.color = "#fbbf24";
    dot.style.background = "#fbbf24";
    dot.style.boxShadow = "0 0 8px #fbbf24";
  } else {
    drStatus.innerText = `⚠️ Kritik Kuraklık (${view.droughtDays} Sol İhmal)`;
    drStatus.style.color = "#f87171";
    dot.style.background = "#ef4444";
    dot.style.boxShadow = "0 0 8px #ef4444";
  }
}
