package com.noralaliskanlik

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.core.app.NotificationManagerCompat

/** Bildirimdeki "Yaptım" butonu: bugünü işaretler, bildirimi kapatır, açık uygulamayı yeniler. */
class DoneReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val habitId = intent.getStringExtra(AlarmScheduler.EXTRA_HABIT_ID) ?: return
        val changed = HabitStore.markDoneToday(context, habitId)
        NotificationManagerCompat.from(context).cancel(habitId.hashCode())
        if (changed) {
            Toast.makeText(context, "Bugün tamamlandı", Toast.LENGTH_SHORT).show()
            // Uygulama açıksa ekrandaki veriyi yenilesin (eski veriyle üzerine yazmasın).
            context.sendBroadcast(Intent(ACTION_DATA_CHANGED).setPackage(context.packageName))
            AliskanlikWidget.guncelleHepsi(context)
        }
    }

    companion object {
        const val ACTION_DATA_CHANGED = "com.noralaliskanlik.VERI_DEGISTI"

        fun pendingIntent(context: Context, habitId: String): PendingIntent {
            val intent = Intent(context, DoneReceiver::class.java)
                .setAction("com.noralaliskanlik.DONE.$habitId")
                .putExtra(AlarmScheduler.EXTRA_HABIT_ID, habitId)
            return PendingIntent.getBroadcast(
                context, habitId.hashCode() + 1, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }
    }
}
