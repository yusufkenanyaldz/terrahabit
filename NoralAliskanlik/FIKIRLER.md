# Fikir defteri

Biriktirilen fikirler. Çoğu "yapılacak" değil; birikince önemli olanları seçilip yapılır.
Önemsiz olduğu anlaşılanlar "Vazgeçildi" başlığına taşınır, silinmez (neden vazgeçildiği de
bir bilgi).

Bir maddenin nasıl yapılacağı konuşulup karara bağlandıysa, kararlar maddenin içine yazılır.
Kullanıcı "yap" dediğinde o maddeler yeniden tartışılmaz, yazıldığı gibi uygulanır.

## Beklemede

### 1. Alışkanlıklarım listesi açılıp kapanabilsin
_2 Kasım 2026 — kullanıcı_

Liste şu an sabit yükseklikte; içinde aşağı yukarı kayıyor ama genişlemiyor. Bu, beyin iyi
görünsün diye bilerek böyle yapıldı. İstek: liste genişletilip daraltılabilsin, ama genişlerken
beyin modelinin sınırlarını ezmesin — yani beyin ekranda kalmaya devam etsin, sadece
küçülsün/kaysın.

Not (Claude): sahnede `setGorunurAlan(ust, alt)` zaten panellerle kapanmayan dikey alanı alıp
görüntüyü o alanın ortasına kaydırıyor. Liste yüksekliği değiştikçe bu çağrılırsa beyin kendi
kendine yukarı kayar. Kamerayı da aynı anda biraz uzaklaştırmak gerekebilir, yoksa dar alanda
beyin taşar.

### 2. Güç grafiği (prototip çıkarıldı, şimdilik eklenmedi)
_2 Kasım 2026 — kullanıcı: "Gerek yok bence şimdilik"_

Her alışkanlık için gücün zamana göre eğrisi. Prototip:
https://claude.ai/artifact/B7sVhXzKyqdJdCYPr3sa6B
Eğriler gerçek modelden (`guc.js`) üretildi; dört senaryo (kusursuz takip, haftada bir kaçırma,
araya giren 18 gün, zor alışkanlık). Tasarım: arkada dört aşama bandı, eğri aşama rengini alıyor,
altta günlük işaret şeridi. Uygulamaya girerse yeri: detay kartında 30 günlük noktaların altı.
Veri zaten kayıtta, yeni alan gerekmez.

### 3. Aşama renklerinden ikisi birbirine çok yakın
_2 Kasım 2026 — Claude (grafik çalışırken fark edildi)_

2. aşama moru `#a855f7` ile 3. aşama çivit mavisi `#6366f1`: normal görüşte bile ayırt etmesi zor
(ölçüm: OKLab ΔE 11,3; renk körlüğünde 0,9). Grafikte sorun değil çünkü bant adları yazıyor, ama
beyindeki küreye ve widget'a bakarken "Tekrar" mı "Yerleşiyor" mu belli olmuyor. Çözüm: 3. aşamayı
mora değil maviye/turkuaza doğru kaydırmak (0. turuncu → 3. camgöbeği geçişi zaten o yönde).

### 4. Şeffaf arka planlı ikon
_2 Kasım 2026 — kullanıcı_

Yeni beyin görseli ikon olarak, arka plan zemini olmadan kullanılsın: ana ekranda boşlukta
duran bir beyin gibi görünsün. Kaynak resim depoda: `tasarim/ikon-kaynak-2026-11-02.png`
(1024×1024; koyu lacivert zemin ve altta "AI tarafından oluşturulan içerik" yazısı temizlenmeli).

Bilinmesi gerekenler:
- **Mümkün**, zorunlu bir arka plan yok. Uyarlanabilir ikonun arka plan katmanı şeffaf bırakılır.
- **Samsung "simge çerçeveleri" ayarı** açıksa telefon şeffaf ikonların arkasına kendi beyaz/gri
  çerçevesini koyar. Kullanıcının ayarı, bizim elimizde değil.
- **Kırpma**: telefon ikonu daire/kare/damla şekline kırpar, kenarlar kaybolur. Şeffaf zeminde
  bu daha çok göze batar, beyin güvenli alanın içine çekilmeli.
