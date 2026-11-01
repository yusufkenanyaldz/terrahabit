package com.noralaliskanlik

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import androidx.core.app.NotificationManagerCompat

/**
 * Ana ekran widget'ı: bugünün alışkanlıkları ve tek dokunuşla işaretleme.
 * - Onay (✓): bugünü işaretle / geri al. Miktarlı alışkanlıkta "+1".
 * - Ada ya da başlığa dokunmak uygulamayı açar.
 * Güç yüzdesi ve aşama uygulamanın son hesabından gelir; uygulama her kayıtta günceller.
 */
class AliskanlikWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { ciz(context, manager, it) }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action != ACTION_ISARETLE) return
        val id = intent.getStringExtra(AlarmScheduler.EXTRA_HABIT_ID) ?: return
        val degisti = if (intent.getBooleanExtra(EXTRA_SAYAC, false)) HabitStore.artir(context, id)
        else HabitStore.toggleDoneToday(context, id)
        if (!degisti) return
        // Bugünün bildirimi artık gereksiz; açık uygulama veriyi yeniden okusun
        NotificationManagerCompat.from(context).cancel(id.hashCode())
        context.sendBroadcast(Intent(DoneReceiver.ACTION_DATA_CHANGED).setPackage(context.packageName))
        guncelleHepsi(context)
    }

    companion object {
        const val ACTION_ISARETLE = "com.noralaliskanlik.WIDGET_ISARETLE"
        private const val EXTRA_SAYAC = "sayac"
        private const val EN_COK_SATIR = 5

        /** Tüm widget'ları yeniden çiz (veri değişince çağrılır). */
        fun guncelleHepsi(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, AliskanlikWidget::class.java))
            ids.forEach { ciz(context, manager, it) }
        }

        private fun ciz(context: Context, manager: AppWidgetManager, widgetId: Int) {
            val pkg = context.packageName
            val views = RemoteViews(pkg, R.layout.widget_aliskanlik)
            val uygulamayiAc = PendingIntent.getActivity(
                context, 0,
                Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_baslik, uygulamayiAc)

            val satirlar = HabitStore.widgetSatirlari(context)
            val firsat = satirlar.filter { it.durum == "yapildi" || it.durum == "bekliyor" }
            val yapilan = satirlar.count { it.durum == "yapildi" }
            views.setTextViewText(R.id.widget_ozet, if (firsat.isEmpty()) "" else "Bugün $yapilan/${firsat.size}")

            views.removeAllViews(R.id.widget_satirlar)
            satirlar.take(EN_COK_SATIR).forEach { s ->
                val satir = RemoteViews(pkg, R.layout.widget_satir)
                satir.setTextViewText(R.id.satir_ad, s.ad)
                satir.setTextViewText(R.id.satir_alt, s.alt)
                satir.setInt(R.id.satir_nokta, "setColorFilter", s.renk)
                satir.setOnClickPendingIntent(R.id.satir_metin, uygulamayiAc)
                val pasif = s.durum == "duraklatildi" || s.durum == "plansiz"
                satir.setFloat(R.id.satir_kok, "setAlpha", if (pasif) 0.5f else 1f)
                if (s.sayac) {
                    satir.setViewVisibility(R.id.satir_onay, View.GONE)
                    satir.setViewVisibility(R.id.satir_sayac, View.VISIBLE)
                } else {
                    satir.setViewVisibility(R.id.satir_sayac, View.GONE)
                    satir.setViewVisibility(R.id.satir_onay, if (s.durum == "duraklatildi") View.INVISIBLE else View.VISIBLE)
                    satir.setImageViewResource(
                        R.id.satir_onay,
                        if (s.durum == "yapildi") R.drawable.widget_onay_dolu else R.drawable.widget_onay_bos
                    )
                }
                if (s.durum != "duraklatildi") {
                    val isaretle = PendingIntent.getBroadcast(
                        context, s.id.hashCode() * 31 + (if (s.sayac) 1 else 0),
                        Intent(context, AliskanlikWidget::class.java)
                            .setAction(ACTION_ISARETLE)
                            .putExtra(AlarmScheduler.EXTRA_HABIT_ID, s.id)
                            .putExtra(EXTRA_SAYAC, s.sayac),
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    satir.setOnClickPendingIntent(R.id.satir_buton_alan, isaretle)
                }
                views.addView(R.id.widget_satirlar, satir)
            }
            views.setViewVisibility(R.id.widget_bos, if (satirlar.isEmpty()) View.VISIBLE else View.GONE)
            val fazla = satirlar.size - EN_COK_SATIR
            views.setViewVisibility(R.id.widget_daha, if (fazla > 0) View.VISIBLE else View.GONE)
            if (fazla > 0) views.setTextViewText(R.id.widget_daha, "+$fazla alışkanlık daha")
            views.setOnClickPendingIntent(R.id.widget_daha, uygulamayiAc)
            manager.updateAppWidget(widgetId, views)
        }
    }
}
