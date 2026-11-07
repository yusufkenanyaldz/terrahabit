# Nöral Alışkanlık — uygulamanın tamamı

Bu dosya uygulamanın ne olduğunu, nasıl çalıştığını ve her parçanın nerede durduğunu
anlatır. Amaç: aylar sonra (ya da bu konuşmayı hatırlamayan biri) açıp okuyunca
her şeyi anlayabilsin.

Kısa giriş için `README.md`, biriken fikirler ve kararlar için `FIKIRLER.md`.

---

## 1. Ne yapar

Kişisel alışkanlık takibi. Tek kullanıcı (uygulamanın sahibi), tek telefon, internet yok.

Ayırt edici yanı: alışkanlığın ne kadar yerleştiğini **bilimsel bir modelle** hesaplar ve
bunu 3B bir beyin üzerinde gösterir. Her alışkanlık, prefrontal korteksten (çaba) bazal
gangliyona (otomatiklik) uzanan bir yol üzerinde ilerleyen bir küredir. Alışkanlık
güçlendikçe küre yolda ilerler ve rengi değişir.

"66 günde alışkanlık oluşur" basitliğinden kaçınır: kaçırılan günler, hastalık, tatil,
miktarlı takip, kötü alışkanlık bırakma ve kişisel hız farkı modelin içindedir.

---

## 2. Mimari

Android uygulaması, içinde tam ekran bir WebView. Arayüz ve 3B sahne HTML/CSS/JS;
veri, bildirim, widget ve dosya işleri Kotlin.

```
NoralAliskanlik/
├─ app/src/main/
│  ├─ assets/              → WebView içeriği (yerel, internetsiz)
│  │  ├─ index.html        → tüm ekranların iskeleti
│  │  ├─ css/style.css     → tüm görünüm
│  │  ├─ js/               → aşağıda tek tek
│  │  ├─ lib/              → Three.js r186 + eklentiler + Draco çözücü
│  │  ├─ fonts/            → Plus Jakarta Sans (woff2)
│  │  └─ brain.glb         → hazır beyin modeli (~1,9 MB)
│  ├─ java/com/noralaliskanlik/  → Kotlin
│  └─ res/                 → widget düzenleri, simgeler, uygulama simgesi
├─ tests/                  → Node test (50 test)
├─ scripts/                → yardımcı betikler
└─ tasarim/                → simge kaynakları ve hazırlama betikleri
```

WebView içeriği `file://` ile değil, **WebViewAssetLoader** ile
`https://appassets.androidplatform.net/assets/index.html` adresinden yüklenir. Sebep:
`file://` altında modül içe aktarma (ES modules) ve bazı tarayıcı güvenlik kuralları
çalışmıyor.

### assets/js dosyaları

| Dosya | İşi |
|---|---|
| `parametreler.js` | Modelin **tüm** sabitleri. Model ayarı gerekirse yalnız burası değişir. |
| `guc.js` | Alışkanlık gücü (H) modeli. Saf fonksiyon: H hiçbir yerde saklanmaz, her seferinde kayıt geçmişinden baştan hesaplanır. |
| `habits.js` | Alışkanlık mantığı: ekleme, işaretleme, mazeret, duraklatma, arşiv, çöp kutusu, kayıt taşıma. DOM ve Three.js bilmez, testlidir. |
| `clock.js` | Tek saat kaynağı. Kodun hiçbir yerinde doğrudan `new Date()` yok; test ve geliştirici modu sahte saat verebilsin diye. |
| `simgeler.js` | 12 çizgi simgenin kimliği, adı ve SVG yolu. Arayüz ve widget aynı kaynaktan beslenir. |
| `settings.js` | Ayar paneli varsayılanları ve doğrulaması. |
| `storage.js` | Kaydetme/okuma; Android köprüsü varsa oraya, yoksa `localStorage`'a (tarayıcıda deneme). |
| `brain-scene.js` | 3B sahne: model yükleme, küreler, yol, etiketler, kamera, performans. |
| `main.js` | Arayüz: liste, detay kartı, formlar, pencereler, kutlama, ayar paneli. |

