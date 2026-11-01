package de.monopol.everything

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.KeyboardType
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import androidx.work.WorkManager
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.time.*

class MainActivity : ComponentActivity() {
    private lateinit var store: Store
    private var data by mutableStateOf(JSONObject())
    private var message by mutableStateOf("")
    private var connected by mutableStateOf(false)
    private var busy by mutableStateOf(false)
    private var screen by mutableStateOf("Übersicht")
    private var editor by mutableStateOf<Pair<String, JSONObject?>?>(null)
    private val api get() = Api(store)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = Store(this)
        data = runCatching { JSONObject(store.get("cache")) }.getOrDefault(JSONObject())
        if (intent?.action?.contains("PERMISSION") == true) screen = "Einstellungen"
        setContent {
            MaterialTheme(colorScheme = darkColorScheme(primary = Color(0xFFB8EFD2), background = Color(0xFF101313), surface = Color(0xFF181C1C))) {
                Surface(Modifier.fillMaxSize()) { App() }
            }
        }
        if (store.get("token").isNotEmpty()) refresh(sync = true)
    }

    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); if (intent.action?.contains("PERMISSION") == true) screen = "Einstellungen" }

    private fun login(password: String, onSuccess: () -> Unit) {
        try {
            val base = Uri.parse(store.get("server"))
            require(base.scheme == "https" && !base.host.isNullOrEmpty() && base.userInfo == null && base.query == null && (base.path.isNullOrEmpty() || base.path == "/")) { "Bitte die HTTPS-Basisadresse deines Servers eintragen." }
            require(password.length >= 16) { "Das Passwort benötigt mindestens 16 Zeichen." }
            lifecycleScope.launch {
                busy = true
                try {
                    val result = JSONObject(api.call("/auth/native/login", "POST", JSONObject().put("password", password)))
                    store.put("token", result.getString("access_token"))
                    onSuccess()
                    refresh(sync = true)
                } catch (e: Exception) { connected = false; message = e.message ?: "Anmeldung fehlgeschlagen" }
                finally { busy = false }
            }
        } catch (e: Exception) { message = e.message ?: "Anmeldung fehlgeschlagen" }
    }

    private fun refresh(sync: Boolean = false) {
        lifecycleScope.launch {
            busy = true
            try {
                data = JSONObject(api.call("/dashboard"))
                store.put("cache", data.toString()); store.put("loaded", Instant.now().toString())
                connected = true; message = ""
                if (sync && store.get("syncEnabled") == "true") {
                    try { HealthSync(this@MainActivity).sync(); data = JSONObject(api.call("/dashboard")); store.put("cache", data.toString()) }
                    catch (e: Exception) { message = "Gesundheit: ${e.message}. Übertragung wird später erneut versucht." }
                }
            } catch (e: Exception) { connected = false; message = e.message ?: "Server nicht erreichbar. Letzter Stand wird angezeigt." }
            finally { busy = false }
        }
    }

    private fun mutate(path: String, method: String, body: JSONObject? = null, done: () -> Unit = {}) {
        lifecycleScope.launch {
            busy = true
            try { api.call(path, method, body); done(); refresh() }
            catch (e: Exception) { message = e.message ?: "Speichern fehlgeschlagen"; busy = false }
        }
    }

    @Composable private fun App() {
        val healthAvailable = HealthConnectClient.getSdkStatus(this) == HealthConnectClient.SDK_AVAILABLE
        val permissions = rememberLauncherForActivityResult(PermissionController.createRequestPermissionResultContract()) {
            lifecycleScope.launch {
                if (healthAvailable) {
                    store.put("syncEnabled", "true")
                    HealthSync.schedule(this@MainActivity)
                    refresh(sync = true)
                }
            }
        }
        Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
            Column(Modifier.padding(20.dp)) {
                Text("everything.", style = MaterialTheme.typography.headlineLarge, color = MaterialTheme.colorScheme.primary)
                Text("Dein persönliches Life OS", style = MaterialTheme.typography.labelMedium)
            }
            ScrollableTabRow(selectedTabIndex = listOf("Übersicht", "Aufgaben", "Notizen", "Kalender", "Gesundheit", "Einstellungen").indexOf(screen).coerceAtLeast(0), edgePadding = 8.dp) {
                listOf("Übersicht", "Aufgaben", "Notizen", "Kalender", "Gesundheit", "Einstellungen").forEach { title -> Tab(selected = screen == title, onClick = { screen = title }, text = { Text(title) }) }
            }
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text(if (screen == "Übersicht") "Ein guter Tag beginnt hier." else screen, style = MaterialTheme.typography.headlineSmall)
                Text(LocalDate.now(ZoneId.of("Europe/Berlin")).toString(), style = MaterialTheme.typography.labelMedium)
                if (message.isNotEmpty()) Card { Text(message, Modifier.padding(14.dp)) }
                Text(if (connected) "Server verbunden" else "Offline / noch nicht angemeldet", color = if (connected) MaterialTheme.colorScheme.primary else Color(0xFFE7BE7D))
                if (store.get("loaded").isNotEmpty()) Text("Letzter Stand: ${store.get("loaded")}", style = MaterialTheme.typography.labelSmall)
                OutlinedButton(onClick = { refresh(sync = true) }, enabled = !busy) { Text(if (busy) "Wird geladen …" else "Aktualisieren") }
                if (screen == "Übersicht") {
                    Card { Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Weniger Tabs. Mehr Überblick.", style = MaterialTheme.typography.titleLarge)
                        Text("Deine Aufgaben, Termine und Gesundheit. Ein ruhiger Ort für alles, was dich bewegt.")
                    } }
                    Text("Heute", style = MaterialTheme.typography.titleMedium)
                    val days = data.optJSONObject("health")?.optJSONArray("days") ?: JSONArray()
                    val today = days.objects().find { it.optString("day") == LocalDate.now(ZoneId.of("Europe/Berlin")).toString() }
                    HealthCard(today)
                    Text("Meine Aufgaben", style = MaterialTheme.typography.titleMedium)
                    ItemList("tasks", data.optJSONArray("tasks") ?: JSONArray(), 4)
                    Text("Nächste Termine", style = MaterialTheme.typography.titleMedium)
                    val future = (data.optJSONArray("events") ?: JSONArray()).objects().filter { runCatching { Instant.parse(it.getString("end")) > Instant.now() }.getOrDefault(false) }.sortedBy { it.optString("start") }
                    ItemList("events", JSONArray(future), 3)
                    listOf("Finanzen · Budget & Ausgaben", "Smart Home · Zuhause", "Musik · Releases & Projekte").forEach { Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp)) { Text(it); Text("Nicht verbunden", style = MaterialTheme.typography.labelSmall) } } }
                }
                val kind = when (screen) { "Aufgaben" -> "tasks"; "Notizen" -> "notes"; "Kalender" -> "events"; else -> null }
                if (kind != null) {
                    Button(onClick = { editor = kind to null }, enabled = connected && !busy) { Text("Neuer Eintrag") }
                    ItemList(kind, data.optJSONArray(kind) ?: JSONArray())
                }
                if (screen == "Gesundheit") {
                    Text("Health Connect liest nur freigegebene Daten. Übertragen werden Tageswerte, keine Rohmessreihen.")
                    if (!healthAvailable) Text("Health Connect ist auf diesem Gerät nicht verfügbar.")
                    Button(onClick = { permissions.launch(HealthSync.permissions) }, enabled = healthAvailable) { Text("Leseberechtigungen verwalten") }
                    if (healthAvailable && HealthSync(this@MainActivity).backgroundAvailable()) OutlinedButton(onClick = { permissions.launch(setOf(HealthSync.BACKGROUND)) }) { Text("Hintergrundzugriff erlauben") }
                    Button(onClick = { store.put("syncEnabled", "true"); HealthSync.schedule(this@MainActivity); refresh(sync = true) }, enabled = connected && healthAvailable && !busy) { Text("Synchronisation aktivieren") }
                    OutlinedButton(onClick = { store.put("syncEnabled", "false"); WorkManager.getInstance(this@MainActivity).cancelUniqueWork("health"); message = "Gesundheitssynchronisation gestoppt." }) { Text("Synchronisation stoppen") }
                    Text("Letzte Übertragung: ${data.optJSONObject("health")?.optString("last_sync")?.takeUnless { it == "null" } ?: "Noch keine"}")
                    (data.optJSONObject("health")?.optJSONArray("days") ?: JSONArray()).objects().forEach { day -> Text(day.optString("day")); HealthCard(day) }
                }
                if (screen == "Einstellungen") SettingsContent()
            }
        }
        editor?.let { (kind, item) -> Editor(kind, item) }
    }

    @Composable private fun HealthCard(day: JSONObject?) {
        Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            fun value(key: String) = if (day == null || day.isNull(key)) "—" else day.optString(key)
            Text("Schritte: ${value("steps")}")
            Text("Schlaf: ${value("sleep_minutes")} Minuten")
            Text("Ruhepuls: ${value("resting_pulse")} bpm")
            Text("Gewicht: ${value("weight_kg")} kg")
        } }
    }

    @Composable private fun ItemList(kind: String, items: JSONArray, limit: Int = Int.MAX_VALUE) {
        if (items.length() == 0) Text("Noch keine Einträge.", style = MaterialTheme.typography.bodyMedium)
        items.objects().take(limit).forEach { item ->
            Card(onClick = { editor = kind to item }, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    Text(item.optString("title"), style = MaterialTheme.typography.titleMedium)
                    if (kind == "tasks") Row {
                        Checkbox(checked = item.optBoolean("completed"), enabled = connected && !busy, onCheckedChange = { mutate("/items/tasks/${item.getString("id")}", "PUT", JSONObject(item.toString()).put("completed", it)) })
                        Text(if (item.optBoolean("completed")) "Erledigt" else "Offen", Modifier.padding(top = 13.dp))
                    }
                    if (kind == "events") Text("${item.optString("start")} – ${item.optString("end")}\n${item.optString("location")}")
                    if (item.optString("description").isNotEmpty()) Text(item.optString("description"))
                }
            }
        }
    }

    @Composable private fun SettingsContent() {
        var server by remember { mutableStateOf(store.get("server").ifBlank { "https://monopol-ai.de" }) }
        var password by remember { mutableStateOf("") }
        var confirmDelete by remember { mutableStateOf(false) }
        Text("Serververbindung", style = MaterialTheme.typography.titleMedium)
        Text("Melde dich mit deinem persönlichen Passwort bei https://monopol-ai.de an.")
        OutlinedTextField(server, { server = it }, label = { Text("Serveradresse (HTTPS)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        OutlinedTextField(password, { password = it }, label = { Text("Passwort") }, modifier = Modifier.fillMaxWidth(), singleLine = true, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
        Button(onClick = {
            val normalized = server.trim().trimEnd('/')
            if (normalized != store.get("server")) {
                store.remove("token"); store.remove("cache"); store.remove("loaded")
                store.put("syncEnabled", "false"); WorkManager.getInstance(this@MainActivity).cancelUniqueWork("health")
                data = JSONObject(); connected = false
            }
            store.put("server", normalized); login(password) { password = "" }
        }, enabled = !busy && password.length >= 16) { Text("Anmelden") }
        Text("Datenschutz", style = MaterialTheme.typography.titleMedium)
        Text("Gesundheitsdaten werden nur nach deiner Freigabe gelesen und als Tageswerte auf deinen Server übertragen. Der lokale Cache ist mit Android Keystore verschlüsselt. Android-Berechtigungen kannst du jederzeit in Health Connect widerrufen.")
        OutlinedButton(onClick = { store.remove("cache"); store.remove("loaded"); data = JSONObject(); message = "Lokaler Cache gelöscht." }) { Text("Lokalen Cache löschen") }
        OutlinedButton(onClick = { confirmDelete = true }, enabled = connected && !busy) { Text("Gesundheitsdaten auf Server löschen") }
        OutlinedButton(onClick = { mutate("/auth/logout", "POST") {
            store.remove("token"); store.remove("cache"); store.remove("loaded"); store.put("syncEnabled", "false")
            WorkManager.getInstance(this@MainActivity).cancelUniqueWork("health"); data = JSONObject(); connected = false
        } }, enabled = connected && !busy) { Text("Abmelden") }
        if (confirmDelete) AlertDialog(onDismissRequest = { confirmDelete = false }, title = { Text("Gesundheitsdaten löschen?") }, text = { Text("Alle Tageswerte werden auf dem Server gelöscht. Die Synchronisation auf diesem Pixel wird gestoppt.") }, confirmButton = { TextButton(onClick = {
            store.put("syncEnabled", "false"); WorkManager.getInstance(this@MainActivity).cancelUniqueWork("health")
            mutate("/health/days", "DELETE") { store.remove("cache"); confirmDelete = false }
        }) { Text("Löschen") } }, dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Abbrechen") } })
    }

    @Composable private fun Editor(kind: String, item: JSONObject?) {
        var title by remember { mutableStateOf(item?.optString("title") ?: "") }
        var description by remember { mutableStateOf(item?.optString("description") ?: "") }
        var due by remember { mutableStateOf(item?.optString("due")?.takeUnless { it == "null" } ?: "") }
        fun localTime(key: String) = runCatching { Instant.parse(item?.getString(key)).atZone(ZoneId.of("Europe/Berlin")).toLocalDateTime().toString() }.getOrDefault("")
        var start by remember { mutableStateOf(localTime("start")) }
        var end by remember { mutableStateOf(localTime("end")) }
        var location by remember { mutableStateOf(item?.optString("location") ?: "") }
        var validation by remember { mutableStateOf("") }
        var deleting by remember { mutableStateOf(false) }
        AlertDialog(onDismissRequest = { editor = null }, title = { Text(if (item == null) "Neuer Eintrag" else "Eintrag bearbeiten") }, text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (validation.isNotBlank()) Text(validation, color = MaterialTheme.colorScheme.error)
                OutlinedTextField(title, { title = it }, label = { Text("Titel") })
                OutlinedTextField(description, { description = it }, label = { Text("Beschreibung") }, minLines = 3)
                if (kind == "tasks") OutlinedTextField(due, { due = it }, label = { Text("Fällig: JJJJ-MM-TT (optional)") })
                if (kind == "events") {
                    Text("Termine in Europe/Berlin", style = MaterialTheme.typography.labelSmall)
                    OutlinedTextField(start, { start = it }, label = { Text("Beginn: JJJJ-MM-TTTHH:MM") })
                    OutlinedTextField(end, { end = it }, label = { Text("Ende: JJJJ-MM-TTTHH:MM") })
                    OutlinedTextField(location, { location = it }, label = { Text("Ort") })
                }
                if (item != null) TextButton(onClick = { deleting = true }, enabled = connected && !busy) { Text("Eintrag löschen", color = MaterialTheme.colorScheme.error) }
            }
        }, confirmButton = { TextButton(enabled = connected && !busy, onClick = {
            try {
                require(title.isNotBlank() && title.length <= 200) { "Titel benötigt 1–200 Zeichen." }
                val body = JSONObject().put("title", title).put("description", description).put("version", item?.optInt("version") ?: 1)
                if (kind == "tasks") body.put("due", if (due.isBlank()) JSONObject.NULL else LocalDate.parse(due).toString()).put("completed", item?.optBoolean("completed") ?: false)
                if (kind == "events") {
                    val zone = ZoneId.of("Europe/Berlin")
                    val from = LocalDateTime.parse(start).atZone(zone).toInstant()
                    val to = LocalDateTime.parse(end).atZone(zone).toInstant()
                    require(to > from) { "Ende muss nach Beginn liegen." }
                    body.put("start", from.toString()).put("end", to.toString()).put("location", location)
                }
                mutate("/items/$kind" + if (item == null) "" else "/${item.getString("id")}", if (item == null) "POST" else "PUT", body) { editor = null }
            } catch (e: Exception) { validation = e.message ?: "Bitte Eingaben prüfen." }
        }) { Text("Speichern") } }, dismissButton = { TextButton(onClick = { editor = null }) { Text("Abbrechen") } })
        if (deleting && item != null) AlertDialog(onDismissRequest = { deleting = false }, title = { Text("Eintrag wirklich löschen?") }, confirmButton = { TextButton(onClick = { mutate("/items/$kind/${item.getString("id")}?version=${item.getInt("version")}", "DELETE") { deleting = false; editor = null } }) { Text("Löschen") } }, dismissButton = { TextButton(onClick = { deleting = false }) { Text("Abbrechen") } })
    }
}

fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }
