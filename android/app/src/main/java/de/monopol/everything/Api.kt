package de.monopol.everything

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class Api(private val store: Store) {
    private val client = OkHttpClient.Builder().callTimeout(30, TimeUnit.SECONDS).followRedirects(false).build()
    suspend fun call(path: String, method: String = "GET", body: JSONObject? = null): String = withContext(Dispatchers.IO) {
        val server = store.get("server").trimEnd('/')
        require(server.startsWith("https://")) { "Bitte eine HTTPS-Serveradresse eintragen." }
        val request = Request.Builder().url("$server/api/v1$path")
            .header("Authorization", "Bearer ${store.get("token")}")
            .method(method, if (method == "GET") null else (body?.toString() ?: "").toRequestBody("application/json".toMediaType())).build()
        client.newCall(request).execute().use { response ->
            val text = response.body?.string() ?: "{}"
            if (response.code == 401) throw IllegalStateException("Sitzung abgelaufen. Bitte erneut anmelden.")
            if (response.code == 409) throw IllegalStateException("Eintrag wurde geändert. Bitte neu laden.")
            if (!response.isSuccessful) throw IllegalStateException(runCatching { JSONObject(text).optString("detail", "Serverfehler ${response.code}") }.getOrDefault("Serverfehler ${response.code}"))
            text
        }
    }
}
