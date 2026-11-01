package com.noralaliskanlik

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId

/**
 * Her alışkanlık için bir sonraki hatırlatma saatine alarm kurar.
 * Alarm çalınca ReminderReceiver bir sonraki günün alarmını yeniden kurar.
 */
object AlarmScheduler {
    private const val PREFS = "noral_alarms"
    private const val KEY_IDS = "scheduled_ids"
    const val EXTRA_HABIT_ID = "habit_id"

    /** Önceki alarmların hepsini iptal edip kayıttaki alışkanlıklara göre yeniden kurar. */
    fun scheduleAll(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        // Silinen alışkanlıkların alarmları kalmasın diye önce eskileri iptal et.
        prefs.getStringSet(KEY_IDS, emptySet())?.forEach { cancel(context, it) }

        val reminders = HabitStore.reminders(context).filter { parseTime(it.time) != null }
        reminders.forEach { schedule(context, it.id, it.time) }
        prefs.edit().putStringSet(KEY_IDS, reminders.map { it.id }.toSet()).apply()
    }

    /** Tek bir alışkanlığın bir sonraki alarmını kurar ("HH:mm"). */
    fun schedule(context: Context, habitId: String, time: String) {
        val t = parseTime(time) ?: return
        val now = LocalDateTime.now()
        var next = LocalDateTime.of(LocalDate.now(), t)
        if (!next.isAfter(now)) next = next.plusDays(1) // Saat geçtiyse yarın
        val triggerAt = next.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()

        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = pendingIntent(context, habitId)
        // Tam zamanlı alarm izni varsa tam saatinde, yoksa birkaç dakika sapmayla.
        val canExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()
        try {
            if (canExact) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
            } else {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
            }
        } catch (e: SecurityException) {
            // İzin geri alınmışsa yaklaşık zamanlı alarma düş.
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
        }
    }

    private fun cancel(context: Context, habitId: String) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(pendingIntent(context, habitId))
    }

    /** Aynı alışkanlık için hep aynı PendingIntent (requestCode = id'nin hash'i). */
    private fun pendingIntent(context: Context, habitId: String): PendingIntent {
        val intent = Intent(context, ReminderReceiver::class.java).putExtra(EXTRA_HABIT_ID, habitId)
        intent.action = "com.noralaliskanlik.REMIND.$habitId"
        return PendingIntent.getBroadcast(
            context, habitId.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    /** "08:30" -> LocalTime; geçersizse null. */
    private fun parseTime(s: String): LocalTime? = try {
        val (h, m) = s.split(":").map { it.trim().toInt() }
        LocalTime.of(h, m)
    } catch (e: Exception) {
        null
    }
}
