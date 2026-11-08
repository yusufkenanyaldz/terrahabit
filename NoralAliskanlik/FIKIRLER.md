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

### 3. Aşama renklerinden ikisi birbirine çok yakın — YAPILDI (3 Kasım 2026)
_2 Kasım 2026 — Claude (grafik çalışırken fark edildi)_

**Sonuç:** 3. aşama (Yerleşiyor) `#6366f1` → `#0ea5e9` (gök mavisi). Ölçüm: mor ile farkı
renk körlüğünde 0,9 → 8,8; normal görüşte 11,3 → 18,3. Değişen yerler: brain-scene.js,
HabitStore.kt, widget_bar_2 / widget_onay_bos_2 / widget_onay_dolu_2 / widget_arti_2.

2. aşama moru `#a855f7` ile 3. aşama çivit mavisi `#6366f1`: normal görüşte bile ayırt etmesi zor
(ölçüm: OKLab ΔE 11,3; renk körlüğünde 0,9). Grafikte sorun değil çünkü bant adları yazıyor, ama
beyindeki küreye ve widget'a bakarken "Tekrar" mı "Yerleşiyor" mu belli olmuyor. Çözüm: 3. aşamayı
mora değil maviye/turkuaza doğru kaydırmak (0. turuncu → 3. camgöbeği geçişi zaten o yönde).

### 4. Şeffaf arka planlı ikon — ZEMİNLİ ÇÖZÜMDE KARAR KILINDI (3 Kasım 2026)
_2 Kasım 2026 — kullanıcı_

**Son durum (3 Kasım 2026, akşam):** Kullanıcı simgeyi tümden değiştirdi. Yeni görsel sarmal
çizgi beyin (`tasarim/ikon-kaynak-2026-11-03.jpg`); kenardan kenara dolu olduğu için uyarlanabilir
simgenin ARKA PLAN katmanına kondu, ön katman boş. Zemin dolu olduğundan telefon kendi çerçevesini
eklemiyor. Görsel %50 yakınlaştırılarak kırpıldı: 48 pikselde okunurluk denendi; tam kare
gürültülüydü, %70 yakınlaştırma dış halkaları yiyordu. Hazırlama: `tasarim/ikon-yeni.py`.
Beyin görselli eski simge dosyaları kaldırıldı (`ikon-beyin-seffaf.png` tasarım klasöründe duruyor).

**Önceki tur:** Şeffaf sürüm derlendi ama S25'te telefon ikonun arkasına kendi siyah karesini koydu.
Kullanıcı Ayarlar'da "simge" araması yaptı: 16 sonucun hiçbiri simge zemini/çerçevesiyle ilgili
değil, yani One UI 8'de bu ayar yok. Bu yüzden zemini biz çizdik: `drawable/ikon_arka_plan.xml`
(koyu uzay #080B16 + sağda turuncu, solda camgöbeği ışık; ışık merkezleri 108 dp tuvalde 0,70 ve
0,33 — görünen 72 dp alanda beynin iki düğümüne denk gelir). Şeffaf hâle dönüş tek satır:
`ic_launcher.xml` içinde background → `@android:color/transparent`.

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

**Durum (3 Kasım 2026): 1–6 yapıldı, 7 bekliyor.**

**Yapılacaklar (sırasıyla, "yap" denince bu liste uygulanır):**
1. ✔ Form etiketleri büyük harften çıkar: küçük harf, sönük, ama **kaldırılmaz** (alan dolduktan
   sonra neyin ne olduğu kaybolmasın).
2. Detay kartındaki dairesel yüzde halkası kalkar, yerine mini nöral yol gelir: 0 → ~66 çizgisi
   üzerinde kayan küre (ana sahnedeki yolun küçük hâli).
3. ✔ "Dün / Bugün" hiyerarşisi: Dün sönük, Bugün vurgulu.
4. ✔ Panel açılırken gerçek 3B beyin küçülür (`setGorunurAlan` zaten var). **Ayrı bir 2B beyin
   çizimi eklenmez**; iki görsel zamanla birbirinden ayrı düşer.
