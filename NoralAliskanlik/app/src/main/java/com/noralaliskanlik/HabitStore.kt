package com.noralaliskanlik

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate

/**
 * Alışkanlık verisinin tek kaynağı: SharedPreferences içinde tek bir JSON metni.
 * localStorage yerine burada tutulduğu için uygulama güncellenince silinmez.
 * JSON'un biçimini JS tarafı (assets/js/habits.js) belirler; Kotlin yalnızca
 * bildirimler için gerekli alanları (id, name, icon, time, done) okur.
 */
object HabitStore {
    private const val PREFS = "noral_aliskanlik"
    private const val KEY_DATA = "data"
    private const val KEY_SETTINGS = "settings"

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
            val today = LocalDate.now().toString()
            for (i in 0 until habits.length()) {
                val h = habits.optJSONObject(i) ?: continue
                if (h.optString("id") != habitId) continue
                val done = h.optJSONArray("done") ?: JSONArray()
                val dates = (0 until done.length()).map { done.optString(it) }.toMutableSet()
                if (!dates.add(today)) return false
                h.put("done", JSONArray(dates.sorted()))
                return save(context, root.toString())
            }
            false
        } catch (e: Exception) {
            false // Bozuk kayıtta hiçbir şeye dokunma
        }
    }

    /** Bildirim için gereken alışkanlık özeti. */
    data class Reminder(val id: String, val name: String, val icon: String, val time: String, val doneToday: Boolean)

    /** Kayıttaki tüm alışkanlıkları hatırlatma bilgisiyle döndürür. Bozuk kayıtta boş liste. */
    fun reminders(context: Context): List<Reminder> {
        val raw = load(context)
        if (raw.isBlank()) return emptyList()
        return try {
            val today = LocalDate.now().toString() // YYYY-MM-DD, yerel saat
            val habits: JSONArray = JSONObject(raw).optJSONArray("habits") ?: return emptyList()
            (0 until habits.length()).mapNotNull { i ->
                val h = habits.optJSONObject(i) ?: return@mapNotNull null
                val done = h.optJSONArray("done") ?: JSONArray()
                val doneToday = (0 until done.length()).any { done.optString(it) == today }
                Reminder(
                    id = h.optString("id"),
                    name = h.optString("name"),
                    icon = h.optString("icon"),
                    time = h.optString("time"),
                    doneToday = doneToday
                )
            }.filter { it.id.isNotEmpty() }
        } catch (e: Exception) {
            emptyList()
        }
    }
}
