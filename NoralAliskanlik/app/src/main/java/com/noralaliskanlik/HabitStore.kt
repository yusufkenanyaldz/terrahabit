package com.noralaliskanlik

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * Alışkanlık verisinin tek kaynağı: SharedPreferences içinde tek bir JSON metni.
 * localStorage yerine burada tutulduğu için uygulama güncellenince silinmez.
 * JSON'un biçimini JS tarafı (assets/js/habits.js) belirler; Kotlin yalnızca
 * bildirimler için gerekli alanları (id, name, time, tip, done, mazeret, duraklatmalar,
 * zamanlama, arsiv, bakim) okur.
 */
object HabitStore {
    private const val PREFS = "noral_aliskanlik"
    private const val KEY_DATA = "data"
    private const val KEY_SETTINGS = "settings"

    /** Gün bu saatte başlar — JS'teki parametreler.js GUN_BASLANGIC_SAATI ile AYNI olmalı. */
    private const val GUN_BASLANGIC_SAATI = 4L

    /** Bugünün anahtarı (YYYY-MM-DD): gece 01:00 hâlâ önceki gün sayılır. */
    fun todayKey(): String = LocalDateTime.now().minusHours(GUN_BASLANGIC_SAATI).toLocalDate().toString()

    /** Kayıtlı JSON'u döndürür; hiç kayıt yoksa boş metin. */
    fun load(context: Context): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_DATA, "") ?: ""

    /** JSON'u kaydeder. commit(): yazma bitmeden dönmez, veri kaybını önler. */
    @Synchronized
    fun save(context: Context, json: String): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_DATA, json).commit()

    /** Ayar paneli değerleri (döndürme, bölge konumları, model yazarı) — JSON. */
    fun loadSettings(context: Context): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_SETTINGS, "") ?: ""

    fun saveSettings(context: Context, json: String): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_SETTINGS, json).commit()

    /**
     * Bildirimdeki "Yaptım" butonu için: alışkanlığa bugünün tarihini ekler.
     * Zaten varsa dokunmaz. Dönüş: değişiklik yapıldı mı.
     * (JS tarafındaki markDone ile aynı kural: günde bir kez.)
     */
    @Synchronized
    fun markDoneToday(context: Context, habitId: String): Boolean {
        val raw = load(context)
        if (raw.isBlank()) return false
        return try {
            val root = JSONObject(raw)
            val habits = root.optJSONArray("habits") ?: return false
            val today = todayKey()
            for (i in 0 until habits.length()) {
                val h = habits.optJSONObject(i) ?: continue
                if (h.optString("id") != habitId) continue
                val done = h.optJSONArray("done") ?: JSONArray()
                val dates = (0 until done.length()).map { done.optString(it) }.toMutableSet()
                if (!dates.add(today)) return false
                h.put("done", JSONArray(dates.sorted()))
                // Miktarlı iyi alışkanlık: "Yaptım" hedef miktarı yazar (JS setDayStatus ile aynı)
                val miktar = h.optJSONObject("miktar")
                if (miktar != null && h.optString("tip") != "kotu") {
                    val gunMiktar = h.optJSONObject("gunMiktar") ?: JSONObject().also { h.put("gunMiktar", it) }
                    gunMiktar.put(today, miktar.optInt("hedef", 1))
                }
                return save(context, root.toString())
            }
            false
        } catch (e: Exception) {
            false // Bozuk kayıtta hiçbir şeye dokunma
        }
    }

    /**
     * Bildirim için gereken alışkanlık özeti.
     * bildirimGerekli: bugün hatırlatma gösterilmeli mi (JS'teki kurallarla aynı mantık).
     */
    data class Reminder(
        val id: String,
        val name: String,
        val time: String,
        val kotu: Boolean,
        val bildirimGerekli: Boolean
    )

    /** JSON dizisini metin kümesine çevir. */
    private fun kume(a: JSONArray?): Set<String> =
        if (a == null) emptySet() else (0 until a.length()).map { a.optString(it) }.toSet()

    /** JS'teki haftaGunu ile aynı: 0 Pazar … 6 Cumartesi */
    private fun jsGunu(d: LocalDate): Int = d.dayOfWeek.value % 7

    /** Gün bir duraklatma aralığında mı? Açık uçlu aralık en fazla 30 gün (JS: DURAKLATMA_EN_UZUN). */
    private fun duraklatildi(h: JSONObject, gun: String): Boolean {
        val liste = h.optJSONArray("duraklatmalar") ?: return false
        for (i in 0 until liste.length()) {
            val d = liste.optJSONObject(i) ?: continue
            val bas = d.optString("bas")
            val bit = if (d.isNull("bit") || d.optString("bit").isEmpty())
                LocalDate.parse(bas).plusDays(29).toString() else d.optString("bit")
            if (gun >= bas && gun <= bit) return true
        }
        return false
    }

    /** Gün planlı mı? ("belirli günler" türünde yalnızca seçili günler) */
    private fun planli(z: JSONObject?, gun: LocalDate): Boolean {
        if (z == null || z.optString("tur") != "gunler") return true
        val gunler = z.optJSONArray("gunler") ?: return true
        return (0 until gunler.length()).any { gunler.optInt(it) == jsGunu(gun) }
    }

    /**
     * Bugün hatırlatma gerekiyor mu?
     * Gelmez: bugün yapıldı / duraklatıldı / mazeretli / planlı gün değil / haftalık hedef tamam.
     * Bakım modunda (Otomatik'ten 14 gün sonra) yalnızca bir kaçırmanın ertesi günü gelir.
     */
    private fun bildirimGerekli(h: JSONObject, bugunKey: String): Boolean {
        val bugun = LocalDate.parse(bugunKey)
        val done = kume(h.optJSONArray("done"))
        val mazeret = kume(h.optJSONArray("mazeret"))
        val z = h.optJSONObject("zamanlama")
        if (bugunKey in done || bugunKey in mazeret || duraklatildi(h, bugunKey)) return false
        // Günlük sınırlı kötü alışkanlık (ör. en fazla 5 sigara): hatırlatma gönderilmez
        if (h.optString("tip") == "kotu" && h.optJSONObject("miktar") != null) return false
        if (z?.optString("tur") == "haftalik") {
            val pazartesi = bugun.minusDays(((jsGunu(bugun) + 6) % 7).toLong())
            var yapilan = 0
            var g = pazartesi
            while (!g.isAfter(bugun)) { if (g.toString() in done) yapilan++; g = g.plusDays(1) }
            return yapilan < z.optInt("hedef", 3)
        }
        if (!planli(z, bugun)) return false
        if (h.optBoolean("bakim", false)) {
            // Bakım modu: dün planlı bir gün kaçırıldıysa hatırlat, yoksa sessiz kal
            val dun = bugun.minusDays(1)
            val dunKey = dun.toString()
            val kacirildi = planli(z, dun) && dunKey >= h.optString("createdAt") &&
                dunKey !in done && dunKey !in mazeret && !duraklatildi(h, dunKey)
            return kacirildi
        }
        return true
    }

    /** Arşivde olmayan alışkanlıkları hatırlatma bilgisiyle döndürür. Bozuk kayıtta boş liste. */
    fun reminders(context: Context): List<Reminder> {
        val raw = load(context)
        if (raw.isBlank()) return emptyList()
        return try {
            val today = todayKey()
            val habits: JSONArray = JSONObject(raw).optJSONArray("habits") ?: return emptyList()
            (0 until habits.length()).mapNotNull { i ->
                val h = habits.optJSONObject(i) ?: return@mapNotNull null
                if (h.optBoolean("arsiv", false)) return@mapNotNull null // Arşivdekine alarm kurulmaz
                Reminder(
                    id = h.optString("id"),
                    name = h.optString("name"),
                    time = h.optString("time"),
                    kotu = h.optString("tip") == "kotu",
                    bildirimGerekli = bildirimGerekli(h, today)
                )
            }.filter { it.id.isNotEmpty() }
        } catch (e: Exception) {
            emptyList()
        }
    }
}
