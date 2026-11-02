# Fikir defteri

Biriktirilen fikirler. Hiçbiri "yapılacak" değil; birikince önemli olanları seçilip yapılır.
Önemsiz olduğu anlaşılanlar "Vazgeçildi" başlığına taşınır, silinmez (neden vazgeçildiği de
bir bilgi).

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
