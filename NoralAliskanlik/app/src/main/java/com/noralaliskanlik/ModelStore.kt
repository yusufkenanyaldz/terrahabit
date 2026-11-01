package com.noralaliskanlik

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import org.json.JSONObject
import java.io.File

/**
 * Kullanıcının seçtiği beyin modelini uygulamanın iç depolamasında (filesDir/model) tutar.
 * Dosya WebView'a https://appassets.androidplatform.net/model/<ad> adresinden sunulur
 * (MainActivity'deki InternalStoragePathHandler).
 */
object ModelStore {
    private const val DIR = "model"
    private const val BASE = "beyin" // beyin.glb veya beyin.gltf

    fun dir(context: Context): File = File(context.filesDir, DIR).apply { mkdirs() }

    /** Kayıtlı model dosyası (yoksa null). */
    fun current(context: Context): File? =
        dir(context).listFiles()?.firstOrNull { it.name == "$BASE.glb" || it.name == "$BASE.gltf" }

    /** JS için model bilgisi: {"exists":true,"url":"...","name":"..."} */
    fun infoJson(context: Context): String {
        val f = current(context) ?: return """{"exists":false}"""
        return JSONObject()
            .put("exists", true)
            // ?v= : yeni model aynı adla kaydedilince WebView eski dosyayı önbellekten vermesin
            .put("url", "https://appassets.androidplatform.net/$DIR/${f.name}?v=${f.lastModified()}")
            .put("name", f.name)
            .put("size", f.length())
            .toString()
    }

    /**
     * Seçilen dosyayı kopyalar. Önce geçici dosyaya yazar ve içeriğini doğrular;
     * yalnızca geçerliyse eski modelin yerine koyar (bozuk seçim eski modeli silmez).
     * Hata varsa Türkçe açıklamayla IllegalArgumentException fırlatır.
     */
    fun importFrom(context: Context, uri: Uri) {
        val name = displayName(context, uri)?.lowercase() ?: ""
        val tmp = File(dir(context), "yeni.tmp")
        context.contentResolver.openInputStream(uri)?.use { input ->
            tmp.outputStream().use { input.copyTo(it, 256 * 1024) }
        } ?: throw IllegalArgumentException("Dosya açılamadı")

        // İlk baytlara bakarak tür belirle: GLB "glTF" ile başlar, GLTF bir JSON'dur.
        val head = ByteArray(4)
        val n = tmp.inputStream().use { it.read(head) }
        val ext = when {
            n == 4 && String(head, Charsets.US_ASCII) == "glTF" -> "glb"
            n > 0 && firstNonSpace(tmp) == '{' -> "gltf"
            else -> {
                tmp.delete()
                throw IllegalArgumentException(
                    if (name.endsWith(".glb") || name.endsWith(".gltf")) "Dosya bozuk görünüyor"
                    else "Lütfen .glb veya .gltf dosyası seçin"
                )
            }
        }
        // Eski modeli sil, yenisini yerine koy.
        dir(context).listFiles()?.filter { it.name.startsWith("$BASE.") }?.forEach { it.delete() }
        val target = File(dir(context), "$BASE.$ext")
        if (!tmp.renameTo(target)) {
            tmp.copyTo(target, overwrite = true)
            tmp.delete()
        }
    }

    private fun firstNonSpace(f: File): Char? =
        f.inputStream().buffered().use { s ->
            var c = s.read()
            while (c == ' '.code || c == '\n'.code || c == '\r'.code || c == '\t'.code || c == 0xEF || c == 0xBB || c == 0xBF) c = s.read()
            if (c < 0) null else c.toChar()
        }

    private fun displayName(context: Context, uri: Uri): String? =
        context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
            ?.use { c -> if (c.moveToFirst()) c.getString(0) else null }
}
