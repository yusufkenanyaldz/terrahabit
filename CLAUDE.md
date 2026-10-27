# TerraHabit
Kişisel kullanım için alışkanlık takip uygulaması. Alışkanlıklar tamamlandıkça 3D bir gezegen çorak kayadan yaşayan bir dünyaya dönüşür. Hedef: Android telefon, dikey ekran.
Teknoloji: Vite + düz JavaScript, Three.js (npm), GLSL shader'lar, Capacitor (Android), APK GitHub Actions'ta derlenir.

## Kurallar
- src/state Three.js ve DOM'dan bağımsızdır; tüm oyun mantığı orada ve testlidir (Vitest).
- Tarih/saat için doğrudan new Date() kullanma; src/state/clock.js üzerinden al (test ve geliştirici modu için sahte saat).
- Kayıt formatına alan eklerken sürüm numarasını artır ve eski kayıtları taşıyan bir migration yaz. Kullanıcının verisi asla kaybolmamalı.
- Shader'lar src/planet/shaders altında .glsl dosyalarında.
- Mobil bütçe: hedef 30-60 fps, telefon ısınmamalı. Ağır hesapları her karede değil, bir kez yapıp dokuya yaz.
- Görsel tarzı (koyu uzay, cam paneller, TerraGenesis tarzı gerçekçi gezegen) koru.
- Tüm metinler Türkçe.
- Yeni npm paketi eklemeden önce sor.

## Çalışma biçimi
- Kullanıcı programcı değil; her adımdan sonra nasıl test edeceğini Türkçe ve kısa anlat.
- İsteneni yap, fazlasını ekleme. Her adım sonunda testleri ve build'i çalıştır.
