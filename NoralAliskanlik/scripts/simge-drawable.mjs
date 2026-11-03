// Simge listesinden (assets/js/simgeler.js) Android vektör drawable'larını üretir.
// Çalıştırma (NoralAliskanlik içinde): node scripts/simge-drawable.mjs
// Tek kaynak simgeler.js; arayüz ve widget aynı yolları kullanır.
import { writeFileSync } from 'node:fs';
import { SIMGELER } from '../app/src/main/assets/js/simgeler.js';

const KLASOR = new URL('../app/src/main/res/drawable/', import.meta.url);

for (const s of SIMGELER) {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<!-- Üretildi: scripts/simge-drawable.mjs — elle düzenleme, simgeler.js'i düzenle. (${s.ad}) -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:pathData="${s.d}"
        android:fillColor="#00000000"
        android:strokeColor="#FFFFFFFF"
        android:strokeWidth="1.8"
        android:strokeLineCap="round"
        android:strokeLineJoin="round" />
</vector>
`;
  writeFileSync(new URL(`ikon_${s.id}.xml`, KLASOR), xml);
}
console.log(`${SIMGELER.length} simge drawable yazıldı`);
