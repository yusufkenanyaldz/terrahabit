package com.noralaliskanlik

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import kotlin.math.roundToInt
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

    // -----------------------------------------------------------------------
    // Ana ekran widget'ı
    // -----------------------------------------------------------------------

    /** Aşama adları ve renkleri (JS brain-scene.js ile aynı). */
    private val ASAMA_RENK = arrayOf("#FF7B1C", "#A855F7", "#0EA5E9", "#00E5FF")

    /**
     * Widget'ın bir satırı.
     * durum: "yapildi" | "bekliyor" | "duraklatildi" | "plansiz"
     * bilgi: kısa alt yazı (ör. "%52", "3/8 · %52", "Duraklatıldı")
     * sayac: miktarlı alışkanlık ("+" düğmesi de gösterilir)
     */
    data class WidgetSatiri(
        val id: String,
        val ad: String,
        val ikon: String,
        val bilgi: String,
        val asama: Int,
        val guc: Int,
        val renk: Int,
        val durum: String,
        val sayac: Boolean,
        val sinirli: Boolean = false // Günlük sınırlı kötü alışkanlık (✓ yok, yalnızca +1)
    )

    /** Arşivde olmayan alışkanlıklar için widget satırları. Bozuk kayıtta boş liste. */
    fun widgetSatirlari(context: Context): List<WidgetSatiri> {
        val raw = load(context)
        if (raw.isBlank()) return emptyList()
        return try {
            val bugunKey = todayKey()
            val bugun = LocalDate.parse(bugunKey)
            val habits = JSONObject(raw).optJSONArray("habits") ?: return emptyList()
            (0 until habits.length()).mapNotNull { i ->
                val h = habits.optJSONObject(i) ?: return@mapNotNull null
                if (h.optBoolean("arsiv", false) || h.optString("id").isEmpty()) return@mapNotNull null
                val kotu = h.optString("tip") == "kotu"
                val done = kume(h.optJSONArray("done"))
                val z = h.optJSONObject("zamanlama")
                val miktar = h.optJSONObject("miktar")
                val yapildi = bugunKey in done
                // Güç ve aşama: uygulamanın bugün için bıraktığı önbellekten, bugünkü işarete göre
                // (widget'tan ✓ / +1 yapılınca uygulamayı açmadan doğru yüzde)
                val (guc, asama) = gucHesapla(h, bugunKey, done, miktar)
                var durum = if (yapildi) "yapildi" else "bekliyor"
                var bilgi = "%$guc"
                var sayac = false
                when {
                    duraklatildi(h, bugunKey) -> { durum = "duraklatildi"; bilgi = "Duraklatıldı" }
                    z?.optString("tur") == "haftalik" -> {
                        val pazartesi = bugun.minusDays(((jsGunu(bugun) + 6) % 7).toLong())
                        var yapilan = 0
                        var g = pazartesi
                        while (!g.isAfter(bugun)) { if (g.toString() in done) yapilan++; g = g.plusDays(1) }
                        bilgi = "$yapilan/${z?.optInt("hedef", 3) ?: 3} · %$guc"
                    }
                    miktar != null -> {
                        sayac = true
                        val m = h.optJSONObject("gunMiktar")?.optInt(bugunKey, 0) ?: 0
                        val hedef = miktar.optInt("hedef", 1)
                        bilgi = "$m/$hedef · %$guc"
                        durum = if (!kotu && m >= hedef) "yapildi" else "bekliyor"
                    }
                    !planli(z, bugun) && !yapildi -> { durum = "plansiz"; bilgi = "Plan dışı · %$guc" }
                }
                WidgetSatiri(
                    id = h.optString("id"),
                    ad = h.optString("name"),
                    ikon = h.optString("ikon", "genel"),
                    bilgi = bilgi,
                    asama = asama,
                    guc = guc,
                    renk = android.graphics.Color.parseColor(ASAMA_RENK[asama]),
                    durum = durum,
                    sayac = sayac,
                    sinirli = kotu && miktar != null
                )
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    /** Aşama yukarı eşikleri (JS parametreler.js ASAMA_YUKARI ile aynı). */
    private val ASAMA_YUKARI = doubleArrayOf(0.50, 0.845, 0.95)

    /**
     * Bugünkü işarete göre güç (0–100) ve aşama. Uygulama her kayıtta "widget" önbelleği bırakır:
     * H0 (bugün hariç güç), a (bugün tam yapılırsa kazanım katsayısı), asama0.
     * H = H0 + a · q · (1 − H0); q bugünkü oran (miktarlıda miktar/hedef, yarının altı 0).
     * Önbellek bugüne ait değilse (uygulama bugün hiç açılmadı) son kayıtlı değer gösterilir.
     */
    private fun gucHesapla(h: JSONObject, bugun: String, done: Set<String>, miktar: JSONObject?): Pair<Int, Int> {
        val w = h.optJSONObject("widget")
        if (w == null || w.optString("bugun") != bugun) {
            return h.optInt("guc", 0).coerceIn(0, 100) to h.optInt("asama", 0).coerceIn(0, 3)
        }
        val h0 = w.optDouble("H0", 0.0)
        val a = w.optDouble("a", 0.0)
        val q = when {
            miktar == null -> if (bugun in done) 1.0 else 0.0
            // Sınırlı kötü alışkanlıkta bugün kapanmadan "temiz gün" kazanımı verilmez (JS ile aynı)
            h.optString("tip") == "kotu" -> 0.0
            else -> {
                val hedef = miktar.optInt("hedef", 1).coerceAtLeast(1)
                val oran = minOf(1.0, (h.optJSONObject("gunMiktar")?.optInt(bugun, 0) ?: 0).toDouble() / hedef)
                if (oran >= 0.5) oran else 0.0
            }
        }
        val H = h0 + a * q * (1 - h0)
        var asama = w.optInt("asama0", 0).coerceIn(0, 3)
        while (asama < 3 && H >= ASAMA_YUKARI[asama] - 1e-12) asama++
        return (H * 100).roundToInt().coerceIn(0, 100) to asama
    }

    /** Kayıttaki alışkanlığı bul ve değiştir; değiştiyse kaydet. */
    @Synchronized
    private fun degistir(context: Context, habitId: String, islem: (JSONObject, String) -> String?): String? {
        val raw = load(context)
        if (raw.isBlank()) return null
        return try {
            val root = JSONObject(raw)
            val habits = root.optJSONArray("habits") ?: return null
            for (i in 0 until habits.length()) {
                val h = habits.optJSONObject(i) ?: continue
                if (h.optString("id") != habitId) continue
                if (duraklatildi(h, todayKey())) return null
                val mesaj = islem(h, todayKey()) ?: return null
                return if (save(context, root.toString())) mesaj else null
            }
            null
        } catch (e: Exception) {
            null // Bozuk kayıtta hiçbir şeye dokunma
        }
    }

    private fun kumeYaz(h: JSONObject, alan: String, kume: Set<String>) {
        h.put(alan, JSONArray(kume.sorted()))
    }

    /**
     * Widget'taki onay: bugünü işaretle ya da (yanlışlıkla basıldıysa) geri al.
     * Miktarlı iyi alışkanlıkta miktar hedefe çıkar ya da (zaten tamsa) sıfırlanır —
     * durum miktardan hesaplandığı için yalnızca "done" listesini değiştirmek görünmez kalırdı.
     * Dönüş: kullanıcıya gösterilecek kısa mesaj (null = değişmedi).
     */
    fun toggleDoneToday(context: Context, habitId: String): String? = degistir(context, habitId) { h, bugun ->
        val ad = h.optString("name")
        val done = kume(h.optJSONArray("done")).toMutableSet()
        val miktar = h.optJSONObject("miktar")
        val mesaj: String
        if (miktar != null) {
            if (h.optString("tip") == "kotu") return@degistir null // Sınırlı kötü alışkanlıkta yalnızca +1
            val gunMiktar = h.optJSONObject("gunMiktar") ?: JSONObject().also { h.put("gunMiktar", it) }
            val hedef = miktar.optInt("hedef", 1)
            if (gunMiktar.optInt(bugun, 0) >= hedef) {
                gunMiktar.put(bugun, 0); done.remove(bugun); mesaj = "$ad: işaret kaldırıldı"
            } else {
                gunMiktar.put(bugun, hedef); done.add(bugun); mesaj = "$ad: tamamlandı ($hedef/$hedef)"
            }
        } else if (done.remove(bugun)) {
            mesaj = "$ad: işaret kaldırıldı"
        } else {
            done.add(bugun); mesaj = "$ad: bugün yapıldı"
        }
        kumeYaz(h, "done", done)
        // Mazeret ile yapıldı aynı günde birlikte olmaz (JS setDayStatus ile aynı)
        kumeYaz(h, "mazeret", kume(h.optJSONArray("mazeret")) - bugun)
        mesaj
    }

    /**
     * Miktarlı alışkanlıkta +1. İyi alışkanlıkta miktar hedefin yarısına ulaşınca gün
     * "yapıldı" sayılır; kötüde sınırın altı "temiz" (JS setAmount ile aynı kural).
     */
    fun artir(context: Context, habitId: String): String? = degistir(context, habitId) { h, bugun ->
        val miktar = h.optJSONObject("miktar") ?: return@degistir null
        val gunMiktar = h.optJSONObject("gunMiktar") ?: JSONObject().also { h.put("gunMiktar", it) }
        val m = gunMiktar.optInt(bugun, 0) + 1
        gunMiktar.put(bugun, m)
        val hedef = miktar.optInt("hedef", 1)
        val basari = if (h.optString("tip") == "kotu") m <= hedef else m * 2 >= hedef
        val done = kume(h.optJSONArray("done")).toMutableSet()
        if (basari) done.add(bugun) else done.remove(bugun)
        kumeYaz(h, "done", done)
        kumeYaz(h, "mazeret", kume(h.optJSONArray("mazeret")) - bugun)
        "${h.optString("name")}: +1 ($m/$hedef)"
    }
}
