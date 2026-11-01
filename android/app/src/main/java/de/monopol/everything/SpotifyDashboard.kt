package de.monopol.everything

import android.content.Intent
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView

@Composable fun SpotifyDashboard(language:String) {
    val context=LocalContext.current
    fun t(s:String)=Localizer.text(s,language)
    var view by remember {mutableStateOf<WebView?>(null)}
    var error by remember {mutableStateOf(false)}
    Column(Modifier.fillMaxWidth(),verticalArrangement=Arrangement.spacedBy(10.dp)) {
        Text("Spotify / vault.monopol-ai.de",style=MaterialTheme.typography.titleMedium)
        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            OutlinedButton(shape=RectangleShape,onClick={view?.reload();error=false}){Text(t("Dashboard neu laden"))}
            OutlinedButton(shape=RectangleShape,onClick={context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse("https://vault.monopol-ai.de/spotify")))}){Text(t("Extern öffnen"))}
        }
        if(error) Text(t("Dashboard konnte nicht geladen werden. Bitte extern öffnen."),color=MaterialTheme.colorScheme.error)
        AndroidView(modifier=Modifier.fillMaxWidth().height(640.dp),factory={ctx->WebView(ctx).apply {
            settings.javaScriptEnabled=true
            settings.domStorageEnabled=true
            settings.allowFileAccess=false
            settings.allowContentAccess=false
            settings.mixedContentMode=WebSettings.MIXED_CONTENT_NEVER_ALLOW
            webViewClient=object:WebViewClient(){
                override fun shouldOverrideUrlLoading(webView:WebView,request:WebResourceRequest):Boolean {
                    return request.url.scheme!="https"
                }
                override fun onReceivedError(webView:WebView,request:WebResourceRequest,failure:android.webkit.WebResourceError){if(request.isForMainFrame)error=true}
            }
            view=this
            loadUrl("https://vault.monopol-ai.de/spotify")
        }},onRelease={it.stopLoading();it.destroy();view=null})
        Text(t("Falls Anmeldung oder Einbettung blockiert wird, öffne das Dashboard direkt."),style=MaterialTheme.typography.bodySmall)
    }
}
