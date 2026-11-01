# Nöral Alışkanlık (Android)

Three.js beyin haritası + alışkanlık takibi. WebView içinde, internetsiz çalışır.

## Klasörler
- `app/src/main/assets/` — HTML/CSS/JS (WebViewAssetLoader ile `https://appassets.androidplatform.net/assets/index.html`)
  - `js/habits.js` — alışkanlık mantığı (saf, testli)
  - `js/brain-scene.js` — 3B sahne; **sabit ayarlar** dosyanın başındaki `AYARLAR` bloğunda
  - `js/main.js` — arayüz
  - `lib/` — yerel Three.js + eklentiler + Draco çözücü (`scripts/vendor-three.mjs` ile üretilir)
  - `brain.glb` — depoda **yok** (25 MB+), aşağıya bakın
- `app/src/main/java/com/noralaliskanlik/` — Kotlin: WebView, SharedPreferences köprüsü, yedek, alarmlar

## brain.glb nasıl eklenir
1. GitHub'da repo → **Releases** → **Draft a new release**
2. Tag: `brain-model` (tam olarak bu)
3. `brain.glb` dosyasını eklere sürükle → **Publish release**
4. **Actions** → *Nöral Alışkanlık APK* → **Run workflow**

Android Studio'da kendin derlersen dosyayı `app/src/main/assets/brain.glb` olarak koy.

## Testler
Repo kökünde: `node --test "NoralAliskanlik/tests/*.test.mjs"`

Tarayıcıda deneme: `cd NoralAliskanlik/app/src/main/assets && python3 -m http.server`
→ `http://localhost:8000/?tarih=2026-03-05` (sahte gün ile kaçırılan gün / takvim denenir).
