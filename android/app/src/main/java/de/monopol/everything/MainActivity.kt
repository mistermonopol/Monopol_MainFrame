package de.monopol.everything

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

class MainActivity : ComponentActivity() {
    private lateinit var store: Store
    private var data by mutableStateOf(JSONObject())
    private var message by mutableStateOf("")
    private var connected by mutableStateOf(false)
    private var busy by mutableStateOf(false)
    private var screen by mutableStateOf("Übersicht")
    private var editor by mutableStateOf<Pair<String, JSONObject?>?>(null)
    private val api get() = Api(store)
    private var language by mutableStateOf("en")
    private var theme by mutableStateOf("dark")
    private var layout by mutableStateOf("index")
    private fun t(source: String) = Localizer.text(source,language)
    private fun dateText(value: String) = runCatching { Instant.parse(value).atZone(ZoneId.of("Europe/Berlin")).format(DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM).withLocale(if(language=="de") Locale.GERMANY else Locale.UK)) }.getOrDefault(value)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = Store(this)
        language = store.get("language").takeIf { it=="de" } ?: "en"
        layout = store.get("layout").takeIf { it in listOf("index","studio","control","focus") } ?: "index"
        theme = store.get("theme").takeIf { it in listOf("light","amber","cyan") } ?: "dark"
        data = runCatching { JSONObject(store.get("cache")) }.getOrDefault(JSONObject())
        if(intent?.getBooleanExtra("open_tasks",false)==true)screen="Aufgaben"
        if(store.get("taskNotifications")=="true")TaskNotifications.schedule(this)
        if (intent?.action?.contains("PERMISSION") == true) screen = "Einstellungen"
        setContent {
            MaterialTheme(colorScheme = if(theme=="light") lightColorScheme(
                primary=Color(0xFF6940A6),onPrimary=Color.White,primaryContainer=Color(0xFFE8DCF8),onPrimaryContainer=Color(0xFF35214F),
                secondary=Color(0xFF71538D),background=Color(0xFFF7F6FB),onBackground=Color(0xFF241E32),surface=Color.White,
                onSurface=Color(0xFF241E32),surfaceVariant=Color(0xFFEEEBF5),onSurfaceVariant=Color(0xFF665A78),outline=Color(0xFFB5A6C8)
            ) else if(theme=="amber" || theme=="cyan") darkColorScheme(
                primary=if(theme=="amber") Color(0xFFFFC14A) else Color(0xFF52E5EE),
                onPrimary=Color(0xFF101510),primaryContainer=if(theme=="amber") Color(0xFF423114) else Color(0xFF103944),
                background=if(theme=="amber") Color(0xFF100E09) else Color(0xFF06151D),
                surface=if(theme=="amber") Color(0xFF1D190F) else Color(0xFF0B232E),
                surfaceVariant=if(theme=="amber") Color(0xFF302919) else Color(0xFF153C49),
                onSurface=if(theme=="amber") Color(0xFFFFDDA0) else Color(0xFFDBF8FF),
                onBackground=if(theme=="amber") Color(0xFFFFDDA0) else Color(0xFFDBF8FF),
                onSurfaceVariant=if(theme=="amber") Color(0xFFC3AB7D) else Color(0xFF8DB8C8),
                outline=if(theme=="amber") Color(0xFF806A37) else Color(0xFF3B7587)
            ) else darkColorScheme(
                primary = Color(0xFFB69AF7), onPrimary = Color(0xFF21152F),
                primaryContainer = Color(0xFF35294A), onPrimaryContainer = Color(0xFFE2CCFF),
                secondary = Color(0xFFC4A9E6), background = Color(0xFF11101D),
                onBackground = Color(0xFFEEE9FB), surface = Color(0xFF1B192D),
                onSurface = Color(0xFFEEE9FB), surfaceVariant = Color(0xFF2A243A),
                onSurfaceVariant = Color(0xFFBEB0D2), outline = Color(0xFF50425F)
            ), shapes=Shapes(extraSmall=RoundedCornerShape(0.dp),small=RoundedCornerShape(0.dp),medium=RoundedCornerShape(0.dp),large=RoundedCornerShape(0.dp),extraLarge=RoundedCornerShape(0.dp)), typography = programmerTypography) {
                Surface(Modifier.fillMaxSize()) { App() }
            }
        }
        if (store.get("token").isNotEmpty()) refresh(sync = true)
    }

    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); if(intent.getBooleanExtra("open_tasks",false)){screen="Aufgaben";refresh()}; if (intent.action?.contains("PERMISSION") == true) screen = "Einstellungen" }

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
                if(store.get("taskNotifications")=="true")TaskNotifications.schedule(this@MainActivity)
                if (sync && store.get("syncEnabled") == "true") {
                    try { HealthSync(this@MainActivity).sync(); data = JSONObject(api.call("/dashboard")); store.put("cache", data.toString()) }
                    catch (e: Exception) { message = "${t("Gesundheit:")} ${t(e.message ?: "Die Anfrage konnte nicht gespeichert werden.")} ${t("Übertragung wird später erneut versucht.")}" }
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
        val drawerState = rememberDrawerState(DrawerValue.Closed)
        val scope = rememberCoroutineScope()
        var expanded by remember { mutableStateOf(store.get("sidebarCollapsed") != "true") }
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val workspaceWidth=maxWidth
            if (maxWidth >= 840.dp) {
                Row(Modifier.fillMaxSize()) {
                    Surface(Modifier.width(if (!expanded) 76.dp else when(layout){"studio"->112.dp;"control"->210.dp;"focus"->224.dp;else->244.dp}).fillMaxHeight(), color = MaterialTheme.colorScheme.surfaceVariant) {
                        NavigationContent(expanded && layout!="studio", if (expanded) "Navigation einklappen" else "Navigation ausklappen", {
                            expanded = !expanded
                            store.put("sidebarCollapsed", (!expanded).toString())
                        }) { screen = it }
                    }
                    Box(Modifier.weight(1f).fillMaxHeight()) {
                        WorkspaceContent {
                            expanded = !expanded
                            store.put("sidebarCollapsed", (!expanded).toString())
                        }
                    }
                    if(layout=="control" && workspaceWidth>=1350.dp) Surface(Modifier.width(220.dp).fillMaxHeight(),color=MaterialTheme.colorScheme.surfaceVariant) {
                        Column(Modifier.padding(20.dp),verticalArrangement=Arrangement.spacedBy(24.dp)) {
                            Text("INSPECTOR / LIVE",style=MaterialTheme.typography.labelSmall)
                            Text(t("Im Blick"),style=MaterialTheme.typography.headlineSmall)
                            listOf("Offene Aufgaben" to (data.optJSONArray("tasks")?:JSONArray()).objects().count{!it.optBoolean("completed")},"Musikprojekte" to (data.optJSONArray("music")?.length()?:0),"Erfasste Tage" to (data.optJSONObject("health")?.optJSONArray("days")?.length()?:0)).forEach{(label,value)->Text(t(label));Text(value.toString(),style=MaterialTheme.typography.displaySmall,color=MaterialTheme.colorScheme.primary)}
                            Text(t("Aktueller App-Bestand. Keine Beispieldaten."),style=MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            } else {
                ModalNavigationDrawer(drawerState = drawerState, drawerContent = {
                    ModalDrawerSheet(Modifier.width(300.dp), drawerContainerColor = MaterialTheme.colorScheme.surfaceVariant, drawerShape = RectangleShape) {
                        NavigationContent(true, "Navigation schließen", { scope.launch { drawerState.close() } }) {
                            screen = it
                            scope.launch { drawerState.close() }
                        }
                    }
                }) {
                    Column(Modifier.fillMaxSize()) {
                        Box(Modifier.weight(1f)){WorkspaceContent { scope.launch { drawerState.open() } }}
                        if(layout=="studio" || layout=="focus") Row(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surfaceVariant).navigationBarsPadding(),horizontalArrangement=Arrangement.SpaceEvenly) {
                            listOf("Übersicht" to Icons.Outlined.Dashboard,"Aufgaben" to Icons.Outlined.CheckBox,"Musik" to Icons.Outlined.MusicNote,"KI-Agent" to Icons.Outlined.SmartToy).forEach{(label,icon)->
                                Column(Modifier.weight(1f).clickable{screen=label}.padding(vertical=12.dp),horizontalAlignment=Alignment.CenterHorizontally){Icon(icon,t(label),tint=if(screen==label)MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant);Text(t(label),fontSize=8.sp)}
                            }
                            SquareIconButton(onClick={scope.launch{drawerState.open()}}){Icon(Icons.Outlined.MoreHoriz,t("Weitere Module"))}
                        }
                    }
                }
            }
        }
    }

    @Composable private fun NavigationContent(expanded: Boolean, toggleLabel: String, onToggle: () -> Unit, onSelect: (String) -> Unit) {
        val items = listOf(
            "Übersicht" to Icons.Outlined.Dashboard,
            "Aufgaben" to Icons.Outlined.CheckBox,
            "Musik" to Icons.Outlined.MusicNote,
            "KI-Agent" to Icons.Outlined.SmartToy,
            "Obsidian" to Icons.Outlined.Description,
            "Gesundheit" to Icons.Outlined.MonitorHeart,
            "Einstellungen" to Icons.Outlined.Settings
        )
        Column(Modifier.fillMaxHeight().padding(12.dp).statusBarsPadding(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (expanded) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Code, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(end = 8.dp))
                    Text("Monopol_MainFrame", Modifier.weight(1f), fontSize = 13.sp, color = MaterialTheme.colorScheme.primary)
                    SquareIconButton(onClick = onToggle) { Icon(Icons.Outlined.ChevronLeft, t(toggleLabel)) }
                }
                Text(t("PERSÖNLICHER WORKSPACE"), Modifier.padding(12.dp, 16.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                SquareIconButton(onClick = onToggle) { Icon(Icons.Outlined.ChevronRight, t(toggleLabel)) }
                Spacer(Modifier.height(20.dp))
            }
            items.forEachIndexed { index, (label, icon) ->
                if (expanded) NavigationDrawerItem(
                    label = { Text(t(label)) }, selected = screen == label, onClick = { onSelect(label) },
                    icon = { if(layout=="index") Text(String.format("%02d",index+1),style=MaterialTheme.typography.labelSmall) else Icon(icon, null) }, shape = RoundedCornerShape(0.dp),
                    colors = NavigationDrawerItemDefaults.colors(
                        selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                        selectedTextColor = MaterialTheme.colorScheme.primary,
                        selectedIconColor = MaterialTheme.colorScheme.primary,
                        unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                ) else SquareIconButton(onClick = { onSelect(label) }, modifier = Modifier.size(48.dp).background(
                    if (screen == label) MaterialTheme.colorScheme.primaryContainer else Color.Transparent, RoundedCornerShape(0.dp)
                )) { Icon(icon, t(label), tint = if (screen == label) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant) }
            }
            Spacer(Modifier.weight(1f))
            if (expanded) Text("Monopol_MainFrame your App for Everything", Modifier.padding(12.dp), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }

    @Composable private fun WorkspaceContent(onOpenNavigation: () -> Unit) {
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
        Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding(),horizontalAlignment=if(layout=="focus") Alignment.CenterHorizontally else Alignment.Start) {
            Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                SquareIconButton(onClick = onOpenNavigation) { Icon(Icons.Outlined.Menu, t("Navigation öffnen")) }
                Column(Modifier.weight(1f).padding(start = 8.dp)) {
                    Text("Monopol_MainFrame", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                    Text(t(screen), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            if(layout=="control") Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal=12.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                listOf("Aufgaben","Musik","Gesundheit","KI-Agent","Obsidian").forEach{label->OutlinedButton(onClick={screen=label},shape=RectangleShape){Text(t(label),fontSize=10.sp)}}
            }
            Column(Modifier.weight(1f).then(if(layout=="focus")Modifier.widthIn(max=720.dp) else Modifier.fillMaxWidth()).verticalScroll(rememberScrollState()).padding(if(layout=="control")12.dp else 20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text(t(if (screen == "Übersicht") "Willkommen im MainFrame." else screen), style = MaterialTheme.typography.headlineSmall)
                Text(LocalDate.now(ZoneId.of("Europe/Berlin")).format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM).withLocale(if(language=="de") Locale.GERMANY else Locale.UK)), style = MaterialTheme.typography.labelMedium)
                if (message.isNotEmpty()) Card(shape = RectangleShape) { Text(t(message), Modifier.padding(14.dp)) }
                Text(t(if (connected) "Server verbunden" else "Offline / Anmeldung nötig"), color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (store.get("loaded").isNotEmpty()) Text("${t("Letzter geladener Stand:")} ${dateText(store.get("loaded"))}", style = MaterialTheme.typography.labelSmall)
                OutlinedButton(onClick = { refresh(sync = true) }, enabled = !busy, shape = RectangleShape) { Text(t(if (busy) "Wird geladen …" else "Aktualisieren")) }
                if (screen == "Übersicht") OverviewContent()
                if(screen=="Musik") SpotifyDashboard(language)
                val kind = when (screen) { "Aufgaben" -> "tasks"; "Musik" -> "music"; else -> null }
                if (kind != null) {
                    Button(onClick = { editor = kind to null }, enabled = connected && !busy, shape = RectangleShape) { Text(t("Neuer Eintrag")) }
                    if(kind=="tasks") TaskRegister() else ItemList(kind, data.optJSONArray(kind) ?: JSONArray())
                }
                if (screen == "Gesundheit") {
                    Text(t("Health Connect liest nur freigegebene Daten. Übertragen werden Tageswerte, keine Rohmessreihen."))
                    if (!healthAvailable) Text(t("Health Connect ist auf diesem Gerät nicht verfügbar."))
                    Button(onClick = { permissions.launch(HealthSync.permissions) }, enabled = healthAvailable, shape = RectangleShape) { Text(t("Leseberechtigungen verwalten")) }
                    if (healthAvailable && HealthSync(this@MainActivity).backgroundAvailable()) OutlinedButton(onClick = { permissions.launch(setOf(HealthSync.BACKGROUND)) }, shape = RectangleShape) { Text(t("Hintergrundzugriff erlauben")) }
                    Button(onClick = { store.put("syncEnabled", "true"); HealthSync.schedule(this@MainActivity); refresh(sync = true) }, enabled = connected && healthAvailable && !busy, shape = RectangleShape) { Text(t("Synchronisation aktivieren")) }
                    OutlinedButton(onClick = { store.put("syncEnabled", "false"); WorkManager.getInstance(this@MainActivity).cancelUniqueWork("health"); message = "Gesundheitssynchronisation gestoppt." }, shape = RectangleShape) { Text(t("Synchronisation stoppen")) }
                    Text("${t("Letzte Übertragung:")} ${data.optJSONObject("health")?.optString("last_sync")?.takeUnless { it == "null" }?.let {dateText(it)} ?: t("Noch keine")}")
                    (data.optJSONObject("health")?.optJSONArray("days") ?: JSONArray()).objects().forEach { day -> Text(day.optString("day")); HealthCard(day) }
                }
                if(screen=="KI-Agent" || screen=="Obsidian") ConnectedModule(screen,api,connected,language){refresh()}
                if (screen == "Einstellungen") SettingsContent()
            }
        }
        editor?.let { (kind, item) -> Editor(kind, item) }
    }

    @Composable private fun TaskRegister() {
        val tasks=data.optJSONArray("tasks")?:JSONArray()
        val open=JSONArray(tasks.objects().filter{!it.optBoolean("completed")})
        val done=JSONArray(tasks.objects().filter{it.optBoolean("completed")})
        if(layout=="studio") BoxWithConstraints {
            if(maxWidth>=600.dp) Row(horizontalArrangement=Arrangement.spacedBy(20.dp)) {
                Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(12.dp)){Text("${t("Offen")} / ${open.length()}",color=MaterialTheme.colorScheme.primary);ItemList("tasks",open)}
                Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(12.dp)){Text("${t("Erledigt")} / ${done.length()}");ItemList("tasks",done)}
            } else Column(verticalArrangement=Arrangement.spacedBy(18.dp)){Text("${t("Offen")} / ${open.length()}",color=MaterialTheme.colorScheme.primary);ItemList("tasks",open);HorizontalDivider();Text("${t("Erledigt")} / ${done.length()}");ItemList("tasks",done)}
        } else if(layout=="focus") Column(Modifier.border(1.dp,MaterialTheme.colorScheme.outline,RectangleShape).padding(18.dp),verticalArrangement=Arrangement.spacedBy(18.dp)) {Text(t("Dein nächster Schritt"),style=MaterialTheme.typography.labelSmall);ItemList("tasks",open);Text(t("Erledigt"));ItemList("tasks",done)}
        else Column(verticalArrangement=Arrangement.spacedBy(10.dp)){Text((if(layout=="control")"REGISTER / TASKS" else "01 / ${t("Meine Aufgaben")}")+" — ${open.length()} / ${tasks.length()}",style=MaterialTheme.typography.labelSmall);ItemList("tasks",tasks)}
    }

    @Composable private fun OverviewContent() {
        val tasks=data.optJSONArray("tasks")?:JSONArray()
        val projects=data.optJSONArray("music")?:JSONArray()
        val days=data.optJSONObject("health")?.optJSONArray("days")?:JSONArray()
        val open=tasks.objects().count{!it.optBoolean("completed")}
        val today=days.objects().find{it.optString("day")==LocalDate.now(ZoneId.of("Europe/Berlin")).toString()}
        val primary=MaterialTheme.colorScheme.primary
        when(layout) {
            "studio"->{
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.Bottom){Column(Modifier.weight(1f)){Text("Monopol_MainFrame your App for Everything",fontSize=9.sp);Text(t("In Arbeit"),fontSize=34.sp,color=primary)};Text("MF\nSTUDIO",Modifier.background(primary).padding(12.dp),color=MaterialTheme.colorScheme.background,fontSize=18.sp)}
                BoxWithConstraints {
                    if(maxWidth>=700.dp) Row(horizontalArrangement=Arrangement.spacedBy(20.dp)) {
                        Column(Modifier.weight(1.2f)){OverviewMusic(projects,true)}
                        Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(16.dp)){OverviewAgent();OverviewTasks(tasks)}
                    } else Column(verticalArrangement=Arrangement.spacedBy(18.dp)){OverviewMusic(projects,true);OverviewAgent();OverviewTasks(tasks)}
                }
                StepsChart(days,language);HealthCard(today)
            }
            "control"->{
                Text("CONTROL / 03 — Monopol_MainFrame your App for Everything",fontSize=9.sp,color=primary)
                Row(Modifier.fillMaxWidth().border(1.dp,MaterialTheme.colorScheme.outline,RectangleShape)) {
                    listOf("Offen" to open,"Erledigt" to tasks.length()-open,"Musikprojekte" to projects.length()).forEach{(label,value)->Column(Modifier.weight(1f).padding(12.dp)){Text(t(label),fontSize=9.sp);Text(value.toString(),fontSize=36.sp,color=primary)}}
                }
                HealthCard(today)
                BoxWithConstraints {
                    if(maxWidth>=700.dp)Row(horizontalArrangement=Arrangement.spacedBy(12.dp)){Column(Modifier.weight(1.3f)){StepsChart(days,language);OverviewMusic(projects,false)};Column(Modifier.weight(1f)){OverviewTasks(tasks);OverviewAgent()}}
                    else Column(verticalArrangement=Arrangement.spacedBy(12.dp)){StepsChart(days,language);OverviewTasks(tasks);OverviewMusic(projects,false);OverviewAgent()}
                }
            }
            "focus"->{
                Text("Monopol_MainFrame your App for Everything",fontSize=9.sp)
                Text(LocalDate.now(ZoneId.of("Europe/Berlin")).dayOfMonth.toString().padStart(2,'0'),fontSize=64.sp,color=primary)
                Text(t("Eins nach")+"\n"+t("dem anderen."),fontSize=46.sp,lineHeight=48.sp)
                Text(t("Du musst nicht alles auf einmal tun."),style=MaterialTheme.typography.bodySmall)
                Text("${tasks.length()-open} / ${tasks.length()} ${t("Aufgaben erledigt")}",fontSize=10.sp,color=primary)
                Column(Modifier.border(1.dp,MaterialTheme.colorScheme.outline,RectangleShape).padding(18.dp),verticalArrangement=Arrangement.spacedBy(24.dp)){OverviewTasks(tasks);OverviewAgent();OverviewMusic(projects,false);StepsChart(days,language);HealthCard(today)}
            }
            else->{
                Text("Monopol_MainFrame your App for Everything",fontSize=9.sp)
                BoxWithConstraints(Modifier.fillMaxWidth()) {
                    val headlineSize=if(maxWidth<380.dp)30.sp else 48.sp
                    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(12.dp),verticalAlignment=Alignment.Bottom){Text(t("Alles,")+"\n"+t("was zählt."),Modifier.weight(1f),fontSize=headlineSize,lineHeight=headlineSize);Column(Modifier.width(80.dp),horizontalAlignment=Alignment.End){Text(open.toString().padStart(2,'0'),fontSize=64.sp,color=primary);Text(t("offene Aufgaben"),fontSize=9.sp)}}
                }
                HorizontalDivider(color=primary)
                Text(t("Dein Tag, auf einer Seite."),style=MaterialTheme.typography.labelSmall)
                BoxWithConstraints {
                    if(maxWidth>=700.dp) Row(horizontalArrangement=Arrangement.spacedBy(26.dp)){Column(Modifier.weight(1.5f),verticalArrangement=Arrangement.spacedBy(16.dp)){OverviewTasks(tasks);StepsChart(days,language)};Column(Modifier.weight(1f)){OverviewMusic(projects,true);OverviewAgent()}}
                    else Column(verticalArrangement=Arrangement.spacedBy(18.dp)){OverviewTasks(tasks);StepsChart(days,language);OverviewMusic(projects,false);OverviewAgent()}
                }
                HealthCard(today)
            }
        }
    }

    @Composable private fun OverviewTasks(tasks:JSONArray) {
        Column(Modifier.fillMaxWidth(),verticalArrangement=Arrangement.spacedBy(10.dp)) {
            Text("01 / ${t("Meine Aufgaben")}",style=MaterialTheme.typography.titleMedium)
            ItemList("tasks",tasks,if(layout=="control")6 else 4)
            OutlinedButton(onClick={screen="Aufgaben"},shape=RectangleShape){Text(t("Zum Tagesplan"))}
        }
    }

    @Composable private fun OverviewMusic(projects:JSONArray,large:Boolean) {
        val active=projects.objects().firstOrNull{!it.optBoolean("completed")}
        Surface(Modifier.fillMaxWidth(),shape=RectangleShape,color=if(layout=="studio")MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant) {
            Column(Modifier.padding(if(large)24.dp else 18.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
                Text("02 / ${t("Musikprojekte")}",style=MaterialTheme.typography.labelSmall)
                if(large)Text((active?.optString("title")?:"Main Frame").split(" ").filter{it.isNotBlank()}.take(2).joinToString(""){it.take(1)}.uppercase(),fontSize=86.sp,color=MaterialTheme.colorScheme.primary)
                Text(active?.optString("title")?:t("Noch ungeschrieben."),fontSize=if(large)30.sp else 23.sp)
                Text(active?.optString("description")?.take(180)?.ifBlank{null}?:t("Ein Track beginnt mit einer Idee. Gib ihr einen Platz."),fontSize=12.sp)
                OutlinedButton(onClick={screen="Musik"},shape=RectangleShape){Text(t("Musik öffnen"))}
            }
        }
    }

    @Composable private fun OverviewAgent() {
        Surface(onClick={screen="KI-Agent"},shape=RectangleShape,color=if(layout=="studio")MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface) {
            Row(Modifier.fillMaxWidth().padding(20.dp),horizontalArrangement=Arrangement.spacedBy(16.dp),verticalAlignment=Alignment.CenterVertically){Text("*",fontSize=56.sp);Column{Text("MAINFRAME AGENT",fontSize=9.sp);Text(t("Denk es laut."),fontSize=23.sp);Text(t("Fragen, Ideen und dein ganzer Workspace."),fontSize=10.sp)}}
        }
    }

    @Composable private fun HealthCard(day: JSONObject?) {
        Card(Modifier.fillMaxWidth(), shape = RectangleShape) { Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            fun value(key: String) = if (day == null || day.isNull(key)) "—" else java.text.NumberFormat.getNumberInstance(if(language=="de") Locale.GERMANY else Locale.UK).apply { maximumFractionDigits=1 }.format(day.optDouble(key))
            Text("${t("Schritte")}: ${value("steps")}")
            Text("${t("Schlaf")}: ${value("sleep_minutes")} ${t("Minuten")}")
            Text("${t("Ruhepuls")}: ${value("resting_pulse")} bpm")
            Text("${t("Gewicht (kg)")}: ${value("weight_kg")}")
        } }
    }

    @Composable private fun ItemList(kind: String, items: JSONArray, limit: Int = Int.MAX_VALUE) {
        if (items.length() == 0) Text(t("Noch keine Einträge."), style = MaterialTheme.typography.bodyMedium)
        items.objects().take(limit).forEach { item ->
            Card(onClick = { editor = kind to item }, modifier = Modifier.fillMaxWidth(), shape = RectangleShape) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    Text(item.optString("title"), style = MaterialTheme.typography.titleMedium)
                    if (kind == "tasks") Row {
                        SquareCheckbox(checked = item.optBoolean("completed"), enabled = connected && !busy, onCheckedChange = { mutate("/items/tasks/${item.getString("id")}", "PUT", JSONObject(item.toString()).put("completed", it)) })
                        Text(t(if (item.optBoolean("completed")) "Erledigt" else "Offen"), Modifier.padding(top = 13.dp))
                    }
                    if(kind=="music") {Text(t(if(item.optBoolean("completed"))"Veröffentlicht" else "In Arbeit"),color=MaterialTheme.colorScheme.primary);if(!item.isNull("due"))Text(item.optString("due"));if(item.optString("location").isNotBlank())Text(item.optString("location"))}
                    if (kind == "events") Text("${dateText(item.optString("start"))} – ${dateText(item.optString("end"))}\n${item.optString("location")}")
                    if (item.optString("description").isNotEmpty()) Text(item.optString("description"))
                }
            }
        }
    }

    @Composable private fun SettingsContent() {
        var notifications by remember{mutableStateOf(store.get("taskNotifications")=="true")}
        val notificationPermission=rememberLauncherForActivityResult(androidx.activity.result.contract.ActivityResultContracts.RequestPermission()){granted->notifications=granted;store.put("taskNotifications",granted.toString());if(granted)TaskNotifications.schedule(this) else TaskNotifications.stop(this)}
        Text(t("Aufgaben-Erinnerungen"),style=MaterialTheme.typography.titleMedium)
        Text(t("Standard: 09:00 Uhr Europe/Berlin. Android prüft im Hintergrund ungefähr alle 15 Minuten; Energiesparen kann die Zustellung verzögern."),style=MaterialTheme.typography.bodySmall)
        OutlinedButton(onClick={if(notifications){notifications=false;store.put("taskNotifications","false");TaskNotifications.stop(this)}else notificationPermission.launch(android.Manifest.permission.POST_NOTIFICATIONS)},shape=RectangleShape){Text(t(if(notifications)"Benachrichtigungen deaktivieren" else "Benachrichtigungen aktivieren"))}
        Text(t("Darstellung"),style=MaterialTheme.typography.titleMedium)
        Text(t("Layout"),style=MaterialTheme.typography.titleMedium)
        Text(t("Vier Arbeitsweisen. Jede mit jeder Farbe kombinierbar."),style=MaterialTheme.typography.bodySmall)
        listOf("index" to "Index","studio" to "Studio","control" to "Control","focus" to "Focus").forEachIndexed{index,(value,label)->
            OutlinedButton(onClick={layout=value;store.put("layout",value)},modifier=Modifier.fillMaxWidth(),shape=RectangleShape,colors=ButtonDefaults.outlinedButtonColors(containerColor=if(layout==value)MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface)) {
                Text("0${index+1}",Modifier.padding(end=18.dp),color=MaterialTheme.colorScheme.primary)
                Column(Modifier.weight(1f)) {Text(label);Text(t(when(value){"index"->"Große Typografie, Kapitel und ein geteilter Überblick.";"studio"->"Asymmetrische Arbeitsfläche für Projekte und Ideen.";"control"->"Kompakte Instrumente, Datenraster und Live-Inspektor.";else->"Ein Tagesablauf, eine Spalte, dein nächster Schritt."}),fontSize=10.sp)}
                if(layout==value)Icon(Icons.Outlined.Check,null)
            }
        }
        Text(t("Farbwelt"),style=MaterialTheme.typography.titleMedium)
        Text(t("Die Farbe verändert nicht das Layout."),style=MaterialTheme.typography.bodySmall)
        Text(t("Sprache"))
        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) { listOf("en" to "English","de" to "Deutsch").forEach { (value,label) -> OutlinedButton(onClick={language=value;store.put("language",value);message=""}, colors=ButtonDefaults.outlinedButtonColors(containerColor=if(language==value) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface), shape = RectangleShape) {Text(label)} } }
        Text(t("Design"))
        Column(verticalArrangement=Arrangement.spacedBy(8.dp)) { listOf("dark" to "Violet","light" to "Paper","amber" to "Amber","cyan" to "Cyan").forEach { (value,label) -> OutlinedButton(onClick={theme=value;store.put("theme",value)}, colors=ButtonDefaults.outlinedButtonColors(containerColor=if(theme==value) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface), shape = RectangleShape) {Text(t(label))} } }
        Text(t("Einstellungen werden auf diesem Gerät gespeichert."),style=MaterialTheme.typography.bodySmall)
        var server by remember { mutableStateOf(store.get("server").ifBlank { "https://monopol-ai.de" }) }
        var password by remember { mutableStateOf("") }
        var confirmDelete by remember { mutableStateOf(false) }
        Text(t("Serververbindung"), style = MaterialTheme.typography.titleMedium)
        Text(t("Melde dich mit deinem persönlichen Passwort bei https://monopol-ai.de an."))
        OutlinedTextField(server, { server = it }, label = { Text(t("Serveradresse (HTTPS)")) }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RectangleShape)
        OutlinedTextField(password, { password = it }, label = { Text(t("Passwort")) }, modifier = Modifier.fillMaxWidth(), singleLine = true, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), shape = RectangleShape)
        Button(onClick = {
            val normalized = server.trim().trimEnd('/')
            if (normalized != store.get("server")) {
                store.remove("token"); store.remove("cache"); store.remove("loaded")
                store.put("syncEnabled", "false"); WorkManager.getInstance(this@MainActivity).cancelUniqueWork("health")
                data = JSONObject(); connected = false
            }
            store.put("server", normalized); login(password) { password = "" }
        }, enabled = !busy && password.length >= 16, shape = RectangleShape) { Text(t("Anmelden")) }
        Text(t("Datenschutz"), style = MaterialTheme.typography.titleMedium)
        Text(t("Gesundheitsdaten werden nur nach deiner Freigabe gelesen und als Tageswerte auf deinen Server übertragen. Der lokale Cache ist mit Android Keystore verschlüsselt. Android-Berechtigungen kannst du jederzeit in Health Connect widerrufen."))
        OutlinedButton(onClick = { store.remove("cache"); store.remove("loaded"); data = JSONObject(); message = "Lokaler Cache gelöscht." }, shape = RectangleShape) { Text(t("Lokalen Cache löschen")) }
        OutlinedButton(onClick = { confirmDelete = true }, enabled = connected && !busy, shape = RectangleShape) { Text(t("Gesundheitsdaten auf Server löschen")) }
        OutlinedButton(onClick = { mutate("/auth/logout", "POST") {
            store.remove("token"); store.remove("cache"); store.remove("loaded"); store.put("syncEnabled", "false")
            WorkManager.getInstance(this@MainActivity).cancelUniqueWork("health"); data = JSONObject(); connected = false
        } }, enabled = connected && !busy, shape = RectangleShape) { Text(t("Abmelden")) }
        if (confirmDelete) AlertDialog(onDismissRequest = { confirmDelete = false }, title = { Text(t("Gesundheitsdaten löschen?")) }, text = { Text(t("Alle Tageswerte werden auf dem Server gelöscht. Die Synchronisation auf diesem Pixel wird gestoppt.")) }, confirmButton = { TextButton(onClick = {
            store.put("syncEnabled", "false"); WorkManager.getInstance(this@MainActivity).cancelUniqueWork("health")
            mutate("/health/days", "DELETE") { store.remove("cache"); confirmDelete = false }
        }, shape = RectangleShape) { Text(t("Löschen")) } }, dismissButton = { TextButton(onClick = { confirmDelete = false }, shape = RectangleShape) { Text(t("Abbrechen")) } }, shape = RectangleShape)
    }

    @Composable private fun Editor(kind: String, item: JSONObject?) {
        var title by remember { mutableStateOf(item?.optString("title") ?: "") }
        var description by remember { mutableStateOf(item?.optString("description") ?: "") }
        var due by remember { mutableStateOf(item?.optString("due")?.takeUnless { it == "null" } ?: "") }
        fun localTime(key: String) = runCatching { Instant.parse(item?.getString(key)).atZone(ZoneId.of("Europe/Berlin")).toLocalDateTime().toString() }.getOrDefault("")
        var start by remember { mutableStateOf(localTime("start")) }
        var end by remember { mutableStateOf(localTime("end")) }
        var location by remember { mutableStateOf(item?.optString("location") ?: "") }
        var released by remember { mutableStateOf(item?.optBoolean("completed") ?: false) }
        var reminder by remember {mutableStateOf(localTime("remind_at"))}
        var remindersEnabled by remember {mutableStateOf(item?.optBoolean("reminders_enabled",true)?:true)}
        var validation by remember { mutableStateOf("") }
        var deleting by remember { mutableStateOf(false) }
        AlertDialog(onDismissRequest = { editor = null }, title = { Text(t(if (item == null) "Neuer Eintrag" else "Eintrag bearbeiten")) }, text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (validation.isNotBlank()) Text(t(validation), color = MaterialTheme.colorScheme.error)
                OutlinedTextField(title, { title = it }, label = { Text(t("Titel")) }, shape = RectangleShape)
                OutlinedTextField(description, { description = it }, label = { Text(t("Beschreibung")) }, minLines = 3, shape = RectangleShape)
                if (kind == "tasks" || kind == "music") OutlinedTextField(due, { due = it }, label = { Text(t("Fällig: JJJJ-MM-TT (optional)")) }, shape = RectangleShape)
                if(kind=="tasks") {
                    Row {SquareCheckbox(remindersEnabled,true){remindersEnabled=it};Text(t("Erinnerung aktiv"),Modifier.padding(top=13.dp))}
                    OutlinedTextField(reminder,{reminder=it},label={Text(t("Erinnerung: JJJJ-MM-TTTHH:MM (Europe/Berlin)"))},shape=RectangleShape)
                }
                if(kind=="music") {
                    OutlinedTextField(location,{location=it},label={Text(t("Projekt-Link oder Dateipfad"))},shape=RectangleShape)
                    Row { SquareCheckbox(released,true){released=it};Text(t("Veröffentlicht"),Modifier.padding(top=13.dp)) }
                }
                if (kind == "events") {
                    Text(t("Termine in Europe/Berlin"), style = MaterialTheme.typography.labelSmall)
                    OutlinedTextField(start, { start = it }, label = { Text(t("Beginn: JJJJ-MM-TTTHH:MM")) }, shape = RectangleShape)
                    OutlinedTextField(end, { end = it }, label = { Text(t("Ende: JJJJ-MM-TTTHH:MM")) }, shape = RectangleShape)
                    OutlinedTextField(location, { location = it }, label = { Text(t("Ort")) }, shape = RectangleShape)
                }
                if (item != null) TextButton(onClick = { deleting = true }, enabled = connected && !busy, shape = RectangleShape) { Text(t("Eintrag löschen"), color = MaterialTheme.colorScheme.error) }
            }
        }, confirmButton = { TextButton(enabled = connected && !busy, onClick = {
            try {
                require(title.isNotBlank() && title.length <= 200) { "Titel benötigt 1–200 Zeichen." }
                val body = JSONObject().put("title", title).put("description", description).put("version", item?.optInt("version") ?: 1)
                if(kind=="music") body.put("due",if(due.isBlank())JSONObject.NULL else LocalDate.parse(due).toString()).put("completed",released).put("location",location)
                if (kind == "tasks") body.put("due", if (due.isBlank()) JSONObject.NULL else LocalDate.parse(due).toString()).put("completed", item?.optBoolean("completed") ?: false).put("reminders_enabled",remindersEnabled).put("remind_at",if(reminder.isBlank())JSONObject.NULL else LocalDateTime.parse(reminder).atZone(ZoneId.of("Europe/Berlin")).toInstant().toString())
                if (kind == "events") {
                    val zone = ZoneId.of("Europe/Berlin")
                    val from = LocalDateTime.parse(start).atZone(zone).toInstant()
                    val to = LocalDateTime.parse(end).atZone(zone).toInstant()
                    require(to > from) { "Ende muss nach Beginn liegen." }
                    body.put("start", from.toString()).put("end", to.toString()).put("location", location)
                }
                mutate("/items/$kind" + if (item == null) "" else "/${item.getString("id")}", if (item == null) "POST" else "PUT", body) { editor = null }
            } catch (e: Exception) { validation = e.message ?: "Bitte Eingaben prüfen." }
        }, shape = RectangleShape) { Text(t("Speichern")) } }, dismissButton = { TextButton(onClick = { editor = null }, shape = RectangleShape) { Text(t("Abbrechen")) } }, shape = RectangleShape)
        if (deleting && item != null) AlertDialog(onDismissRequest = { deleting = false }, title = { Text(t("Eintrag wirklich löschen?")) }, confirmButton = { TextButton(onClick = { mutate("/items/$kind/${item.getString("id")}?version=${item.getInt("version")}", "DELETE") { deleting = false; editor = null } }, shape = RectangleShape) { Text(t("Löschen")) } }, dismissButton = { TextButton(onClick = { deleting = false }, shape = RectangleShape) { Text(t("Abbrechen")) } }, shape = RectangleShape)
    }
}

fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }

@Composable private fun SquareIconButton(onClick: () -> Unit, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Box(modifier.size(48.dp).clickable(role=Role.Button,onClick=onClick),contentAlignment=Alignment.Center) { content() }
}

@Composable private fun SquareCheckbox(checked: Boolean, enabled: Boolean, onCheckedChange: (Boolean) -> Unit) {
    val color=if(enabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
    Box(Modifier.padding(10.dp).size(24.dp).border(1.dp,color,RectangleShape).background(if(checked) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface).toggleable(value=checked,enabled=enabled,role=Role.Checkbox,onValueChange=onCheckedChange),contentAlignment=Alignment.Center) {
        if(checked) Icon(Icons.Outlined.Check,null,tint=color,modifier=Modifier.size(18.dp))
    }
}

private val programmerTypography = Typography().let { base ->
    Typography(
        displayLarge = base.displayLarge.copy(fontFamily = FontFamily.Monospace),
        displayMedium = base.displayMedium.copy(fontFamily = FontFamily.Monospace),
        displaySmall = base.displaySmall.copy(fontFamily = FontFamily.Monospace),
        headlineLarge = base.headlineLarge.copy(fontFamily = FontFamily.Monospace),
        headlineMedium = base.headlineMedium.copy(fontFamily = FontFamily.Monospace),
        headlineSmall = base.headlineSmall.copy(fontFamily = FontFamily.Monospace),
        titleLarge = base.titleLarge.copy(fontFamily = FontFamily.Monospace),
        titleMedium = base.titleMedium.copy(fontFamily = FontFamily.Monospace),
        titleSmall = base.titleSmall.copy(fontFamily = FontFamily.Monospace),
        bodyLarge = base.bodyLarge.copy(fontFamily = FontFamily.Monospace),
        bodyMedium = base.bodyMedium.copy(fontFamily = FontFamily.Monospace),
        bodySmall = base.bodySmall.copy(fontFamily = FontFamily.Monospace),
        labelLarge = base.labelLarge.copy(fontFamily = FontFamily.Monospace),
        labelMedium = base.labelMedium.copy(fontFamily = FontFamily.Monospace),
        labelSmall = base.labelSmall.copy(fontFamily = FontFamily.Monospace)
    )
}
