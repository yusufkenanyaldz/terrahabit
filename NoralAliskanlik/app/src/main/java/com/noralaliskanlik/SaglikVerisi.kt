package com.noralaliskanlik

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import org.json.JSONObject
import java.time.LocalDate

/**
 * Samsung Health'in Health Connect'e yazdığı adımları okur (yalnız okuma, hiçbir şey yazmaz).
 * Gün sınırı takvim günü (gece yarısı), Samsung Health'teki "Bugün" ile aynı olsun diye.
 * Telefon ve saat aynı adımı iki kez yazsa bile aggregate tekrarları ayıklar.
 */
object SaglikVerisi {
    /** İstenen tek izin: adım okuma. */
    val IZINLER: Set<String> = setOf(HealthPermission.getReadPermission(StepsRecord::class))

    /** "var": Health Connect kullanılabilir mi; "guncelle": sağlayıcı güncellenmeli mi. */
    fun durum(context: Context): Int = HealthConnectClient.getSdkStatus(context)

    fun kullanilabilir(context: Context): Boolean =
        durum(context) == HealthConnectClient.SDK_AVAILABLE

    suspend fun izinVar(context: Context): Boolean {
        if (!kullanilabilir(context)) return false
        val verilen = HealthConnectClient.getOrCreate(context).permissionController.getGrantedPermissions()
        return verilen.containsAll(IZINLER)
    }

    /** Verilen günlerin (YYYY-AA-GG) toplam adımı: {"2026-11-22": 12629, ...}. Okunamayan gün yazılmaz. */
    suspend fun adimlar(context: Context, gunler: List<String>): JSONObject {
        val sonuc = JSONObject()
        if (!kullanilabilir(context)) return sonuc
        val client = HealthConnectClient.getOrCreate(context)
        for (g in gunler) {
            try {
                val gun = LocalDate.parse(g)
                val r = client.aggregate(
                    AggregateRequest(
                        metrics = setOf(StepsRecord.COUNT_TOTAL),
                        timeRangeFilter = TimeRangeFilter.between(gun.atStartOfDay(), gun.plusDays(1).atStartOfDay())
                    )
                )
                sonuc.put(g, r[StepsRecord.COUNT_TOTAL] ?: 0L)
            } catch (e: Exception) {
                // İzin geri alınmış ya da gün okunamadı: o günü atla
            }
        }
        return sonuc
    }
}
