"""Yeni simge: sarmal çizgi beyin. Görsel tam kanama (kenardan kenara) olduğu için
uyarlanabilir simgenin ARKA PLAN katmanı olarak konur; ön katman boş kalır.
Böylece telefon kendi çerçevesini eklemez ve dış halkalar kenarda doğal biçimde kesilir.
108 dp tuvalin ortadaki 72 dp'si görünür; o yüzden görsel önce ortadan kırpılır."""
from PIL import Image, ImageDraw

KAYNAK = '/home/user/terrahabit/NoralAliskanlik/tasarim/ikon-kaynak-2026-11-03.jpg'
RES = '/home/user/terrahabit/NoralAliskanlik/app/src/main/res'
YAKIN = 1.5   # 48 px'te okunurluk için denendi: 1,0 gürültülü; 1,7 halkaları yiyor

im = Image.open(KAYNAK).convert('RGB')
W = im.size[0]
k = int(W / YAKIN); o = (W - k) // 2
temel = im.crop((o, o, o + k, o + k))

# Uyarlanabilir simge arka planı (108 dp tuval)
ARKA = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
for yogunluk, boy in ARKA.items():
    temel.resize((boy, boy), Image.LANCZOS).save(f'{RES}/mipmap-{yogunluk}/ic_launcher_arka.png')

# Eski (uyarlanabilir olmayan) simgeler: görünen alan kadar kırpıp maskele
ESKI = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
gorunur = temel.crop((int(k * 1/6), int(k * 1/6), int(k * 5/6), int(k * 5/6)))  # ortadaki 72/108
for yogunluk, boy in ESKI.items():
    g = gorunur.resize((boy, boy), Image.LANCZOS).convert('RGBA')
    m = Image.new('L', (boy, boy), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, boy - 1, boy - 1], radius=int(boy * 0.22), fill=255)
    kare = g.copy(); kare.putalpha(m); kare.save(f'{RES}/mipmap-{yogunluk}/ic_launcher.png')
    mr = Image.new('L', (boy, boy), 0)
    ImageDraw.Draw(mr).ellipse([0, 0, boy - 1, boy - 1], fill=255)
    y = g.copy(); y.putalpha(mr); y.save(f'{RES}/mipmap-{yogunluk}/ic_launcher_round.png')

print('yazıldı; 432 px arka plan ve 5 eski boy')
