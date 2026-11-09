package com.noralaliskanlik

import android.os.Build
import android.os.Environment
import android.webkit.JavascriptInterface
import java.io.File
import java.time.LocalDate

/**
 * JS'in Android'e eriştiği köprü. JS tarafında `window.AndroidBridge` olarak görünür.
 * Not: @JavascriptInterface metotları arka plan iş parçacığında çalışır.
 */
class WebAppBridge(private val activity: MainActivity) {

    /** Kayıtlı veriyi JSON metni olarak verir (yoksa ""). */
    @JavascriptInterface
    fun load(): String = HabitStore.load(activity)

    /** Veriyi kaydeder ve alarmları güncel listeye göre yeniden kurar. */
    @JavascriptInterface
    fun save(json: String): Boolean {
        val ok = HabitStore.save(activity, json)
        AlarmScheduler.scheduleAll(activity)
        AliskanlikWidget.guncelleHepsi(activity) // Ana ekran widget'ı da güncellensin
        if (ok) OtomatikYedek.gerekirse(activity, json) // Haftada bir sessiz yedek
        return ok
    }

    /** Son otomatik yedeğin günü (YYYY-AA-GG) ya da "". */
    @JavascriptInterface
    fun autoBackupInfo(): String = OtomatikYedek.sonTarih(activity)

    /** Ayar paneli değerleri (JSON). */
    @JavascriptInterface
    fun loadSettings(): String = HabitStore.loadSettings(activity)

    @JavascriptInterface
    fun saveSettings(json: String): Boolean {
        val ok = HabitStore.saveSettings(activity, json)
        AlarmScheduler.scheduleAll(activity) // Akşam hatırlatması açılıp kapanmış olabilir
        return ok
    }

    /** Telefonda kayıtlı beyin modeli bilgisi (JSON). */
    @JavascriptInterface
    fun modelInfo(): String = ModelStore.infoJson(activity)

    /**
     * Yedeği Downloads klasörüne yazar.
     * Başarılıysa dosya adını, hata olursa "HATA: ..." döndürür.
     */
    @JavascriptInterface
    fun exportBackup(json: String): String {
        val name = "noral-aliskanlik-yedek-${LocalDate.now()}.json"
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+: izin gerektirmeyen MediaStore yolu.
                OtomatikYedek.indirilenlereYaz(activity, name, json) ?: return "HATA: Dosya oluşturulamadı"
            } else {
                // Android 8-9: doğrudan Downloads klasörüne yaz (WRITE_EXTERNAL_STORAGE gerekir).
                if (!activity.ensureLegacyStoragePermission()) return "HATA: Depolama izni verilmedi, tekrar deneyin"
                val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                dir.mkdirs()
                File(dir, name).writeText(json, Charsets.UTF_8)
            }
            name
        } catch (e: Exception) {
            "HATA: ${e.message}"
        }
    }

    /** Dosya seçiciyi (Downloads'ta) açar; seçilen dosya JS'e NoralApp.onImport ile gelir. */
    @JavascriptInterface
    fun requestImport() {
        activity.runOnUiThread { activity.openBackupPicker() }
    }
}