### Kotlin dosyaları

| Dosya | İşi |
|---|---|
| `MainActivity.kt` | Tek ekran: tam ekran WebView, geri tuşu, ön plana dönüş, dosya seçici. |
| `WebAppBridge.kt` | JS'in Android'e eriştiği köprü (`window.AndroidBridge`): kayıt, ayarlar, yedek, model, bildirim izni. |
| `HabitStore.kt` | Verinin tek kaynağı: SharedPreferences içinde tek JSON metni. Bildirim ve widget için gereken alanları okur. |
| `AlarmScheduler.kt` | Her alışkanlık için bir sonraki hatırlatma saatine tam alarm kurar. |
| `ReminderReceiver.kt` | Saat gelince: gerekiyorsa bildirim gösterir, yarının alarmını kurar. |
| `DoneReceiver.kt` | Bildirimdeki "Yaptım" düğmesi. |
| `BootReceiver.kt` | Telefon yeniden başlayınca / uygulama güncellenince alarmları geri kurar. |
| `AliskanlikWidget.kt` | Ana ekran widget'ı: beyin, ışıklı yollar (kodda çizilen bitmap), satırlar. |
| `ModelStore.kt` | Kullanıcının seçtiği `.glb` modelini iç depolamada tutar. |

---

## 3. Veri biçimi (sürüm 4)

Tek bir JSON. SharedPreferences içinde `noral_aliskanlik/data` anahtarında durur —
`localStorage`'da değil, çünkü uygulama güncellenince silinmemeli.

```jsonc
{
  "version": 4,
  "habits": [ /* aşağıdaki alanlar */ ],
  "cop": [ { "silinme": "2026-11-01", "habit": { /* silinen alışkanlık */ } } ]
}
```

Bir alışkanlık:

| Alan | Anlamı |
|---|---|
| `id`, `name` | Kimlik ve ad (en fazla 40 karakter) |
| `ikon` | Simge kimliği (`simgeler.js`). v4 ile geldi. |
| `icon` | Eski emoji alanı. Artık kullanılmıyor, yedek uyumu için duruyor. |
| `time` | Hatırlatma saati `"HH:MM"` |
| `createdAt` | Oluşturulma günü `"YYYY-AA-GG"` |
| `done` | Yapıldı işaretli günler |
| `gunMiktar` | Miktarlı takipte gün → miktar (`{"2026-11-03": 10}`) |
| `gecKayit` | Geç işaretlenen günler (kazanımın yarısını verir) |
| `mazeret` | Mazeretli günler (hastalık vb.) |
| `duraklatmalar` | `[{ "bas": "...", "bit": "..." }]` |
| `zamanlama` | `{tur:"gunluk"}` / `{tur:"gunler", gunler:[1,3,5]}` / `{tur:"haftalik", hedef:3}` |
| `miktar` | `{hedef: 10, birim: "sayfa"}` ya da `null` |
| `zorluk` | `kolay` / `normal` / `zor` |
| `tip` | `iyi` (kazanmak) / `kotu` (bırakmak) |
| `srbai` | Otomatiklik anketi ölçümleri `[{tarih, S, asama}]` |
| `arsiv` | Arşivde mi |
| `missAck`, `celebrated` | Kaçırma animasyonu ve 66. gün kutlaması için |
| `guc`, `asama`, `bakim`, `widget` | **Türetilmiş** alanlar: JS hesaplar, Kotlin (bildirim/widget) okur |

### Sürüm geçişleri

Kayıt biçimine alan eklenince sürüm artar ve `migrate()` içine taşıma adımı yazılır.
Eski kayıt asla bozulmaz.

