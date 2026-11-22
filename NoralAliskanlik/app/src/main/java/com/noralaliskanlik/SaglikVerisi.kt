package com.noralaliskanlik

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.metadata.Device
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * Samsung Health'in Health Connect'e yazdığı adımları okur (yalnız okuma, hiçbir şey yazmaz).
 * Gün sınırı takvim günü (gece yarısı), Samsung Health'teki "Bugün" ile aynı olsun diye.
 * Telefon ve saat aynı dakikayı ayrı ayrı yazar; burada dakika dakika birleştirilir (bkz. adimlar).
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
     * Neden aggregate değil: Samsung Health telefonun ve saatin adımlarını AYNI uygulama adıyla
     * ayrı ayrı yazıyor; Health Connect'in toplamı bunları birbirine ekliyor (ilk denemede
     * 14.325 adım 26.959 çıktı). Samsung'un kendisi iki cihazı dakika dakika birleştirip
     * aynı anda yalnız birini sayıyor. Burada da aynısı yapılır: her kayıt kendi süresine
     * eşit dağıtılarak dakikalara bölünür, her dakikada cihazlar arasından EN YÜKSEĞİ alınır.
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
                val dakikaSayisi = ((bit.epochSecond - bas.epochSecond) / 60).toInt() // yaz saati günlerinde 1380/1500
                val cihazlar = HashMap<String, DoubleArray>()
                val cihazToplam = HashMap<String, Double>()
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
                        val ad = cihazAdi(r)
                        val dizi = cihazlar.getOrPut(ad) { DoubleArray(dakikaSayisi) }
                        cihazToplam[ad] = (cihazToplam[ad] ?: 0.0) + r.count
                        dagit(dizi, r.startTime, r.endTime, r.count.toDouble(), bas)
                    }
                    token = yanit.pageToken
                } while (!token.isNullOrEmpty())
                var toplam = 0.0
                for (d in 0 until dakikaSayisi) {
                    var enCok = 0.0
                    for (dizi in cihazlar.values) if (dizi[d] > enCok) enCok = dizi[d]
                    toplam += enCok
                }
                adim.put(g, Math.round(toplam))
                val k = JSONObject()
                for ((ad, n) in cihazToplam) k.put(ad, Math.round(n))
                kaynaklar.put(g, k)
            } catch (e: Exception) {
                // İzin geri alınmış ya da gün okunamadı: o günü atla
            }
        }
        return sonuc
    }

    /** Kaydı yazan cihaz: "saat", "telefon" ya da başka bir uygulamaysa onun adı. */
    private fun cihazAdi(r: StepsRecord): String {
        val tur = when (r.metadata.device?.type) {
            Device.TYPE_WATCH -> "saat"
            Device.TYPE_PHONE -> "telefon"
            Device.TYPE_RING -> "yüzük"
            Device.TYPE_FITNESS_BAND -> "bileklik"
            else -> "diğer"
        }
        val paket = r.metadata.dataOrigin.packageName
        val model = r.metadata.device?.model ?: ""
        return if (paket.contains("shealth")) "$tur $model".trim() else "$tur ($paket)"
    }

    /** Kaydın adımını kapsadığı dakikalara süreyle orantılı dağıtır. */
    private fun dagit(dizi: DoubleArray, bas: Instant, bit: Instant, adim: Double, gunBas: Instant) {
        val s0 = (bas.epochSecond - gunBas.epochSecond).toDouble()
        val s1 = (bit.epochSecond - gunBas.epochSecond).toDouble()
        if (s1 <= s0) {
            val d = (s0 / 60).toInt()
            if (d in dizi.indices) dizi[d] += adim
            return
        }
        val sure = s1 - s0
        var d = (s0 / 60).toInt()
        while (d * 60.0 < s1) {
            val ust = minOf(s1, (d + 1) * 60.0)
            val alt = maxOf(s0, d * 60.0)
            if (d in dizi.indices && ust > alt) dizi[d] += adim * (ust - alt) / sure
            d++
        }
    }
}
