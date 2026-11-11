package de.monopol.everything

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import java.time.*
import java.util.Locale

val healthLabels=linkedMapOf(
    "steps" to Triple("Steps","Schritte",""),"sleep_minutes" to Triple("Sleep","Schlaf","min"),
    "resting_pulse" to Triple("Resting heart rate","Ruhepuls","bpm"),"heart_rate" to Triple("Heart rate","Puls","bpm"),
    "weight_kg" to Triple("Weight","Gewicht","kg"),"hrv_ms" to Triple("HRV","HRV","ms"),
    "oxygen_pct" to Triple("Oxygen saturation","Sauerstoffsättigung","%"),"respiratory_rate" to Triple("Respiratory rate","Atemfrequenz","/min"),
    "distance_m" to Triple("Distance","Strecke","m"),"active_kcal" to Triple("Active calories","Aktive Kalorien","kcal"),
    "total_kcal" to Triple("Total calories","Gesamte Kalorien","kcal"),"exercise_minutes" to Triple("Training","Training","min"))
fun healthName(key:String,language:String)=healthLabels[key]?.let{if(language=="de")it.second else it.first}?:key
private fun widgetWord(key:String,de:Boolean)=if(!de)when(key){"ok"->"Available";"no_data"->"No data";"denied"->"Not permitted";"error"->"Sync failed";else->key}else when(key){"day"->"Tag";"week"->"Woche";"month"->"Monat";"open"->"Offen";"done"->"Erledigt";"all"->"Alle";"ok"->"Verfügbar";"no_data"->"Keine Daten";"denied"->"Nicht freigegeben";"error"->"Abgleich fehlgeschlagen";else->key}
private fun widgetName(type:String,de:Boolean)=when(type){"health"->if(de)"Gesundheit" else "Health";"metric"->if(de)"Gesundheitswert" else "Health metric";"chart"->if(de)"Gesundheitsdiagramm" else "Health chart";"tasks"->if(de)"Aufgaben" else "Tasks";"lights"->if(de)"Lampen" else "Lights";"music"->if(de)"Musikprojekte" else "Music projects";"agent"->if(de)"KI-Chat" else "AI chat";else->"Obsidian"}
private fun JSONArray.rows():List<JSONObject> =(0 until length()).map{getJSONObject(it)}
private fun JSONArray.strings():List<String> =(0 until length()).map{getString(it)}
private fun todayHealth()=LocalDate.now(ZoneId.of("Europe/Berlin"))

@Composable fun HealthWidgetValues(days:JSONArray,metrics:List<String>,language:String) {
    val today=days.rows().find{it.optString("day")==todayHealth().toString()}
    Column(verticalArrangement=Arrangement.spacedBy(12.dp)) {
        metrics.chunked(2).forEach{pair->Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(16.dp)){pair.forEach{metric->
            val row=if(metric=="weight_kg")days.rows().firstOrNull{!it.isNull(metric)} else today
            val key=if(metric=="heart_rate"&&row!=null&&!row.isNull("heart_rate_last"))"heart_rate_last" else metric
            Column(Modifier.weight(1f)){Text(healthName(metric,language),style=MaterialTheme.typography.labelSmall);Text(if(row==null||row.isNull(key))"—" else String.format(Locale.UK,"%.1f %s",row.optDouble(key),healthLabels[metric]?.third?:""),style=MaterialTheme.typography.headlineSmall);Text(if(row==null||row.isNull(key)){if(language=="de")"Keine Messung" else "No measurement"}else if(metric=="heart_rate"&&!row.isNull("heart_rate_at"))row.optString("heart_rate_at")else row.optString("day"),style=MaterialTheme.typography.labelSmall)}
        }}}
    }
}