- **v1 → v2:** zorluk, tip, zamanlama, mazeret, duraklatmalar, arşiv, srbai eklendi.
  Eski alışkanlıklar "her gün, normal, iyi" sayıldı — hesap değişmedi.
- **v2 → v3:** miktar, gunMiktar, gecKayit ve üst düzeyde çöp kutusu eklendi.
- **v3 → v4:** `ikon` eklendi. Eski emoji simgesi karşılığına çevrildi
  (📚 → kitap, 🚭 → yasak), karşılığı yoksa `genel` oldu.

### Türetilmiş alanlar neden var

Bildirimler ve widget Kotlin tarafında çalışır; orada JS modelini çalıştırmak mümkün
değil. Bu yüzden JS her kayıtta `guc`, `asama`, `bakim` ve `widget` önbelleğini yazar.

`widget` önbelleği özel: `{bugun, H0, a, asama0}`. H0 bugün hariç güç, `a` bugün tam
yapılırsa etkin kazanım. Widget'tan ✓ veya +1 yapılınca Kotlin
`H = H0 + a·q·(1 − H0)` ile yeni gücü kendi hesaplar — uygulama açılmadan yüzde doğru
görünsün diye. (Testle uygulamanın hesabıyla aynı olduğu doğrulanıyor.)

---

## 4. Güç modeli

### Temel

`H` 0–1 arası "alışkanlık gücü". Her planlı fırsat için:

- **Yapıldı:** `H ← H + α · (1 − H)`
- **Kaçırıldı:** `H ← taban + (H − taban) · (1 − λ)`

`α` kazanım hızı, `λ` çözülme hızı, `taban = 0,25 · P` (P = bugüne kadar ulaşılan en
yüksek güç; "iz"). Taban yüzünden güç asla sıfıra dönmez: bir kez kazanılmış alışkanlık
tamamen silinmez.

**Tasarruf etkisi:** `H < P` iken kazanım `α · (1 + 0,5 · P)` ile hızlanır. Geri dönüş
ilk seferden hızlıdır.

### Sabitler (`parametreler.js`)

| Sabit | Değer | Anlamı |
|---|---|---|
| `ALFA` | 0,045 | Normal zorlukta kazanım hızı |
| `ZORLUK_T` | kolay 60, normal 66, zor 90 | Hedef gün sayısı (Lally ve ark.: içme 59, yeme 65, egzersiz 91) |
| `LAMBDA_ILK` | 0,01 | İlk kaçırmada çözülme (tepede ≈0,7 puan) |
| `LAMBDA_ARDISIK` | 0,02 | Art arda ikinci ve sonraki kaçırmalar |
| `TABAN_ORANI` | 0,25 | Taban = 0,25 · P |
| `TASARRUF` | 0,5 | Geri dönüş hızlandırması |
| `ASAMA_YUKARI` | 0,50 / 0,845 / 0,95 | Aşama atlama eşikleri |
| `ASAMA_ASAGI` | 0,45 / 0,795 / 0,90 | Aşama düşme eşikleri (histerezis) |
| `GUN_BASLANGIC_SAATI` | 4 | Gün 04:00'te başlar |
| `GERIYE_DONUK_GUN` | 3 | Serbest geriye dönük işaretleme |

Kusursuz takipte: **16. gün** Tekrar, **41. gün** Yerleşiyor, **66. gün** Otomatik.
Haftada bir kaçırmada Otomatik 81. güne, zor alışkanlıkta 107. güne kayar.

### Aşamalar

| # | İyi alışkanlık | Kötü alışkanlık | Renk |
|---|---|---|---|
| 0 | Çaba | Çaba | `#ff7b1c` turuncu |
| 1 | Tekrar | Direnç | `#a855f7` mor |
| 2 | Yerleşiyor | Güçleniyor | `#0ea5e9` gök mavisi |
| 3 | Otomatik | Özgür | `#00e5ff` camgöbeği |