5. ✔ Kaydırarak onay yalnız nadir işlerde: ilk oluşturma, silme, 66. gün kutlaması.
   **Günlük tamamlama tek dokunuş kalır** (widget'ta tek dokunuşken uygulamada zahmetli olmasın).
6. ✔ Arayüz nötr kalır; turuncu yalnızca 1. aşama (Çaba) rengi olarak kullanılır. Arayüzün tamamı
   turuncuya çekilmez, yoksa aşama rengi anlamını yitirir.
7. ⏳ Alışkanlık simgeleri (kitap, damla, beyin, ağırlık, kalp, ay): çizgi simge, emoji değil.
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

### 6. İki aylık kullanım denemesinden çıkanlar
_3 Kasım 2026 — Claude, uygulamayı 60 gün boyunca kullanarak gözden geçirdi_

Yöntem: 1. gün dört alışkanlık (Kitap oku 10 sayfa / Spor "zor" / Erken yat / Sigara-bırakma)
uygulamadan eklendi; araya %85 tutturma, 6 unutulan gün ve 7 günlük bir seyahat (duraklatma)
yazıldı; 2., 15., 30., 45. ve 60. günlerde uygulama gerçekten kullanıldı. Çökme ya da konsol
hatası çıkmadı; kayıt, taşıma ve güç hesabı doğru çalıştı (60. gün: Kitap %87 Yerleşiyor,
Spor %57 Tekrar, Erken yat %87, Sigara %87).

**a) Kötü alışkanlıkta aşama adları yanlış anlam veriyor.** Sigara satırı 60. günde
"Kontrol %87 · **Yerleşiyor**" yazıyor. Okuyunca sigara yerleşiyormuş gibi duruyor; oysa
yerleşen şey bırakma. Aynı sorun 2. aşamada: "Tekrar". Yalnız 4. aşama kötüde "Özgür" diye
değiştiriliyor (`asamaBilgisi`), diğerleri değişmiyor. Öneri: kötü alışkanlıkta
Çaba → **Direnç** → **Kontrol** → Özgür gibi kendi adları olsun.

**b) Miktarlı alışkanlık listeden tek dokunuşla tamamlanamıyor.** "Kitap oku 10 sayfa" satırında
yalnız "+1" var; 10 sayfa için listede 10 kez dokunmak gerekiyor. Oysa **widget'ta tek ✓ miktarı
hedefe çekiyor** ve detay kartında "Hedefi tamamla" düğmesi var. Yani en çok kullanılan yer olan
liste, en zahmetli yol. Öneri: "+1" düğmesine uzun basınca hedefe çeksin (uzun basma o düğmede
şu an boşta; satırın uzun basması silme, ama `.row-check` hariç tutuluyor).

**c) Dört alışkanlıkta beyin etiketleri çakışıyor.** 45. günde "Kitap oku · %76" etiketi yukarı
itilip "ÇABA / Prefrontal Korteks" bölge etiketinin üstüne biniyor; alttaki üç etiket de
birbirine değiyor. Dört alışkanlık + iki bölge etiketi aynı dar alanda. Öneri: alışkanlık sayısı
üçü geçince bölge etiketleri gizlensin, ya da etiketler arası en az boşluk artsın.

**d) Güçleri birbirine yakın küreler üst üste biniyor.** Üç alışkanlık %76-87 arasındayken
küreler yol üzerinde aynı noktada toplanıp tek bir leke gibi görünüyor. Widget'ta başlangıç
noktaları için yapılan "yayılma" düzeltmesinin benzeri 3B sahnede de gerekebilir.

**e) Dördüncü alışkanlığı eklerken iki onay üst üste geliyor.** Küreyi kaydır → ardından
"3 alışkanlık zaten Çaba aşamasında, yine de eklensin mi?" penceresi. İkisi de doğru ama arka
arkaya gelince fazla geliyor. Öneri: bu uyarı, kaydırmadan **önce** (forma girer girmez, satır
olarak) gösterilsin.

Hiçbiri engelleyici değil; (a) ve (b) en çok rahatsız edenler.

### 7. Baştan sona denetimde çıkanlar
_8 Kasım 2026 — Claude, kullanıcı isteğiyle tüm mantığı sınadı_

Model, kayıt mantığı, Kotlin tarafı ve arayüz sınandı (50 test + ayrıca yazılan sonda
betikleri). Çekirdek doğru çalışıyor. Çıkan beş pürüz, önem sırasıyla:

**a) Kötü alışkanlıkta "sınırlı" ile "sınırsız" bambaşka davranıyor.** Sınır konmuşsa
(ör. en fazla 5 sigara) kayıt olmayan gün *temiz* sayılıyor: 30 gün uygulamaya hiç
dokunulmasa H %75'e çıkıyor. Sınır konmamışsa (sadece "bırakmak istediğim") kayıt
olmayan gün *kayma* sayılıyor: aynı 30 günde H %0'da kalıyor. Aynı niyetin iki kurulumu
zıt sonuç veriyor. Öneri: kötü alışkanlıkta her iki durumda da "kayıt yok = temiz"
olsun, kullanıcı yalnız kaymayı işaretlesin. (Model değişikliği, kullanıcı kararı.)

**b) Haftalık hedefte "son 30 gün" fırsat sayısı uydurma.** `son30Firsat` her zaman
`n·30/7` veriyor; 3 günlük bir alışkanlık "2/13" gösteriyor. Alışkanlığın yaşına göre
orantılanmalı. (Yalnız gösterim, hesap etkilenmiyor.)

**c) Bildirimdeki "Yaptım" o günün mazeretini silmiyor.** Widget ve uygulama siliyor
(`toggleDoneToday`, `artir`, JS `setDayStatus`); yalnız `HabitStore.markDoneToday`
atlıyor. Güce etkisi yok (yapıldı dalı önce geliyor) ama kayıt başka hiçbir yoldan
oluşmayan bir hâle giriyor: aynı gün hem done hem mazeret.

