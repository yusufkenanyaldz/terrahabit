package com.noralaliskanlik

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import android.widget.Toast
import androidx.core.app.NotificationManagerCompat
import kotlin.math.abs
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

/**
 * Ana ekran widget'ı (saydam): duvar kâğıdının üstünde süzülen parlayan beyin; her alışkanlığa
 * beyinden ışıklı bir yol uzanır. Sağda ad, aşama renginde güç çubuğu, yüzde ve onay.
 * - Onay: bugünü işaretle / geri al. Miktarlı alışkanlıkta ayrıca "+" (+1).
 * - Beyne ya da ada dokunmak uygulamayı açar.
 * Güç yüzdesi ve aşama uygulamanın son hesabından gelir; uygulama her kayıtta günceller.
 */
class AliskanlikWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { ciz(context, manager, it) }
    }

    /** Boyut değişince yollar yeni ölçüye göre yeniden çizilir. */
    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, yeni: Bundle) {
        ciz(context, manager, id)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action != ACTION_ISARETLE) return
        val id = intent.getStringExtra(AlarmScheduler.EXTRA_HABIT_ID) ?: return
        val mesaj = if (intent.getBooleanExtra(EXTRA_SAYAC, false)) HabitStore.artir(context, id)
        else HabitStore.toggleDoneToday(context, id)
        if (mesaj == null) return
        // Dokunuşun işe yaradığı görünsün
        Toast.makeText(context, mesaj, Toast.LENGTH_SHORT).show()
        // Bugünün bildirimi artık gereksiz; açık uygulama veriyi yeniden okusun
        NotificationManagerCompat.from(context).cancel(id.hashCode())
        context.sendBroadcast(Intent(DoneReceiver.ACTION_DATA_CHANGED).setPackage(context.packageName))
        guncelleHepsi(context)
    }

    companion object {
        const val ACTION_ISARETLE = "com.noralaliskanlik.WIDGET_ISARETLE"
        private const val EXTRA_SAYAC = "sayac"
        private const val EN_COK_SATIR = 4
        private const val SATIR_DP = 56f         // Bir satırın içeriği: iki 28 dp'lik sıra

        // Düzendeki oranlar (widget_aliskanlik.xml ağırlıklarıyla AYNI olmalı)
        private const val BEYIN_PAY = 0.55f      // Beyin sütunu genişliği
        private const val YOL_BAS = 0.20f        // Yollar katmanının başladığı x
        private const val YOL_GENISLIK = 0.35f   // Yollar katmanının genişliği (0,20 → 0,55)

        // Beyin görselinde (widget_beyin.png, 640x562) bölgelerin konumu (0..1)
        private const val BEYIN_EN = 640f
        private const val BEYIN_BOY = 562f
        private const val PFC_X = 0.80f; private const val PFC_Y = 0.40f   // Prefrontal (Çaba)
        private const val BG_X = 0.50f; private const val BG_Y = 0.52f     // Bazal gangliyon (Otomatik)

        /** Tüm widget'ları yeniden çiz (veri değişince çağrılır). */
        fun guncelleHepsi(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, AliskanlikWidget::class.java))
            ids.forEach { ciz(context, manager, it) }
        }

        /** Gücün yol üzerindeki konumu (JS guc.js yolKonumu ile aynı parçalı eşleme). */
        private fun yolKonumu(H: Float): Float {
            val noktalar = arrayOf(0f to 0f, 0.5f to 0.25f, 0.845f to 0.5f, 0.95f to 0.75f, 1f to 1f)
            val h = H.coerceIn(0f, 1f)
            for (i in 1 until noktalar.size) {
                val (h0, y0) = noktalar[i - 1]
                val (h1, y1) = noktalar[i]
                if (h <= h1) return y0 + (h - h0) / (h1 - h0) * (y1 - y0)
            }
            return 1f
        }

        private fun ciz(context: Context, manager: AppWidgetManager, widgetId: Int) {
            val pkg = context.packageName
            val views = RemoteViews(pkg, R.layout.widget_aliskanlik)
            val uygulamayiAc = PendingIntent.getActivity(
                context, 0,
                Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_ac, uygulamayiAc)

            val tum = HabitStore.widgetSatirlari(context)
            // Yüksekliğe sığacak kadar satır (alçak widget'ta içerik taşmasın)
            val (_, hDp) = boyut(manager, widgetId)
            val sigan = (hDp / SATIR_DP).toInt().coerceIn(1, EN_COK_SATIR)
            val satirlar = tum.take(sigan)

            views.removeAllViews(R.id.widget_satirlar)
            satirlar.forEach { s ->
                val satir = RemoteViews(pkg, R.layout.widget_satir)
                satir.setTextViewText(R.id.satir_ad, s.ad)
                satir.setTextViewText(R.id.satir_yuzde, s.bilgi)
                satir.setTextColor(R.id.satir_yuzde, s.renk)
                satir.setOnClickPendingIntent(R.id.satir_ad, uygulamayiAc)
                // Aşama renginde güç çubuğu (4 renkten biri görünür; API 26 uyumlu yol)
                val barlar = intArrayOf(R.id.satir_bar0, R.id.satir_bar1, R.id.satir_bar2, R.id.satir_bar3)
                barlar.forEachIndexed { i, bar ->
                    satir.setViewVisibility(bar, if (i == s.asama) View.VISIBLE else View.GONE)
                }
                satir.setProgressBar(barlar[s.asama], 100, s.guc.coerceAtLeast(2), false)

                val pasif = s.durum == "duraklatildi" || s.durum == "plansiz"
                satir.setFloat(R.id.satir_kok, "setAlpha", if (pasif) 0.55f else 1f)

                // Onay düğmesi
                val onayCizim = if (s.durum == "yapildi") ONAY_DOLU[s.asama] else ONAY_BOS[s.asama]
                satir.setImageViewResource(R.id.satir_onay, onayCizim)
                satir.setViewVisibility(
                    R.id.satir_onay_alan,
                    when {
                        s.sinirli -> View.GONE // Günlük sınırlı kötü alışkanlıkta yalnızca +1 sayaç
                        s.durum == "duraklatildi" -> View.INVISIBLE
                        else -> View.VISIBLE
                    }
                )
                // "+" yalnızca miktarlı alışkanlıkta
                satir.setImageViewResource(R.id.satir_arti, ARTI[s.asama])
                // Miktarsız alışkanlıkta "+" yer kaplamasın (GONE): güç çubuğu uzar
                satir.setViewVisibility(
                    R.id.satir_arti_alan,
                    when {
                        !s.sayac -> View.GONE
                        s.durum == "duraklatildi" -> View.INVISIBLE
                        else -> View.VISIBLE
                    }
                )

                if (s.durum != "duraklatildi") {
                    if (!s.sinirli) satir.setOnClickPendingIntent(R.id.satir_onay_alan, isaretleIntent(context, s.id, false))
                    if (s.sayac) satir.setOnClickPendingIntent(R.id.satir_arti_alan, isaretleIntent(context, s.id, true))
                }
                views.addView(R.id.widget_satirlar, satir)
            }
            views.setViewVisibility(R.id.widget_bos, if (tum.isEmpty()) View.VISIBLE else View.GONE)
            val fazla = tum.size - satirlar.size
            views.setViewVisibility(R.id.widget_daha, if (fazla > 0) View.VISIBLE else View.GONE)
            if (fazla > 0) views.setTextViewText(R.id.widget_daha, "+$fazla alışkanlık daha")
            views.setOnClickPendingIntent(R.id.widget_daha, uygulamayiAc)

            // Beyinden satırlara ışıklı yollar
            yollariCiz(context, manager, widgetId, satirlar)?.let { views.setImageViewBitmap(R.id.widget_yollar, it) }

            manager.updateAppWidget(widgetId, views)
        }

        /** Widget boyutu (dp). Dikey ekranda: genişlik = en küçük genişlik, yükseklik = en büyük yükseklik. */
        private fun boyut(manager: AppWidgetManager, widgetId: Int): Pair<Float, Float> {
            val secenek = manager.getAppWidgetOptions(widgetId)
            val w = secenek.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH).takeIf { it > 0 } ?: 320
            val h = secenek.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT).takeIf { it > 0 } ?: 220
            return w.toFloat() to h.toFloat()
        }

        private fun isaretleIntent(context: Context, id: String, sayac: Boolean): PendingIntent =
            PendingIntent.getBroadcast(
                context, id.hashCode() * 31 + (if (sayac) 1 else 0),
                Intent(context, AliskanlikWidget::class.java)
                    .setAction(ACTION_ISARETLE)
                    .putExtra(AlarmScheduler.EXTRA_HABIT_ID, id)
                    .putExtra(EXTRA_SAYAC, sayac),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

        /**
         * Yollar katmanı: widget'ın gerçek boyutuna göre çizilir. Bitmap, widget güncellemesiyle
         * süreçler arası gönderildiği için (≈1 MB sınırı) yalnızca beyin ile satırlar arasındaki
         * şeride ve en fazla ~600 KB olacak çözünürlükte çizilir.
         */
        private fun yollariCiz(
            context: Context, manager: AppWidgetManager, widgetId: Int, satirlar: List<HabitStore.WidgetSatiri>
        ): Bitmap? {
            val (wDp, hDp) = boyut(manager, widgetId)
            val yolDp = wDp * YOL_GENISLIK
            // Ölçek: ekran yoğunluğu, ama bitmap ~600 KB'ı geçmesin
            val yogunluk = context.resources.displayMetrics.density
            val k = min(yogunluk, sqrt(600_000f / 4f / (yolDp * hDp)))
            val bw = (yolDp * k).roundToInt().coerceAtLeast(1)
            val bh = (hDp * k).roundToInt().coerceAtLeast(1)
            val bmp = Bitmap.createBitmap(bw, bh, Bitmap.Config.ARGB_8888)
            if (satirlar.isEmpty()) return bmp
            val c = Canvas(bmp)

            // Beyin görselinin sol sütunda (fitCenter) kapladığı alan, dp
            val solDp = wDp * BEYIN_PAY
            val olcek = min(solDp / BEYIN_EN, hDp / BEYIN_BOY)
            val gx = (solDp - BEYIN_EN * olcek) / 2f
            val gy = (hDp - BEYIN_BOY * olcek) / 2f
            // dp → bu bitmap'in pikseli (yollar katmanı x = YOL_BAS·W'den başlar)
            fun px(xDp: Float) = (xDp - wDp * YOL_BAS) * k
            fun py(yDp: Float) = yDp * k

            val parlama = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND
                strokeWidth = 5f * k; maskFilter = BlurMaskFilter(4f * k, BlurMaskFilter.Blur.NORMAL)
            }
            val cekirdek = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeWidth = 1.4f * k
            }
            val nokta = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
            val haleNokta = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.FILL; maskFilter = BlurMaskFilter(4f * k, BlurMaskFilter.Blur.NORMAL)
            }

            val satirBoy = hDp / satirlar.size
            satirlar.forEachIndexed { i, s ->
                // Başlangıç: beyinde, güce göre Prefrontal → Bazal gangliyon
                val t = yolKonumu(s.guc / 100f)
                // Aynı güçteki alışkanlıklar üst üste binmesin: her yol, satır sırasına göre
                // beyinde biraz farklı yükseklikten çıkar (uygulamadaki demet gibi)
                val yayilma = (i - (satirlar.size - 1) / 2f) * 0.07f
                val bx = gx + BEYIN_EN * olcek * (PFC_X + (BG_X - PFC_X) * t - abs(yayilma) * 0.03f)
                val by = gy + BEYIN_BOY * olcek * (PFC_Y + (BG_Y - PFC_Y) * t + yayilma)
                // Bitiş: satırın güç çubuğu hizası (içerik satırda ortalı; çubuk alt sıranın ortası:
                // satır ortası + 14 dp), sağ sütunun hemen solu
                val ex = solDp - 2f
                val ey = satirBoy * i + satirBoy / 2f + SATIR_DP / 4f
                val yol = Path().apply {
                    moveTo(px(bx), py(by))
                    val ortaX = (bx + ex) / 2f
                    cubicTo(px(ortaX), py(by), px(ortaX), py(ey), px(ex), py(ey))
                }
                val renk = s.renk
                val soluk = s.durum == "duraklatildi" || s.durum == "plansiz"
                parlama.color = Color.argb(if (soluk) 50 else 140, Color.red(renk), Color.green(renk), Color.blue(renk))
                c.drawPath(yol, parlama)
                // Çekirdek: rengin açık tonu
                cekirdek.color = Color.argb(
                    if (soluk) 120 else 235,
                    (Color.red(renk) + 255) / 2, (Color.green(renk) + 255) / 2, (Color.blue(renk) + 255) / 2
                )
                c.drawPath(yol, cekirdek)
                // Uç noktaları: beyinde parlayan küre, satırda küçük nokta
                haleNokta.color = Color.argb(if (soluk) 60 else 200, Color.red(renk), Color.green(renk), Color.blue(renk))
                c.drawCircle(px(bx), py(by), 5f * k, haleNokta)
                nokta.color = Color.argb(255, 255, 255, 255)
                c.drawCircle(px(bx), py(by), 2.2f * k, nokta)
                nokta.color = cekirdek.color
                c.drawCircle(px(ex), py(ey), 2.2f * k, nokta)
            }
            return bmp
        }

        private val ONAY_BOS = intArrayOf(
            R.drawable.widget_onay_bos_0, R.drawable.widget_onay_bos_1,
            R.drawable.widget_onay_bos_2, R.drawable.widget_onay_bos_3
        )
        private val ONAY_DOLU = intArrayOf(
            R.drawable.widget_onay_dolu_0, R.drawable.widget_onay_dolu_1,
            R.drawable.widget_onay_dolu_2, R.drawable.widget_onay_dolu_3
        )
        private val ARTI = intArrayOf(
            R.drawable.widget_arti_0, R.drawable.widget_arti_1,
            R.drawable.widget_arti_2, R.drawable.widget_arti_3
        )
    }
}
