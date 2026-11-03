"""Beyni koyu zeminden ayır. Sorun: sönük zemin parlaması açık arka planda koyu bir leke
bırakıyordu. Çözüm: yalnız gerçekten parlak ışık korunur ve rengi zemin çıkarılarak düzeltilir."""
import numpy as np
from PIL import Image, ImageFilter
from collections import deque

a = np.asarray(Image.open('/home/user/terrahabit/NoralAliskanlik/tasarim/ikon-kaynak-2026-11-02.png')
               .convert('RGB')).astype(np.float32)
lum = a @ np.array([0.299, 0.587, 0.114], np.float32)
lum[920:, :] = 0                                   # AI filigranı
H, W = lum.shape

ESIK = 45.0
dis = np.zeros((H, W), bool); k = deque()
for x in range(W):
    for y in (0, H - 1):
        if lum[y, x] < ESIK: dis[y, x] = True; k.append((y, x))
for y in range(H):
    for x in (0, W - 1):
        if lum[y, x] < ESIK: dis[y, x] = True; k.append((y, x))
while k:
    y, x = k.popleft()
    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
        ny, nx = y+dy, x+dx
        if 0 <= ny < H and 0 <= nx < W and not dis[ny, nx] and lum[ny, nx] < ESIK:
            dis[ny, nx] = True; k.append((ny, nx))
govde = ~dis

def uret(dosya, isik_alt, isik_ust, isik_en_cok):
    ramp = np.clip((lum - isik_alt) / (isik_ust - isik_alt), 0, 1) * isik_en_cok
    alfa = np.where(govde, 1.0, ramp)
    alfa = np.asarray(Image.fromarray((alfa*255).astype(np.uint8))
                      .filter(ImageFilter.GaussianBlur(1.0)), dtype=np.float32) / 255.0
    # Işık koyu zemine eklenmiş: zemini çıkar, alfaya böl (koyu lacivert leke kalmasın)
    zemin = np.array([0, 6, 20], np.float32)
    renk = np.clip((a - zemin) / np.maximum(alfa, 0.12)[..., None], 0, 255)
    renk = np.where(govde[..., None], a, renk)
    im = Image.fromarray(np.dstack([renk.astype(np.uint8), (alfa*255).astype(np.uint8)]), 'RGBA')
    im.crop(im.split()[3].point(lambda v: 255 if v > 10 else 0).getbbox()).save(dosya)

uret('beyin_sade.png', 95, 165, 0.95)    # yalnız düğüm ışıkları
uret('beyin_parlak.png', 55, 140, 0.85)  # düğüm ışıkları + ince hale
# Gövdenin kendi kutusu (ölçekleme bunun üzerinden yapılacak)
ys, xs = np.where(govde); print('gövde kutusu', xs.min(), ys.min(), xs.max(), ys.max())
for f in ('beyin_sade.png', 'beyin_parlak.png'): print(f, Image.open(f).size)
