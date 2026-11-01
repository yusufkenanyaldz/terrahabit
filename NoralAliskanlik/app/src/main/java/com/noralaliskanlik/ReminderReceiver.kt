package com.noralaliskanlik

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/** Hatırlatma saati gelince çalışır: gerekiyorsa bildirim gösterir, yarının alarmını kurar. */
class ReminderReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val habitId = intent.getStringExtra(AlarmScheduler.EXTRA_HABIT_ID) ?: return
        val habit = HabitStore.reminders(context).firstOrNull { it.id == habitId } ?: return

        // Bir sonraki günün alarmını hemen kur (alarmlar tek seferliktir).
        AlarmScheduler.schedule(context, habit.id, habit.time)

        // Bugün zaten "yaptım" denmişse rahatsız etme.
        if (habit.doneToday) return
        showNotification(context, habit)
    }

    private fun showNotification(context: Context, habit: HabitStore.Reminder) {
        // Android 13+: izin verilmemişse bildirim gönderilemez.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) return

        ensureChannel(context)
        // Bildirime dokununca uygulama açılsın.
        val open = PendingIntent.getActivity(
            context, 0,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val n = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle("${habit.icon} ${habit.name}")
            .setContentText("Bugün henüz yapılmadı. Nöronların seni bekliyor!")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(open)
            .setAutoCancel(true)
            // Uygulamayı açmadan işaretlemek için "Yaptım" butonu
            .addAction(
                android.R.drawable.checkbox_on_background, "Yaptım ✓",
                DoneReceiver.pendingIntent(context, habit.id)
            )
            .build()
        try {
            NotificationManagerCompat.from(context).notify(habit.id.hashCode(), n)
        } catch (e: SecurityException) {
            // İzin son anda geri alındıysa sessizce geç.
        }
    }

    companion object {
        const val CHANNEL_ID = "habit_reminders"

        /** Android 8+ bildirim kanalı (bir kez oluşturulur). */
        fun ensureChannel(context: Context) {
            val nm = context.getSystemService(NotificationManager::class.java)
            if (nm.getNotificationChannel(CHANNEL_ID) == null) {
                nm.createNotificationChannel(
                    NotificationChannel(
                        CHANNEL_ID,
                        context.getString(R.string.channel_name),
                        NotificationManager.IMPORTANCE_DEFAULT
                    )
                )
            }
        }
    }
}
