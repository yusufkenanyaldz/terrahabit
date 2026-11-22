package com.noralaliskanlik

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId

/**
 * Samsung Health'in Health Connect'e yazdığı adımları okur (yalnız okuma, hiçbir şey yazmaz).
 * Gün sınırı takvim günü (gece yarısı), Samsung Health'teki "Bugün" ile aynı olsun diye.
 * Aynı adımları birden çok kaynak yazabilir; en büyük kaynak toplamı alınır (bkz. adimlar).
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

    /**
     * Verilen günlerin (YYYY-AA-GG) adımı. Dönüş: {"adim": {gün: adım}, "kaynaklar": {gün: {kaynak: adım}}}.
     *
     * Aynı adımları birden çok kaynak yazıyor: Samsung Health ve Android'in kendi adım sayacı
     * (Health Connect'in "phone" kaynağı). Hazır toplam ikisini ekliyordu (14.325 → 26.959);
     * dakika dakika birleştirmek de işe yaramadı, çünkü kaynaklar kayıtları farklı uzunlukta
     * aralıklarla yazıyor (22 Kasım 2026, telefonda: Samsung 14.368, Android 14.368, sonuç
     * yine 26.979). Her kaynak günün tamamını ayrı ayrı ölçtüğü için doğru cevap: kaynakların
     * günlük toplamlarından EN BÜYÜĞÜ. Kaynak = kaydı yazan uygulama.
     */
    suspend fun adimlar(context: Context, gunler: List<String>): JSONObject {
        val adim = JSONObject()
        val kaynaklar = JSONObject()
        val sonuc = JSONObject().put("adim", adim).put("kaynaklar", kaynaklar)
        if (!kullanilabilir(context)) return sonuc
        val client = HealthConnectClient.getOrCreate(context)
        val bolge = ZoneId.systemDefault()
        for (g in gunler) {
            try {
                val gun = LocalDate.parse(g)
                val bas = gun.atStartOfDay(bolge).toInstant()
                val bit = gun.plusDays(1).atStartOfDay(bolge).toInstant()
                val cihazToplam = HashMap<String, Long>()
                var token: String? = null
                do {
                    val yanit = client.readRecords(
                        ReadRecordsRequest(
                            recordType = StepsRecord::class,
                            timeRangeFilter = TimeRangeFilter.between(bas, bit),
                            pageSize = 1000,
                            pageToken = token
                        )
                    )
                    for (r in yanit.records) {
                        val ad = kaynakAdi(r.metadata.dataOrigin.packageName)
                        cihazToplam[ad] = (cihazToplam[ad] ?: 0L) + r.count
                    }
                    token = yanit.pageToken
                } while (!token.isNullOrEmpty())
                adim.put(g, cihazToplam.values.maxOrNull() ?: 0L)
                val k = JSONObject()
                for ((ad, n) in cihazToplam) k.put(ad, n)
                kaynaklar.put(g, k)
            } catch (e: Exception) {
                // İzin geri alınmış ya da gün okunamadı: o günü atla
            }
        }
        return sonuc
    }

    /** Kaydı yazan uygulamanın okunur adı. */
    private fun kaynakAdi(paket: String): String = when {
        paket.contains("shealth") -> "Samsung Health"
        paket.startsWith("com.android.healthconnect") || paket.startsWith("com.google.android.apps.healthdata") -> "Android"
        else -> paket.substringAfterLast('.').ifEmpty { paket }
    }
}
