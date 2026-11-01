package com.noralaliskanlik

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Telefon yeniden başlayınca (veya uygulama güncellenince) alarmlar silinir; burada geri kurulur. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED ->
                AlarmScheduler.scheduleAll(context)
        }
    }
}
