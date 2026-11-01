package com.noralaliskanlik

import android.Manifest
import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.DocumentsContract
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import kotlin.concurrent.thread

/**
 * Tek ekran: tam ekran WebView. HTML/JS, WebViewAssetLoader ile
 * https://appassets.androidplatform.net/assets/ adresinden yüklenir
 * (file:// değil — ES modülleri ve GLB yüklemesi böylece CORS hatası vermez).
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    // Bildirimden "Yaptım" denince veri değişir: açık ekrandaki JS veriyi yeniden okusun.
    private val dataChanged = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            webView.evaluateJavascript("window.NoralApp && NoralApp.reload()", null)
        }
    }

    // Android 13+ bildirim izni isteği
    private val notifPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    // Android 8-9 yedekleme için depolama izni isteği
    private val storagePermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) Toast.makeText(this, "İzin verildi, yedeklemeyi tekrar deneyin", Toast.LENGTH_SHORT).show()
        }

    // Geri yükleme: dosya seçici, Downloads klasöründe açılır
    private val backupPicker =
        registerForActivityResult(object : ActivityResultContracts.OpenDocument() {
            override fun createIntent(context: Context, input: Array<String>): Intent =
                super.createIntent(context, input).apply {
                    putExtra(
                        DocumentsContract.EXTRA_INITIAL_URI,
                        Uri.parse("content://com.android.externalstorage.documents/document/primary%3ADownload")
                    )
                }
        }) { uri -> uri?.let { readBackup(it) } }

    // Beyin modeli seçici (WebView'daki <input type="file"> → onShowFileChooser buraya gelir).
    // .glb dosyalarının MIME türü telefona göre değiştiği için tüm dosyalar gösterilir;
    // içerik ModelStore'da doğrulanır.
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private val modelPicker =
        registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
            // Dosyayı JS'e vermiyoruz (25 MB+ köprüden geçmesin); WebView'a "iptal" deyip
            // dosyayı doğrudan iç depolamaya kopyalıyoruz.
            fileCallback?.onReceiveValue(null)
            fileCallback = null
            if (uri != null) importModel(uri)
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enterFullscreen()

        // Debug derlemede Chrome'dan (chrome://inspect) WebView'a bakılabilsin.
        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        // assets/ klasörünü ve iç depolamadaki modeli güvenli https adresinden sun.
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/model/", WebViewAssetLoader.InternalStoragePathHandler(this, ModelStore.dir(this)))
            .build()

        webView = WebView(this).apply {
            setBackgroundColor(android.graphics.Color.BLACK)
            setLayerType(WebView.LAYER_TYPE_HARDWARE, null) // GPU ile çizim
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false   // file:// kapalı
            settings.allowContentAccess = false
            settings.mediaPlaybackRequiresUserGesture = true
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    assetLoader.shouldInterceptRequest(request.url)
            }
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    view: WebView,
                    callback: ValueCallback<Array<Uri>>,
                    params: FileChooserParams
                ): Boolean {
                    fileCallback?.onReceiveValue(null) // Önceki açık istek varsa kapat
                    fileCallback = callback
                    return try {
                        modelPicker.launch(arrayOf("*/*"))
                        true
                    } catch (e: Exception) {
                        fileCallback = null
                        false
                    }
                }
            }
            addJavascriptInterface(WebAppBridge(this@MainActivity), "AndroidBridge")
        }
        setContentView(webView)
        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html")

        // Geri tuşu: önce JS'teki açık pencereyi kapat, yoksa uygulamadan çık.
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript("window.NoralApp ? NoralApp.handleBack() : false") { r ->
                    if (r != "true") finish()
                }
            }
        })

        ContextCompat.registerReceiver(
            this, dataChanged, IntentFilter(DoneReceiver.ACTION_DATA_CHANGED),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )

        ReminderReceiver.ensureChannel(this)
        askNotificationPermission()
        AlarmScheduler.scheduleAll(this) // Uygulama açılışında alarmları tazele
    }

    /** Durum ve gezinme çubuklarını gizle; kenardan kaydırınca geçici görünsün. */
    private fun enterFullscreen() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) enterFullscreen()
    }

    private fun askNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    /** Android 8-9'da yazma izni var mı? Yoksa iste ve false döndür. */
    fun ensureLegacyStoragePermission(): Boolean {
        val p = Manifest.permission.WRITE_EXTERNAL_STORAGE
        if (ContextCompat.checkSelfPermission(this, p) == PackageManager.PERMISSION_GRANTED) return true
        runOnUiThread { storagePermission.launch(p) }
        return false
    }

    fun openBackupPicker() {
        backupPicker.launch(arrayOf("application/json", "text/*", "application/octet-stream"))
    }

    /** Modeli arka planda iç depolamaya kopyala; bitince JS'e haber ver. */
    private fun importModel(uri: Uri) {
        webView.evaluateJavascript("window.NoralApp && NoralApp.onModelCopyStart()", null)
        thread(name = "model-kopya") {
            val js = try {
                ModelStore.importFrom(this, uri)
                "NoralApp.onModelSaved(${JSONObject.quote(ModelStore.infoJson(this))})"
            } catch (e: Exception) {
                "NoralApp.onModelError(${JSONObject.quote(e.message ?: "Model kaydedilemedi")})"
            }
            runOnUiThread { webView.evaluateJavascript(js, null) }
        }
    }

    /** Seçilen yedek dosyasını oku ve JS'e ver (JS doğrular ve onay ister). */
    private fun readBackup(uri: Uri) {
        val text = try {
            contentResolver.openInputStream(uri)?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }
        } catch (e: Exception) {
            null
        }
        if (text == null) {
            Toast.makeText(this, "Dosya okunamadı", Toast.LENGTH_SHORT).show()
            return
        }
        // JSONObject.quote: metni güvenli bir JS dizgesine çevirir.
        webView.evaluateJavascript("NoralApp.onImport(${JSONObject.quote(text)})", null)
    }

    // Arka plandayken 3D çizimi durdur: pil ve ısınma için.
    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        // Gün değişmiş olabilir: JS kaçırılan günleri yeniden kontrol etsin.
        webView.evaluateJavascript("window.NoralApp && NoralApp.onResume()", null)
    }

    override fun onDestroy() {
        unregisterReceiver(dataChanged)
        webView.destroy()
        super.onDestroy()
    }
}
