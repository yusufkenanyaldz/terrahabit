package com.noralaliskanlik

import android.os.Bundle
import android.view.Gravity
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

/**
 * Health Connect'in "bu uygulama verini neden istiyor?" ekranı. Android bu ekranı
 * bildirilmemiş uygulamalara sağlık izni vermiyor; o yüzden basit bir açıklama yeterli.
 */
class SaglikIzinActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(TextView(this).apply {
            setPadding(56, 120, 56, 56)
            gravity = Gravity.TOP
            textSize = 16f
            text = "Nöral Alışkanlık, Samsung Health'in Health Connect'e yazdığı günlük adım " +
                "sayını yalnızca okur. Adımlar, \"Samsung Health'ten doldur\" seçtiğin alışkanlığın " +
                "(ör. Yürüyüş) günlük süresine çevrilir (102 adım = 1 dakika).\n\n" +
                "Veri telefonundan dışarı çıkmaz, hiçbir yere gönderilmez ve uygulama Health " +
                "Connect'e hiçbir şey yazmaz."
        })
    }
}
