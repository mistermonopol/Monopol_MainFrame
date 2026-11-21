package de.monopol.everything

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class Api(private val store: Store, private val onUnauthorized: ((String) -> Unit)? = null) {
    private fun t(source: String) = Localizer.text(source,store.get("language").ifBlank { "en" })
    companion object {
        private val client = OkHttpClient.Builder().callTimeout(75, TimeUnit.SECONDS).followRedirects(false).build()
        // Agent chat returns one response after up to 60 seconds of provider and tool calls.
        private val agentClient = client.newBuilder().readTimeout(70, TimeUnit.SECONDS).build()
    }
    suspend fun call(path: String, method: String = "GET", body: JSONObject? = null): String = withContext(Dispatchers.IO) {
        val server = store.get("server").trimEnd('/')
        require(server.startsWith("https://")) { t("Bitte eine HTTPS-Serveradresse eintragen.") }
        val token = store.get("token")
        val request = Request.Builder().url("$server/api/v1$path")
            .header("Authorization", "Bearer $token")
            .header("Accept-Language",store.get("language").ifBlank { "en" })
            .method(method, if (method == "GET") null else (body?.toString() ?: "").toRequestBody("application/json".toMediaType())).build()
        val transport = if (path == "/agent/chat") agentClient else client
        transport.newCall(request).execute().use { response ->
            val text = response.body?.string() ?: "{}"
            if (response.code == 401) {
                if (path != "/auth/native/login") {
                    onUnauthorized?.let { callback -> withContext(Dispatchers.Main) { callback(token) } }
                    throw IllegalStateException(t("Sitzung abgelaufen. Bitte erneut anmelden."))
                }
                val apiTime = response.header("X-MainFrame-Time")?.toLongOrNull()
                if (apiTime != null && kotlin.math.abs(apiTime - System.currentTimeMillis() / 1000) >= 60) {
                    throw IllegalStateException(t("Die Uhrzeiten von Gerät und Server weichen ab. Aktiviere die automatische Zeitsynchronisierung auf beiden und versuche es erneut."))
                }
            }

            if (!response.isSuccessful) throw IllegalStateException(t(runCatching { JSONObject(text).optString("detail", "${t("Serverfehler")} ${response.code}") }.getOrDefault("${t("Serverfehler")} ${response.code}")))
            text
        }
    }
}