Kötü alışkanlıkta adlar farklı, çünkü "Yerleşiyor" okununca sanki alışkanlık
yerleşiyormuş gibi duruyordu; oysa güçlenen şey bırakma.

Aşama sınırlarında histerezis var: yukarı çıkış ve aşağı iniş eşikleri farklı, böylece
sınırda küre ileri geri titremez.

### Küre nerede durur

`yolKonumu(H)` parçalı doğrusal eşleme: her aşamaya yolun eşit payı düşer
(0 → 0, 0,50 → ¼, 0,845 → ½, 0,95 → ¾, 1 → 1). Böylece aşama atlamak yolda hep aynı
mesafeye denk gelir. Detay kartındaki mini yol da aynı fonksiyonu kullanır.

---

## 5. Kurallar

Modelin kenar durumları. Her biri testlidir (`tests/kurallar.test.mjs`).

1. **Zamanlama** — Her gün / belirli günler / haftada N. Belirli günlerde planlı olmayan
   gün ne kazandırır ne kaybettirir. Haftalık hedefte hafta içinde telafi mümkündür;
   kaçırma ancak hafta kapanınca sayılır. Haftalık hedefte tekrar sayısı
   `T · √(n/7)` ile ölçeklenir.
2. **Mazeret** — Hastalık vb. Kayan 30 günde en fazla 4 gün; H değişmez. Fazlası kaçırma
   sayılır. Yalnız son 3 gün + bugün için işaretlenebilir.
3. **Duraklatma** — Tatil/seyahat. H donar, en fazla 30 gün. Süre dolunca uygulama sorar.
4. **Kötü alışkanlık** — Temiz gün kazanım, kayma kaçırma sayılır. Son 7 günde 3+ kayma
   "nüks" sayılır ve nazik bir mesaj çıkar. Günlük sınırlı olabilir (ör. en fazla 5).
5. **Miktarlı takip** — Günlük hedef (8 bardak, 10 sayfa). Oran `q = yapılan/hedef`.
   `q ≥ 0,5` ise kazanım `α · q`, altındaysa kısmi kaçırma (`λ · (1 − q)`).
6. **Gün 04:00'te başlar** — Gece 01:00'de yapılan "akşam" alışkanlığı önceki güne yazılır.
7. **Geriye dönük kayıt** — Son 3 gün + bugün serbestçe işaretlenir/kaldırılır.
8. **Geç kayıt** — 4–14 gün öncesi de işaretlenebilir ama kazanımın yalnızca yarısını verir.
9. **Çöp kutusu** — Silinen alışkanlık 30 gün durur, sonra kalıcı silinir. Arşivlenen ise
   süresiz durur ve geri açılabilir.
10. **Otomatiklik anketi (SRBAI)** — 14 günde bir (bakım modunda 30) dört madde, 1–7.
    Üst üste iki ölçümde hesaplanan H ile hissedilen otomatiklik arasında %15'ten fazla
    fark olursa kişisel hedef süre T %10 kaydırılır (30–150 gün arası).
11. **Bakım modu** — H ≥ 0,95 on dört gün sürerse hatırlatmalar seyrelir; yalnız dün
    kaçırıldıysa hatırlatır.
12. **İki gün kuralı** — Seri, tek kaçırmayla bozulmaz; art arda iki kaçırma bozar.
13. **Çaba uyarısı** — Aynı anda 3 alışkanlık Çaba aşamasındaysa yenisini eklerken
    uyarır. Engel değil, formun içinde bir satır.
14. **Geri dönüş vaadi** — Daha önce Otomatik'e ulaşmış ama düşmüş alışkanlık için
    "düzenli devam edersen ~N günde geri dönersin" denir. Bu sayı uydurulmaz, modelin
    kendisiyle ileri simüle edilerek bulunur.

---

## 6. Arayüz

### Ana ekran

Üstte başlık ve ⚙ düğmesi, ortada 3B beyin, altta alışkanlık listesi.

