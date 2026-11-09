package com.noralaliskanlik

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import org.json.JSONObject
import java.time.LocalDate
import java.time.temporal.ChronoUnit

/**
 * Haftada bir sessiz yedek: veri her kaydedildiğinde çağrılır, son otomatik yedekten bu yana
 * 7 gün geçtiyse İndirilenler klasörüne bir JSON yazar. Son iki yedek tutulur, eskisi silinir.
 * Amaç: telefon bozulsa ya da uygulama silinse bile en fazla bir haftalık kayıt kaybolsun.
 * (Android 10+; daha eski sürümlerde depolama izni gerektiği için yalnız elle yedek var.)
 */
object OtomatikYedek {
    private const val PREFS = "noral_yedek"
    private const val KEY_SON = "son_gun"
    private const val KEY_URILER = "uriler"
    private const val ARALIK_GUN = 7L
    private const val TUTULAN = 2

    /** Son otomatik yedeğin günü (YYYY-AA-GG); hiç alınmadıysa boş metin. */
    fun sonTarih(context: Context): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_SON, "") ?: ""

    /** Zamanı geldiyse yedek alır. Hiçbir hata uygulamayı etkilemez: sessizce vazgeçer. */
    @Synchronized
    fun gerekirse(context: Context, json: String) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || json.isBlank()) return
            // Boş kayıt yedeklenmez (ilk açılış ya da her şey silinmişse eski yedek korunur)
            if ((JSONObject(json).optJSONArray("habits")?.length() ?: 0) == 0) return
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val bugun = LocalDate.now()
            val son = prefs.getString(KEY_SON, "") ?: ""
            if (son.isNotEmpty()) {
                val gecen = try { ChronoUnit.DAYS.between(LocalDate.parse(son), bugun) } catch (e: Exception) { ARALIK_GUN }
                if (gecen in 0 until ARALIK_GUN) return
            }
            val uri = indirilenlereYaz(context, "noral-aliskanlik-otomatik-yedek-$bugun.json", json) ?: return
            val hepsi = (prefs.getString(KEY_URILER, "") ?: "").split("\n").filter { it.isNotBlank() } + uri.toString()
            // Eskileri sil: yalnız son iki otomatik yedek kalsın (elle alınan yedeklere dokunulmaz)
            hepsi.dropLast(TUTULAN).forEach {
                try { context.contentResolver.delete(Uri.parse(it), null, null) } catch (e: Exception) { /* zaten yoksa geç */ }
            }
            prefs.edit()
                .putString(KEY_SON, bugun.toString())
                .putString(KEY_URILER, hepsi.takeLast(TUTULAN).joinToString("\n"))
                .apply()
        } catch (e: Exception) {
            // Yedek alınamadıysa bir sonraki kayıtta yeniden denenir
        }
    }

    /** İndirilenler klasörüne dosya yazar (Android 10+, izin gerekmez). Başarısızsa null. */
    fun indirilenlereYaz(context: Context, ad: String, json: String): Uri? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return null
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, ad)
            put(MediaStore.Downloads.MIME_TYPE, "application/json")
            put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
        }
        val resolver = context.contentResolver
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return null
        val yazildi = resolver.openOutputStream(uri)?.use { it.write(json.toByteArray(Charsets.UTF_8)); true } ?: false
        if (!yazildi) {
            try { resolver.delete(uri, null, null) } catch (e: Exception) { /* geç */ }
            return null
        }
        return uri
    }
}