**d) Bakım modu sayacı duraklatma sırasında ilerliyor.** 20 gün duraklatılmış bir
alışkanlık, o günleri de sayarak "14 gün ≥%95" eşiğini geçebiliyor; yani tatilde
hatırlatmalar seyrelebiliyor. `bakimSay()` duraklatma dalında da çağrılıyor.

**e) Alışkanlığın eklendiği gün fırsat sayılıyor.** Akşam 23:00'te eklenip o gün
yapılmazsa ertesi gün kaçırma animasyonu ve kırmızı nokta çıkıyor. H'ye zarar yok
(taban 0), ama ilk izlenim sert.

**Doğru çalıştığı sınananlar:** aşama günleri (16/41/66), histerezis, taban ve tasarruf
etkisi, geç kayıt tam yarım kazanç, mazeret kotası, telafi günü (kaçan planlı günü tam
telafi ediyor), haftalık hedef (3/3 ile 5/3 aynı, 2/3 düşük), duraklatmanın H'yi
birebir dondurması, çöp kutusu 30 gün + geri yükleme, arşiv, anket zamanlaması,
widget önbelleğinin uygulamayla dört hane aynı çıkması, 04:00 gün sınırının iki tarafta
da aynı olması.

## Claude'un önerdikleri (kullanıcı henüz seçmedi)

1. **Otomatik yedekleme** — haftada bir sessizce İndirilenler'e yedek. Küçük iş, en çok değeri
   olan madde; "veri asla kaybolmamalı" kuralını karşılar.
2. **Akşam hatırlatması** — gün bitmeden yapılmamış olanlar için tek bildirim; dün kaçırıldıysa
   iki gün kuralını hatırlatan metin. Küçük iş.
3. **İpucu alanı** — her alışkanlığa **"neyin ardından"** satırı, bildirimde de görünür.
   Küçük iş, uygulamanın kimliğine yakışıyor.

   _Düzeltme (3 Kasım 2026):_ Alan önce "ne zaman / nerede" diye tasarlanmıştı; kullanıcı
   düzeltti. Yoğun ve gezgin bir günde sabit mekan yok: dün 10 sayfa yürürken, tramvay
   durağında ve tramvayda, üç ayrı yerde okundu. Değişmeyen şey mekan değil **sıra**
   ("evden çıkınca"). Alan bu yüzden mekan değil, **önceki olay** sorar. Yan not: değişken
   bağlamda kurulan alışkanlık daha yavaş otomatikleşir ama tek bir bağlama kilitlenmediği
   için o bağlam kaybolunca çökmez — kullanıcının eski bir yıllık okuma alışkanlığının
   kaybolma sebebi muhtemelen tek bağlama bağlı olmasıydı.

## Vazgeçildi

### 3B canlı duvar kağıdı + şeffaf widget
_2 Kasım 2026 — Gemini önerisi_

Beyni canlı duvar kağıdına gömüp üstüne şeffaf buton widget'ı koymak. Vazgeçme sebebi:
Three.js canlı duvar kağıdında çalışmaz, sahnenin tamamı Kotlin + OpenGL ES ile baştan
yazılmalı; ayrıca duvar kağıdı sayfa kaydırınca widget'tan ayrılıyor, telefonun fotoğraf
duvar kağıdı kaybediliyor ve sürekli dönen sahne pil yakıyor.

### Dallanan sinir lifi efekti (işaretleme ödülü)
_4 Kasım 2026 — kullanıcı çizimi, denendi ve vazgeçildi_

Tike basınca düz ışık yerine dallanan ince bir lif büyüsün fikri. İki sürüm denendi:
önce alttaki panelden küreye uzanan kalın bir dal, sonra küreden çıkan 1,1 piksellik
ince bir lif (yoldan 30-55 derece ayrılan, iki yan dallı). Kullanıcı GIF önizlemelerine
bakıp "hayal ettiğim gibi olmadı" dedi; düz ışıkta karar kılındı. Kod geri alındı
(commit 10b6150 ve 94541eb'nin revert'i); denemek isteyen o iki işleme bakabilir.

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

### 27 Şubat 2027 civarı: "%100 sığdı mı?"
_3 Kasım 2026_

Kullanıcı o gün gelip soracak. Arka planı: widget satırında sayılara ~76 dp yer var,
"0/10 · %7" 58 dp tutuyor, her fazladan rakam ~8 dp ekliyor; "10/10 · %100" 82 dp
olacağı için kırpılacaktı. Çözüm `AliskanlikWidget.kt` içinde: metin 10 karakteri
geçince 10 sp, 12'yi geçince 9 sp. Yani sığması gerekiyor.

Modelin tahmini (3 Kasım 2026'da başlayan, her gün yapılan, normal zorlukta bir
alışkanlık): %95 → 63. gün (5 Ocak 2027), %99 → 92. gün, %100 → 116. gün
(27 Şubat 2027). Kaçırılan günler bu tarihleri öteler.

Sığmadıysa: `widget_satir.xml` içindeki `satir_yuzde` payını büyütmek ya da punto
eşiklerini düşürmek yeter. Sığdıysa: kullanıcıyı tebrik et, 66 günü geçmiş demektir.