- **Liste** satırı: simge (aşama renginde), ad, "Güç %7 · Çaba · 0/10", onay düğmesi.
  Miktarlı alışkanlıkta onay yerine "+1"; **uzun basınca miktar hedefe çekilir**.
- Listenin üstündeki tutamak listeyi genişletir/daraltır (135 px ↔ 54vh). Liste
  büyüdükçe beyin ekranda kalsın diye kamera oransal olarak uzaklaşır; kullanıcının
  kendi yakınlaştırması korunur.
- Satıra uzun basmak arşivleme/silme penceresini açar. Kalıcı silme **kaydırarak**
  onaylanır.

### Beyin etiketleri

Her alışkanlık için küçük bir etiket: **simge + yüzde**. Ad yazmaz (beynin yarısını
kapatıyordu); ada dokununca açılan detay kartından ve alttaki listeden ulaşılır.
Bölge etiketleri ("ÇABA / Prefrontal Korteks" vb.) kaldırıldı.

Simge beyinde kimliği tek başına taşıdığı için ekleme formunda başka bir alışkanlığın
kullandığı simgeler soluk gösterilir.

### Detay kartı

Alışkanlığa dokununca liste yerine açılır:

- Başlık: simge, ad, güç yüzdesi (aşama renginde), aşama etiketi, sıklık ve saat
- **Mini nöral yol:** 0 → ~T günü arasında kayan küre; ana sahnedeki yolun küçük hâli,
  çentikler aşama sınırları
- Son 30 gün noktaları, seri ve oran
- İşaretle satırı: son 3 gün + bugün (geçmiş sönük, bugün vurgulu)
- Miktarlı alışkanlıkta −/+ sayaç
- Duraklatma bandı, nazik notlar (nüks / geri dönüş vaadi)

### Ekleme formu

Alttan açılır, beyin üstte görünür kalır. Alanlar: ad, simge (12 seçenek), hatırlatma
saati, tür (kazanmak/bırakmak), sıklık, günlük miktar (isteğe bağlı), zorluk.
Yeni alışkanlık **kaydırarak** onaylanır ("Başlatmak için küreyi kaydır");
düzenlemede sıradan Kaydet düğmesi vardır.

Kaydırarak onay yalnız nadir ve geri dönüşü olmayan işlerde kullanılır: ilk oluşturma ve
kalıcı silme. Günlük tamamlama tek dokunuştur.

### Simgeler

12 çizgi simge: Genel, Kitap, Dinleme, Yazma, Konuşma, Su, Spor, Dışarı, Sağlık, Uyku,
Zaman, Bırakma. Tek kaynak `js/simgeler.js`; widget için Android vektör çizimleri
`node scripts/simge-drawable.mjs` ile aynı yollardan üretilir.

---

## 7. 3B sahne

- **Model:** `assets/brain.glb`, orijinal 30 MB modelden gltf-transform ile Draco + WebP
  + %50 sadeleştirme ile ~1,9 MB'a indirildi. ⚙ → "Beyin modeli yükle" ile başka bir
  `.glb` seçilebilir; iç depolamaya kopyalanır.
- **Yol:** prefrontal korteks ile bazal gangliyon arasında eğri. Küreler bu eğri
  üzerinde `yolKonumu(H)` noktasında durur. Güçleri yakın küreler üst üste binmesin
  diye altın açıyla yoldan yanlara açılırlar (adım 0,24; küre çapı 0,21).
- **Görünür alan:** `setGorunurAlan(ust, alt)` panellerle kapanmayan dikey alanı alır;
  görüntü o alanın ortasına kaydırılır (`setViewOffset`, ek çizim maliyeti yok) ve alan
  daraldıkça kamera oransal olarak uzaklaşır.
- **Performans:** piksel oranı en çok 2; bloom düşük çözünürlükte; etiketler `transform`
  ile taşınır (sayfa yerleşimi yeniden hesaplanmaz); her karede yeni nesne üretilmez.
  Telefon zorlanırsa (2 sn boyunca < 45 fps) çizim çözünürlüğü kademeli düşer, yalnız
  aşağı iner.