@Composable fun HealthWidgetChart(days:JSONArray,metric:String,period:String,api:Api,connected:Boolean,language:String) {
    val de=language=="de";var date by remember{mutableStateOf(todayHealth())};var source by remember(metric){mutableStateOf("")};var result by remember{mutableStateOf(JSONObject())};var error by remember{mutableStateOf("")}
    LaunchedEffect(metric,period,date,source,connected){result=JSONObject();error="";if(period=="day"&&connected)try{result=JSONObject(api.call("/health/series?metric=$metric&start=$date&end=$date"+if(source.isBlank())"" else "&source="+URLEncoder.encode(source,"UTF-8")))}catch(e:Exception){error=e.message?:"Request failed"}}
    val points=if(period=="day")(result.optJSONArray("samples")?:JSONArray()).rows().map{it.optString("at") to it.optDouble("value")} else days.rows().filter{!it.isNull(metric)&&it.optString("day")<=date.toString()&&it.optString("day")>=date.minusDays(if(period=="week")6 else 29).toString()}.sortedBy{it.optString("day")}.map{it.optString("day") to it.optDouble(metric)}
    Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){OutlinedButton(shape=RectangleShape,onClick={date=date.minusDays(1)}){Text("←")};Text(date.toString(),Modifier.padding(top=12.dp));OutlinedButton(shape=RectangleShape,enabled=date<todayHealth(),onClick={date=date.plusDays(1)}){Text("→")}}
    if(period=="day"){val sources=result.optJSONArray("sources")?:JSONArray();if(sources.length()>1)WidgetChoice(if(de)"Quelle" else "Source",listOf("")+sources.strings(),source,{if(it.isBlank())if(de)"Automatisch" else "Automatic" else it}){source=it}}
    if(error.isNotBlank())Text(error,color=MaterialTheme.colorScheme.error)
    if(points.isEmpty())Text(if(!connected&&period=="day"){if(de)"Zeitreihen benötigen eine Verbindung." else "Time series require a connection."}else if(de)"Keine Messungen für diesen Zeitraum." else "No measurements for this period.")
    else {
        val accent=MaterialTheme.colorScheme.primary;val min=points.minOf{it.second};val max=points.maxOf{it.second};val range=maxOf(1.0,max-min)
        Canvas(Modifier.fillMaxWidth().height(130.dp).padding(vertical=12.dp)){val stride=maxOf(1,points.size/500);val visible=points.filterIndexed{i,_->i%stride==0||i==points.lastIndex};visible.zipWithNext().forEachIndexed{i,(a,b)->drawLine(accent,Offset(i*size.width/maxOf(1,visible.size-1),size.height-((a.second-min)/range*size.height).toFloat()),Offset((i+1)*size.width/maxOf(1,visible.size-1),size.height-((b.second-min)/range*size.height).toFloat()),2f)}}
        val summary=if(period=="day")result.optJSONObject("summary") else null
        Text(String.format(Locale.UK,"Min %.1f · Ø %.1f · Max %.1f %s",summary?.optDouble("min")?:min,summary?.optDouble("mean")?:points.map{it.second}.average(),summary?.optDouble("max")?:max,healthLabels[metric]?.third?:""),style=MaterialTheme.typography.labelSmall)
        Text("${if(de)"Letzte Messung" else "Last measurement"}: ${points.last().second} · ${points.last().first}",style=MaterialTheme.typography.labelSmall)
        (result.optJSONArray("samples")?:JSONArray()).rows().map{it.optString("label")}.filter{it.isNotBlank()}.distinct().forEach{Text(it,style=MaterialTheme.typography.labelSmall)}
    }
}

@Composable private fun WidgetChoice(label:String,values:List<String>,selected:String,text:(String)->String={it},onSelect:(String)->Unit){
    var expanded by remember{mutableStateOf(false)}
    Box {OutlinedButton(shape=RectangleShape,onClick={expanded=true}){Text("$label: ${text(selected)}")};DropdownMenu(expanded=expanded,onDismissRequest={expanded=false}){values.forEach{value->DropdownMenuItem(text={Text(text(value))},onClick={onSelect(value);expanded=false})}}}
}

