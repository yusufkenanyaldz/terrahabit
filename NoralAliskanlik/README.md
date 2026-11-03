# Nöral Alışkanlık (Android)

Three.js beyin haritası + alışkanlık takibi. WebView içinde, internetsiz çalışır.

> **Her şeyin ayrıntılı anlatımı: [UYGULAMA.md](UYGULAMA.md)** — model, kurallar, veri
> biçimi, arayüz, widget, bildirimler, derleme ve geliştirici notları.
> Biriken fikirler ve kararlar: [FIKIRLER.md](FIKIRLER.md).

## Klasörler
- `app/src/main/assets/` — HTML/CSS/JS (WebViewAssetLoader ile `https://appassets.androidplatform.net/assets/index.html`)
  - `js/habits.js` — alışkanlık mantığı (saf, testli)
  - `js/guc.js` — alışkanlık gücü (H) modeli: kayıt geçmişinden baştan hesaplanır (saf, testli)
  - `js/parametreler.js` — modelin tüm sabitleri (α, λ, taban, eşikler, gün başlangıç saati)
  - `js/brain-scene.js` — 3B sahne
  - `js/settings.js` — Ayar paneli varsayılanları
  - `js/main.js` — arayüz
  - `lib/` — yerel Three.js + eklentiler + Draco çözücü (`scripts/vendor-three.mjs` ile üretilir)
- `app/src/main/java/com/noralaliskanlik/` — Kotlin: WebView, SharedPreferences köprüsü, yedek, alarmlar, ana ekran widget'ı (`AliskanlikWidget`)
- `app/src/main/res/mipmap-*` — uygulama simgesi (uyarlanabilir: ön plan + `ikon_arka_plan` rengi)

## Beyin modeli
APK'nın içinde hazır bir model var: `assets/brain.glb` (orijinal 30 MB modelden
gltf-transform ile Draco + WebP + %50 sadeleştirme, ~2 MB). Uygulama doğrudan onunla açılır.
İstenirse ⚙ → **Beyin modeli yükle** ile başka bir `.glb` seçilir; iç depolamaya
(`filesDir/model`) kopyalanır ve hazır modelin yerine her açılışta o yüklenir.
Yeni model seçilince ayarlar sıfırlanır ve Ayar paneli açılır.
Draco/WebP sıkıştırmalı modeller desteklenir (çözücü `assets/lib/draco`).

## Testler
Repo kökünde: `node --test "NoralAliskanlik/tests/*.test.mjs"`

Tarayıcıda deneme: `cd NoralAliskanlik/app/src/main/assets && python3 -m http.server`
(klasöre bir `brain.glb` koyarsan o yüklenir) → `http://localhost:8000/?tarih=2026-03-05` (sahte gün ile kaçırılan gün / takvim denenir).