- **Ağ görünümü (⚙ menüsü):** yüklü modelin köşelerinden açılışta bir kez üretilen düğüm
  ağı, gerçekçi beynin üstüne biner. Renk ön-arka eksenine göre: önü turuncu (çaba), arkası
  mavi (otomatiklik), arası mor. Düğümler shader'da yanıp söner.
  **"Yarısı gerçek, yarısı ağ" görüntüsü hata değil, bırakılmalı.** Sebebi ışık: güçlü ana
  ışık (3,5; 4,5; 3) bir yandan vuruyor, karşı taraf yalnız zayıf mavi kenar ışığı alıyor.
  Aydınlık yarıda soluk-parlak beyin yüzeyi ağı örtüyor, karanlık yarıda ağ öne çıkıyor.
  Gezegendeki gece-gündüz çizgisi gibi; beyin döndükçe çizgi de yumuşakça kayar, titremez.
  Kullanıcı ilk gördüğünde "tahmin etmediğimiz, çok güzel bir hata" dedi.
- **Şeffaf mod:** beyin yarı saydam çizilir, küreler içeriden görünür. Fresnel
  shader'ında negatif tabanın kuvveti alınınca NaN oluşup görüntü anlık kopuyordu;
  taban kıskaçlandı ve NaN koruması eklendi.

---

## 8. Widget

Saydam, 4×3. Duvar kâğıdının üstünde beyin, ondan çıkan ışıklı yollar ve satırlar.

- Yollar kodda `Canvas` ile çizilip bitmap olarak konur (~600 KB sınırı). Her yol,
  beyinde alışkanlığın gücüne denk gelen noktadan çıkar ve satırın ortasında biter.
