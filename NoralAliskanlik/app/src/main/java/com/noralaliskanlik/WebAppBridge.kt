package com.noralaliskanlik

import android.content.ContentValues
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
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
        return ok
    }

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
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, name)
                    put(MediaStore.Downloads.MIME_TYPE, "application/json")
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                }
                val resolver = activity.contentResolver
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: return "HATA: Dosya oluşturulamadı"
                resolver.openOutputStream(uri)?.use { it.write(json.toByteArray(Charsets.UTF_8)) }
                    ?: return "HATA: Dosyaya yazılamadı"
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