@Composable fun WidgetDashboard(api:Api,store:Store,data:JSONObject,connected:Boolean,language:String,layout:String,lifecycle:androidx.lifecycle.Lifecycle,onNavigate:(String)->Unit,onChanged:()->Unit,taskContent:@Composable (JSONObject)->Unit){
    val de=language=="de";val scope=rememberCoroutineScope()
    var config by remember{mutableStateOf(runCatching{JSONObject(store.get("widgetConfig"))}.getOrDefault(JSONObject().put("version",0).put("widgets",JSONArray())))}
    var draft by remember{mutableStateOf<JSONObject?>(null)};var catalog by remember{mutableStateOf(JSONArray())};var loaded by remember{mutableStateOf(false)};var busy by remember{mutableStateOf(false)};var error by remember{mutableStateOf("")};var add by remember{mutableStateOf("health")}
    suspend fun reload(){config=JSONObject(api.call("/dashboard/config"));catalog=JSONArray(api.call("/dashboard/catalog"));store.put("widgetConfig",config.toString());loaded=true;error=""}
    LaunchedEffect(connected,data){if(connected&&draft==null)try{reload()}catch(e:Exception){error=e.message?:"Request failed"}}
    val days=data.optJSONObject("health")?.optJSONArray("days")?:JSONArray()
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val desktop=maxWidth>=900.dp;val mode=if(desktop)"desktop" else "mobile";val columns=if(desktop)12 else 2
        val widgets=(draft?:config).optJSONArray("widgets")?.rows()?.sortedBy{it.getJSONObject(mode).optInt("order")}?:emptyList()
        fun update(id:String,edit:(JSONObject)->Unit){val next=JSONObject(draft.toString());next.getJSONArray("widgets").rows().find{it.optString("id")==id}?.let(edit);draft=next}
        fun move(id:String,target:Int){val list=widgets.toMutableList();val from=list.indexOfFirst{it.optString("id")==id};if(from<0)return;val item=list.removeAt(from);list.add(target.coerceIn(0,list.size),item);list.forEachIndexed{i,w->w.getJSONObject(mode).put("order",i)};draft=JSONObject(draft.toString()).put("widgets",JSONArray(list))}
        Column(verticalArrangement=Arrangement.spacedBy(16.dp)) {
            Text(if(de)"Dein Raum. Deine Module." else "Your space. Your modules.",style=MaterialTheme.typography.headlineMedium)
            if(draft==null)OutlinedButton(enabled=connected&&loaded,shape=RectangleShape,onClick={draft=JSONObject(config.toString())}){Text(if(de)"Widgets bearbeiten" else "Edit widgets")}
            else {
                Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
                    Button(enabled=connected&&!busy,shape=RectangleShape,onClick={scope.launch{busy=true;try{config=JSONObject(api.call("/dashboard/config","PUT",draft));store.put("widgetConfig",config.toString());draft=null;error=""}catch(e:Exception){error=e.message?:"Request failed"}finally{busy=false}}}){Text(if(de)"Speichern" else "Save dashboard")}
                    OutlinedButton(enabled=!busy,shape=RectangleShape,onClick={draft=null;error=""}){Text(if(de)"Abbrechen" else "Cancel")}
                }
                WidgetChoice(if(de)"Widget" else "Widget",catalog.rows().map{it.optString("type")},add,{widgetName(it,de)}){add=it}
                OutlinedButton(enabled=widgets.size<40,shape=RectangleShape,onClick={val c=catalog.rows().find{it.optString("type")==add}?:return@OutlinedButton;val order=(widgets.maxOfOrNull{maxOf(it.getJSONObject("desktop").optInt("order"),it.getJSONObject("mobile").optInt("order"))}?:-1)+1;val w=JSONObject().put("id",java.util.UUID.randomUUID().toString()).put("type",add).put("title","").put("options",JSONObject(c.getJSONObject("options").toString())).put("desktop",JSONObject().put("order",order).put("width",6).put("height",1)).put("mobile",JSONObject().put("order",order).put("width",2).put("height",1));draft=JSONObject(draft.toString()).put("widgets",JSONArray(widgets+w))}){Text(if(de)"+ Hinzufügen" else "+ Add")}
                OutlinedButton(shape=RectangleShape,onClick={val types=catalog.rows().filter{it.optString("type")!="metric"};draft=JSONObject().put("version",config.optInt("version")).put("widgets",JSONArray(types.mapIndexed{i,c->JSONObject().put("id","default-"+c.optString("type")).put("type",c.optString("type")).put("title","").put("options",JSONObject(c.getJSONObject("options").toString())).put("desktop",JSONObject().put("order",i).put("width",if(i==0)12 else 6).put("height",1)).put("mobile",JSONObject().put("order",i).put("width",2).put("height",1))}))}){Text(if(de)"Standard wiederherstellen" else "Restore defaults")}
                Text(if(desktop)"Desktop" else if(de)"Handy-Anordnung" else "Mobile arrangement",style=MaterialTheme.typography.labelSmall)
            }
            if(error.isNotBlank()){Text(error,color=MaterialTheme.colorScheme.error);OutlinedButton(enabled=connected,shape=RectangleShape,onClick={scope.launch{try{reload();draft=null}catch(e:Exception){error=e.message?:"Request failed"}}}){Text(if(de)"Neu laden" else "Reload dashboard")}}
            val packed=packWidgetRows(widgets.map{if(layout=="focus")columns else it.getJSONObject(mode).optInt("width")},columns).map{row->row.map{widgets[it]}}
            packed.forEach{group->Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(12.dp)){
                group.forEach{w->val id=w.optString("id");val type=w.optString("type");val placement=w.getJSONObject(mode);val options=w.getJSONObject("options");val width=if(layout=="focus")columns else placement.optInt("width");val title=w.optString("title").ifBlank{widgetName(type,de)}
                    Surface(Modifier.weight(width.toFloat()).border(1.dp,MaterialTheme.colorScheme.outline),shape=RectangleShape,color=MaterialTheme.colorScheme.surfaceVariant){Column(Modifier.padding(14.dp).heightIn(min=(180*placement.optInt("height",1)).dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
                        Text(title,style=MaterialTheme.typography.titleMedium)
                        if(draft!=null){
                            var drag by remember{mutableFloatStateOf(0f)}
                            Text("⠿ ${if(de)"Ziehen" else "Drag"}",Modifier.pointerInput(id,widgets){detectDragGestures(onDragStart={drag=0f},onDragEnd={val index=widgets.indexOf(w);move(id,index+if(drag>40)1 else if(drag< -40)-1 else 0)}){change,amount->change.consume();drag+=amount.y}})
                            Row{OutlinedButton(shape=RectangleShape,onClick={move(id,widgets.indexOf(w)-1)}){Text("↑")};OutlinedButton(shape=RectangleShape,onClick={move(id,widgets.indexOf(w)+1)}){Text("↓")};OutlinedButton(shape=RectangleShape,onClick={draft=JSONObject(draft.toString()).put("widgets",JSONArray(widgets.filter{it.optString("id")!=id}))}){Text("×")}}
                            OutlinedTextField(w.optString("title"),{value->update(id){it.put("title",value.take(100))}},label={Text(if(de)"Titel" else "Title")},shape=RectangleShape,modifier=Modifier.fillMaxWidth())
                            WidgetChoice(if(de)"Breite" else "Width",if(desktop)listOf("3","6","12") else listOf("1","2"),width.toString()){value->update(id){it.getJSONObject(mode).put("width",value.toInt())}}
                            WidgetChoice(if(de)"Höhe" else "Height",listOf("1","2","3"),placement.optInt("height",1).toString()){value->update(id){it.getJSONObject(mode).put("height",value.toInt())}}
                            if(type in listOf("metric","chart"))WidgetChoice(if(de)"Messwert" else "Metric",healthLabels.keys.toList(),options.optString("metric","heart_rate"),{healthName(it,language)}){value->update(id){it.getJSONObject("options").put("metric",value)}}
                            if(type=="health")healthLabels.keys.forEach{m->val selected=(options.optJSONArray("metrics")?:JSONArray()).strings();Row{Checkbox(m in selected,{checked->val next=if(checked)selected+m else selected-m;if(next.isNotEmpty())update(id){it.getJSONObject("options").put("metrics",JSONArray(next))}});Text(healthName(m,language),Modifier.padding(top=12.dp))}}
                            if(type=="chart")WidgetChoice(if(de)"Zeitraum" else "Period",listOf("day","week","month"),options.optString("period","week"),{widgetWord(it,de)}){value->update(id){it.getJSONObject("options").put("period",value)}}
                            if(type=="tasks")WidgetChoice(if(de)"Filter" else "Filter",listOf("open","done","all"),options.optString("filter","open"),{widgetWord(it,de)}){value->update(id){it.getJSONObject("options").put("filter",value)}}
                            if(type in listOf("obsidian","music","lights")){val key=when(type){"obsidian"->"path";"music"->"project_id";else->"entity_ids"};val value=if(type=="lights")(options.optJSONArray(key)?:JSONArray()).strings().joinToString(", ")else options.optString(key);OutlinedTextField(value,{text->update(id){it.getJSONObject("options").put(key,if(type=="lights")JSONArray(text.split(',').map{v->v.trim()}.filter{v->v.isNotBlank()})else text)}},label={Text(when(type){"obsidian"->if(de)"Notizpfad (leer: Liste)" else "Note path (empty: list)";"music"->if(de)"Projekt-ID (leer: alle)" else "Project ID (empty: all)";else->if(de)"Lampen-IDs, Komma getrennt" else "Light IDs, comma separated"})},modifier=Modifier.fillMaxWidth(),shape=RectangleShape)}
                            Text(if(de)"Vorschau" else "Preview",style=MaterialTheme.typography.labelSmall)
                            if(type in listOf("health","metric"))HealthWidgetValues(days,if(type=="metric")listOf(options.optString("metric"))else (options.optJSONArray("metrics")?:JSONArray()).strings(),language)
                        }else when(type){
                            "health"->HealthWidgetValues(days,(options.optJSONArray("metrics")?:JSONArray()).strings(),language)
                            "metric"->HealthWidgetValues(days,listOf(options.optString("metric","heart_rate")),language)
                            "chart"->if(options.optString("metric")=="steps")StepsChart(days,language)else HealthWidgetChart(days,options.optString("metric"),options.optString("period","week"),api,connected,language)
                            "tasks"->{(data.optJSONArray("tasks")?:JSONArray()).rows().filter{options.optString("filter")=="all"||if(options.optString("filter")=="done")it.optBoolean("completed") else !it.optBoolean("completed")}.forEach{taskContent(it)};OutlinedButton(shape=RectangleShape,onClick={onNavigate("Aufgaben")}){Text(if(de)"Aufgaben öffnen" else "Open tasks")}}
                            "lights"->SmartHomeScreen(api,connected,language,lifecycle,{onNavigate("Einstellungen")},onChanged,(options.optJSONArray("entity_ids")?:JSONArray()).strings())
                            "music"->{(data.optJSONArray("music")?:JSONArray()).rows().filter{options.optString("project_id").isBlank()||it.optString("id")==options.optString("project_id")}.forEach{Text(it.optString("title"));Text(it.optString("description"))};OutlinedButton(shape=RectangleShape,onClick={onNavigate("Musik")}){Text(if(de)"Musik öffnen" else "Open music")}}
                            "obsidian"->ObsidianWidgetNote(api,connected,language,options.optString("path"))
                            "agent"->ConnectedModule("KI-Agent",api,connected,language,onChanged)
                        }
                    }}
                }
                val occupied=group.sumOf{if(layout=="focus")columns else it.getJSONObject(mode).optInt("width")};if(occupied<columns)Spacer(Modifier.weight((columns-occupied).toFloat()))
            }}
            if(widgets.isEmpty())Text(if(de)"Füge Widgets im Bearbeitungsmodus hinzu." else "Add widgets in edit mode.")
        }
    }
}