- Satır: **simge → sayılar → "+" → onay**. Ad yazmaz. Sayılara ayrılan yer dar olduğu
  için metin uzadıkça punto düşer (10 karakterden sonra 10 sp, 12'den sonra 9 sp);
  "10/10 · %100" ve "Duraklatıldı" da sığsın diye.
- En fazla 4 satır; widget'ın yüksekliğine göre sığan kadarı gösterilir.
- ✓ bugünü işaretler (miktarlıda hedefe çeker), "+" bir tane ekler. Uygulama açılmadan
  yüzde de güncellenir (bkz. `widget` önbelleği).
- Aşama renkleri uygulamadakiyle aynı; `HabitStore.ASAMA_RENK` ve
  `brain-scene.js` birlikte güncellenmeli.

---

## 9. Bildirimler

- Her alışkanlık için kendi saatinde tam alarm (`setExactAndAllowWhileIdle`).
- Bildirim **gönderilmez** ise: bugün yapıldıysa, mazeretliyse, duraklatıldıysa, o gün
  planlı değilse, haftalık hedefe ulaşıldıysa, günlük sınırlı kötü alışkanlıksa, ya da
  bakım modundaysa (dün kaçırılmadıkça).
- Bildirimde "Yaptım" düğmesi var; dokununca uygulama açılmadan işaretlenir.
- Telefon yeniden başlayınca alarmlar `BootReceiver` ile geri kurulur.
- İzinler: `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `USE_EXACT_ALARM`.

---

## 10. Yedekleme

⚙ → Yedek al: JSON dosyası İndirilenler klasörüne yazılır. ⚙ → Yedek geri yükle:
dosya seçilir, doğrulanır ve taşınır. Bozuk yedek mevcut veriyi ezmez — `migrate()`
hata fırlatır.

Yedek almak elle yapılır; otomatik yedekleme `FIKIRLER.md` içinde öneri olarak duruyor.

---

## 11. Ayarlar (⚙ menüsü)

Menü maddeleri: **Beyin modeli yükle**, **Şeffaf mod**, **Kesit görünümü**,
**Model ayarları**, **Yedekle / geri yükle**, **Arşiv ve silinenler**,
**Otomatiklik anketi**.

"Model ayarları" paneli: model döndürme (X/Y/Z), bölge konumları (prefrontal ve bazal
gangliyon), model kaynağı/yazar (CC BY), sıfırla.

Hazır model için kullanıcının ayarladığı değerler varsayılan olarak kayıtlıdır
(`settings.js`): prefrontal `{1.06, 0.24, 0}`, bazal gangliyon `{-0.32, 0.18, 0.08}`.

---

## 12. Derleme

GitHub Actions: `.github/workflows/noral-apk.yml`. Her push'ta çalışır.

1. Testler (`node --test "NoralAliskanlik/tests/*.test.mjs"`)
2. İmza anahtarını depo gizlilerinden hazırla
3. `assembleDebug` (imzalı)
4. APK'yı `NoralAliskanlik-<run>-debug` adıyla yükle

İmzalı olduğu için yeni sürüm eskisinin üstüne kurulur, veri kaybolmaz.
**İmza anahtarı asla depoya girmez** (`.gitignore`); gizliler GitHub'da, yedeği
kullanıcının Drive'ında.

minSdk 26 (Android 8), targetSdk 36.

---

## 13. Testler

`node --test "NoralAliskanlik/tests/*.test.mjs"` — 50 test:

| Dosya | Kapsam |
|---|---|
| `guc.test.mjs` | Model eğrisi, aşama günleri, spesifikasyon senaryoları |
| `habits.test.mjs` | Ekleme/silme/işaretleme, kayıt taşıma, ayarlar |
| `kurallar.test.mjs` | 14 kuralın hepsi (mazeret, duraklatma, haftalık, SRBAI, bakım, nüks…) |
| `v3.test.mjs` | Miktar, geç kayıt, çöp kutusu, widget önbelleği |

---

## 14. Geliştirici notları

**Tarayıcıda deneme** (3B dahil çalışır):

```bash
cd NoralAliskanlik/app/src/main
python3 -m http.server 8000
# http://localhost:8000/assets/index.html?tarih=2026-03-05
```

`?tarih=` sahte gün verir; kaçırılan gün, takvim, anket ve kutlama böyle denenir.
Tarayıcıda veri `localStorage`'a (`noral-dev-data`) yazılır.

**Simge çizimlerini yenile:** `node scripts/simge-drawable.mjs`
**Three.js'i yenile:** `node scripts/vendor-three.mjs`
**Uygulama simgesini yenile:** `tasarim/ikon-yeni.py` (yakınlaştırma oranı betiğin içinde)

---

## 15. Kurallar (geliştirme)

Depo kökündeki `CLAUDE.md` bağlayıcıdır. Özeti:

- `guc.js` ve `habits.js` saf kalır: DOM ve Three.js bilmez, testlidir.
- Tarih/saat her zaman `clock.js` üzerinden alınır.
- Kayıt biçimine alan eklenince sürüm artar ve migration yazılır. **Kullanıcının verisi
  asla kaybolmamalı.**
- Mobil bütçe: 30–60 fps, telefon ısınmamalı. Ağır hesap her karede değil, bir kez
  yapılıp saklanır.
- Tüm metinler Türkçe.
- Yeni npm paketi eklemeden önce sorulur.
- Fikirler ve kararlar `FIKIRLER.md`'de birikir.

---

## 16. Bilinen sınırlar

- Tek kullanıcı, tek cihaz. Eşitleme yok; taşıma yedek dosyasıyla yapılır.
- Widget en fazla 4 alışkanlık gösterir.
- Simge seti 12 tane; aynı simgeden iki aktif alışkanlık olursa beyinde ayırt edilemez
  (form soluk göstererek uyarır ama engellemez).
- Otomatiklik anketi kapalıysa model herkes için geçerli ortalama süreyi kullanır.