- Karar için iki sürüm (zeminli / zeminsiz) derlenip telefonda karşılaştırılmalı.

Şu anki ikon: düz renk zemin `#282725` + beyin ön katmanı.

### 5. Tasarım önerisi: ekleme ekranı ve detay kartı — KARARA BAĞLANDI
_3 Kasım 2026 — kullanıcı (karşılaştırmalı görseller); değerlendirme kullanıcı tarafından onaylandı_

**Yapılacaklar (sırasıyla, "yap" denince bu liste uygulanır):**
1. Form etiketleri büyük harften çıkar: küçük harf, sönük, ama **kaldırılmaz** (alan dolduktan
   sonra neyin ne olduğu kaybolmasın).
2. Detay kartındaki dairesel yüzde halkası kalkar, yerine mini nöral yol gelir: 0 → ~66 çizgisi
   üzerinde kayan küre (ana sahnedeki yolun küçük hâli).
3. "Dün / Bugün" hiyerarşisi: Dün sönük, Bugün vurgulu.
4. Panel açılırken gerçek 3B beyin küçülür (`setGorunurAlan` zaten var). **Ayrı bir 2B beyin
   çizimi eklenmez**; iki görsel zamanla birbirinden ayrı düşer.
5. Kaydırarak onay yalnız nadir işlerde: ilk oluşturma, silme, 66. gün kutlaması.
   **Günlük tamamlama tek dokunuş kalır** (widget'ta tek dokunuşken uygulamada zahmetli olmasın).
6. Arayüz nötr kalır; turuncu yalnızca 1. aşama (Çaba) rengi olarak kullanılır. Arayüzün tamamı
   turuncuya çekilmez, yoksa aşama rengi anlamını yitirir.
7. Alışkanlık simgeleri (kitap, damla, beyin, ağırlık, kalp, ay): çizgi simge, emoji değil.
   Listede, beyin etiketlerinde ve widget'ta kullanılır. **En pahalı madde bu**; diğerleri
   bittikten sonra ayrıca ele alınır.

Maliyet: 7. madde dışındaki her şey arayüz katmanında (index.html + main.js). Modele, kayıt
biçimine ve 3B sahneye dokunmaz.

---

Aşağısı kararın dayanağı olan ilk değerlendirme (3 Kasım 2026):

Görseller: `tasarim/tasarim-onerisi-2026-11-03-ekleme.jpg` ve
`tasarim/tasarim-onerisi-2026-11-03-detay.jpg` (solda öneri, sağda mevcut hâli).
Not: kodlama yapılmadı, yalnızca değerlendirme.

**Alınmaya değer bulunanlar**
- **Büyük harf etiketlerin kalkması.** Mevcut formda her alanın üstünde İSİM / HATIRLATMA SAATİ /
  SIKLIK gibi büyük harf etiket var; form gürültülü görünüyor. Öneride alan içi örnek metin ve
  yan yana gruplama kullanılmış, çok daha sakin. Dikkat: etiket tamamen kalkarsa alan doldurulduktan
  sonra neyin ne olduğu kaybolur; küçük/normal harf etiket kalsın.
- **Alışkanlık simgeleri** (kitap, damla, beyin, ağırlık, kalp, ay). Çizgi simgeler emoji değil;
  listede, beyindeki etiketlerde ve widget'ta alışkanlığı isimden önce tanıtır. Yeni bir simge seti
  çizmek gerekir, en pahalı madde bu.
- **Dairesel yüzde halkası yerine mini nöral yol.** Önerideki 0 → ~66 çizgisi üzerinde kayan küre,
  ana sahnedeki yolun küçük hâli. Uygulamanın kendi diline mevcut halkadan daha çok yakışıyor.
- **"Dün / Bugün" ayrımı.** Öneride Dün sönük, Bugün vurgulu; mevcutta ikisi de dolu turkuaz.
  Hiyerarşi önerideki gibi olmalı.
- **Beynin ekleme ekranında da görünür kalması.** Ama öneride olduğu gibi ayrı bir 2B çizim
  eklemeye gerek yok: panel açılırken gerçek 3B beyni küçültmek yeterli, bunun altyapısı zaten var
  (`setGorunurAlan`). İki ayrı beyin görseli zamanla birbirinden ayrı düşer.

**İtirazlar**
- **Kaydırarak onay ("küreyi kaydır").** Alışkanlık oluşturmak gibi nadir ve anlamlı bir iş için
  hoş bir tören; ama öneri bunu günlük tamamlama için de kullanıyor. Her gün, her alışkanlık için
  kaydırma = birikmiş sürtünme. Üstelik widget'tan tek dokunuşla işaretlenebiliyorken uygulama
  içinde daha zahmetli olması tutarsız. Önerim: kaydırma yalnız nadir işlerde (ilk oluşturma,
  silme, 66. gün kutlaması), günlük tamamlama tek dokunuş kalsın.
- **Her yerde turuncu vurgu.** Öneride tüm arayüz turuncuya çekilmiş. Oysa turuncu bu uygulamada
  bir anlam taşıyor: 1. aşama (Çaba). Arayüzün tamamı turuncu olursa aşama rengi anlamını yitirir.
  Arayüz nötr kalmalı, renk yalnız aşamayı anlatmalı.

**Maliyet**: simge seti dışındaki her şey arayüz katmanında (index.html + main.js). Modele,
kayıt biçimine ve 3B sahneye dokunmaz.

## Claude'un önerdikleri (kullanıcı henüz seçmedi)

1. **Otomatik yedekleme** — haftada bir sessizce İndirilenler'e yedek. Küçük iş, en çok değeri
   olan madde; "veri asla kaybolmamalı" kuralını karşılar.
2. **Akşam hatırlatması** — gün bitmeden yapılmamış olanlar için tek bildirim; dün kaçırıldıysa
   iki gün kuralını hatırlatan metin. Küçük iş.
3. **İpucu alanı** — her alışkanlığa "ne zaman / nerede" satırı, bildirimde de görünür.
   Küçük iş, uygulamanın kimliğine yakışıyor.

## Vazgeçildi

### 3B canlı duvar kağıdı + şeffaf widget
_2 Kasım 2026 — Gemini önerisi_

Beyni canlı duvar kağıdına gömüp üstüne şeffaf buton widget'ı koymak. Vazgeçme sebebi:
Three.js canlı duvar kağıdında çalışmaz, sahnenin tamamı Kotlin + OpenGL ES ile baştan
yazılmalı; ayrıca duvar kağıdı sayfa kaydırınca widget'tan ayrılıyor, telefonun fotoğraf
duvar kağıdı kaybediliyor ve sürekli dönen sahne pil yakıyor.

## Bilgi notları

Soruldu, cevaplandı; bir daha sorulmasın diye burada.

### Otomatiklik anketi (SRBAI) ne işe yarıyor?
_2 Kasım 2026_

Modelin kendini kişiye göre ayarlaması için. Güç bir formülle hesaplanıyor ama formül "ortalama
insan"a göre; anket, hesaplanan sayıyı kişinin gerçekte ne hissettiğiyle karşılaştırıyor.

14 günde bir (bakım modunda 30 günde bir) ve her aşama yükselişinde dört madde sorulur, her biri
1–7: "Otomatik olarak yaparım", "Bilinçli olarak hatırlamaya gerek duymadan yaparım", "Düşünmeden
yaparım", "Farkına varmadan yapmaya başlarım". Bunlar psikolojideki standart **SRBAI** ölçeği.
Ortalama 0–1 arası otomatiklik puanına (S) çevrilir.

Üst üste **iki** ölçümde S ile hesaplanan H arasında aynı yönde %15'ten fazla fark olursa, kişisel
hedef süre T %10 kaydırılır (30–150 gün arası). Tek ölçüm yetmez: bir günlük ruh hali modeli
savurmasın diye. ⚙ menüsünden kapatılabilir; kapalıyken model herkes için geçerli ortalama süreyi
kullanır. Kod: `habits.js` (srbaiPuani, srbaiDue, addSrbai), `guc.js` (olcumleriUygula).