@Composable private fun ObsidianWidgetNote(api:Api,connected:Boolean,language:String,path:String){
    var selected by remember(path){mutableStateOf(path)};var content by remember{mutableStateOf("")};var notes by remember{mutableStateOf(JSONArray())};var error by remember{mutableStateOf("")}
    LaunchedEffect(selected,connected){content="";error="";if(connected)try{if(selected.isBlank())notes=JSONArray(api.call("/obsidian/notes"))else content=JSONObject(api.call("/obsidian/note?path="+URLEncoder.encode(selected,"UTF-8"))).optString("content")}catch(e:Exception){error=e.message?:"Request failed"}}
    if(error.isNotBlank())Text(error,color=MaterialTheme.colorScheme.error)
    if(!connected)Text(if(language=="de")"Notizen benötigen eine Verbindung." else "Notes require a connection.")
    if(selected.isNotBlank()){OutlinedButton(shape=RectangleShape,onClick={selected=""}){Text(if(language=="de")"Notizen" else "Notes")};Text(selected);Text(content)}else notes.rows().take(30).forEach{note->OutlinedButton(shape=RectangleShape,onClick={selected=note.optString("path")}){Text(note.optString("title",note.optString("path")))}}
}

@Composable fun HealthSources(api:Api,connected:Boolean,language:String,days:JSONArray){
    val de=language=="de";var metrics by remember{mutableStateOf(JSONArray())};var metric by remember{mutableStateOf("heart_rate")};var period by remember{mutableStateOf("day")};var error by remember{mutableStateOf("")}
    LaunchedEffect(connected,days){if(connected)try{metrics=JSONObject(api.call("/health/metrics")).getJSONArray("metrics");error=""}catch(e:Exception){error=e.message?:"Request failed"}}
    HealthWidgetValues(days,healthLabels.keys.toList(),language)
    WidgetChoice(if(de)"Messwert" else "Metric",healthLabels.keys.toList(),metric,{healthName(it,language)}){metric=it}
    WidgetChoice(if(de)"Zeitraum" else "Period",listOf("day","week","month"),period,{widgetWord(it,de)}){period=it}
    HealthWidgetChart(days,metric,period,api,connected,language)
    if(error.isNotBlank())Text(error,color=MaterialTheme.colorScheme.error)
    Text(if(de)"Datenquellen und Berechtigungen" else "Sources and permissions",style=MaterialTheme.typography.titleMedium)
    metrics.rows().forEach{m->Text(healthName(m.optString("id"),language));Text("${widgetWord(m.optString("state"),de).ifBlank { if(de)"Noch nicht synchronisiert" else "Not synced yet" }} · ${(m.optJSONArray("sources")?:JSONArray()).strings().joinToString()}",style=MaterialTheme.typography.labelSmall);Text("${if(de)"Letzter Abgleich" else "Last sync"}: ${m.optString("last_sync","—")}\n${if(de)"Messung" else "Measurement"}: ${m.optString("last_measurement","—")}",style=MaterialTheme.typography.labelSmall)}
}
