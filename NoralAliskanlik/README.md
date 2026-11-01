# Nöral Alışkanlık (Android)

Three.js beyin haritası + alışkanlık takibi. WebView içinde, internetsiz çalışır.

## Klasörler
- `app/src/main/assets/` — HTML/CSS/JS (WebViewAssetLoader ile `https://appassets.androidplatform.net/assets/index.html`)
  - `js/habits.js` — alışkanlık mantığı (saf, testli)
  - `js/brain-scene.js` — 3B sahne
  - `js/settings.js` — Ayar paneli varsayılanları
  - `js/main.js` — arayüz
  - `lib/` — yerel Three.js + eklentiler + Draco çözücü (`scripts/vendor-three.mjs` ile üretilir)
- `app/src/main/java/com/noralaliskanlik/` — Kotlin: WebView, SharedPreferences köprüsü, yedek, alarmlar

## Beyin modeli
APK'da model yoktur. İlk açılışta **Beyin modeli yükle** ile telefondaki `.glb` seçilir;
uygulamanın iç depolamasına (`filesDir/model`) kopyalanır ve her açılışta oradan yüklenir.
Yeni model seçilince eskisinin yerine geçer, ayarlar sıfırlanır ve Ayar paneli açılır.
Draco/WebP sıkıştırmalı modeller desteklenir (çözücü `assets/lib/draco`).

## Testler
Repo kökünde: `node --test "NoralAliskanlik/tests/*.test.mjs"`

Tarayıcıda deneme: `cd NoralAliskanlik/app/src/main/assets && python3 -m http.server`
(klasöre bir `brain.glb` koyarsan o yüklenir) → `http://localhost:8000/?tarih=2026-03-05` (sahte gün ile kaçırılan gün / takvim denenir).
