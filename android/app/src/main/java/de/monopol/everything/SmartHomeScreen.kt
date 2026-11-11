package de.monopol.everything

import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.os.PersistableBundle
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

@Composable fun SmartHomeScreen(api:Api,connected:Boolean,language:String,lifecycle:Lifecycle,settings:()->Unit,onChanged:()->Unit,entityIds:List<String> = emptyList()) {
    fun t(s:String)=Localizer.text(s,language)
    val scope=rememberCoroutineScope()
    var data by remember{mutableStateOf(JSONObject())}
    var error by remember{mutableStateOf("")}
    var networkError by remember{mutableStateOf("")}
    var message by remember{mutableStateOf("")}
    var search by remember{mutableStateOf("")}
    var busy by remember{mutableStateOf(false)}
    LaunchedEffect(connected,lifecycle){if(connected)lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED){while(true){try{data=JSONObject(api.call("/smart-home/lights"));networkError=""}catch(e:Exception){networkError=e.message?:"Bridge offline";data=JSONObject(data.toString()).put("status","offline")};delay(5000)}}}
    fun send(id:String,values:JSONObject){if(busy)return;busy=true;error="";message=t("Befehl wird gesendet…");scope.launch{try{
        val body=JSONObject(values.toString()).put("request_id",UUID.randomUUID().toString()).put("entity_ids",JSONArray().put(id))
        var command=JSONObject(api.call("/smart-home/commands","POST",body));var attempts=0
        while(command.optString("status") in listOf("pending","dispatched")&&attempts++<35){delay(500);command=JSONObject(api.call("/smart-home/commands/${command.getString("id")}"))}
        require(command.optString("status")=="accepted"){t(if(command.optString("status")=="unknown")"Ergebnis unklar. Aktuellen Lampenzustand prüfen." else "Befehl fehlgeschlagen oder abgelaufen.")}
        message=t("Home Assistant hat den Befehl angenommen. Angezeigt wird der zuletzt gemeldete Zustand.");data=JSONObject(api.call("/smart-home/lights"));onChanged()
    }catch(e:Exception){error=e.message?:"Request failed";message=""}finally{busy=false}}}
    val status=data.optString("status","not_configured")
    Text(t("Licht in deiner Hand."),style=MaterialTheme.typography.headlineMedium)
    Text(t(when(status){"online"->"Verbunden";"offline"->"Bridge offline";"ha_unavailable"->"Home Assistant nicht erreichbar";else->"Noch nicht eingerichtet"}),color=MaterialTheme.colorScheme.primary)
    if(error.isNotBlank())Text(t(error),color=MaterialTheme.colorScheme.error)
    if(networkError.isNotBlank())Text(t(networkError),color=MaterialTheme.colorScheme.error)
    if(message.isNotBlank())Text(message,style=MaterialTheme.typography.bodySmall)
    if(status!="online"){Text(t("Die lokale Docker-Bridge muss laufen. Offline werden keine Schaltbefehle vorgemerkt."));OutlinedButton(onClick=settings,shape=RectangleShape){Text(t("Bridge einrichten"))}}
    OutlinedTextField(search,{search=it},label={Text(t("Lampen suchen"))},modifier=Modifier.fillMaxWidth(),shape=RectangleShape)
    val lamps=(data.optJSONArray("lights")?:JSONArray()).objects().filter{entityIds.isEmpty()||it.optString("entity_id") in entityIds}.filter{(it.optString("name")+" "+it.optString("entity_id")).contains(search,true)}.sortedBy{it.optString("name")}
    lamps.forEach{lamp->key(lamp.getString("entity_id")){LightControls(lamp,status=="online"&&connected&&!busy,language){values->send(lamp.getString("entity_id"),values)}}}
    if(status=="online"&&lamps.isEmpty())Text(t("Keine light-Entitäten in Home Assistant gefunden."))
}

@Composable private fun LightControls(lamp:JSONObject,online:Boolean,language:String,send:(JSONObject)->Unit){
    fun t(s:String)=Localizer.text(s,language)
    val modes=(lamp.optJSONArray("supported_color_modes")?:JSONArray()).let{arr->(0 until arr.length()).map{arr.getString(it)}}
    val enabled=online&&lamp.optString("state") in listOf("on","off")
    var brightness by remember{mutableFloatStateOf(lamp.optInt("brightness_pct",100).toFloat())}
    var temperature by remember{mutableFloatStateOf(lamp.optInt("color_temp_kelvin",lamp.optInt("min_kelvin",2700)).toFloat())}
    var color by remember{mutableStateOf("#ffffff")}
    var dragging by remember{mutableStateOf(false)}
    LaunchedEffect(lamp.optInt("brightness_pct",100)){if(!dragging)brightness=lamp.optInt("brightness_pct",100).toFloat()}
    LaunchedEffect(lamp.optInt("color_temp_kelvin",0)){if(!dragging)temperature=lamp.optInt("color_temp_kelvin",lamp.optInt("min_kelvin",2700)).toFloat()}
    LaunchedEffect(lamp.optJSONArray("rgb_color")?.toString()){lamp.optJSONArray("rgb_color")?.let{if(it.length()==3)color="#"+(0..2).joinToString(""){i->it.getInt(i).toString(16).padStart(2,'0')}}}
    Card(Modifier.fillMaxWidth(),shape=RectangleShape){Column(Modifier.padding(18.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
        Text(lamp.optString("name"),style=MaterialTheme.typography.titleMedium)
        Text(lamp.optString("entity_id"),style=MaterialTheme.typography.labelSmall)
        Text(t(when(lamp.optString("state")){"on"->"An";"off"->"Aus";else->"Nicht verfügbar"}),color=MaterialTheme.colorScheme.primary)
        OutlinedButton(enabled=enabled,onClick={send(JSONObject().put("power",if(lamp.optString("state")=="on")"off" else "on"))},shape=RectangleShape){Text(t(if(lamp.optString("state")=="on")"Ausschalten" else "Einschalten"))}
        if(modes.any{it !in listOf("onoff","unknown")}){
            Text("${t("Helligkeit")}: ${brightness.toInt()}%")
            AngularSlider(brightness,{brightness=it;dragging=true},{dragging=false;send(JSONObject().put("brightness_pct",brightness.toInt()))},0f..100f,enabled)
        }
        if(modes.any{it in listOf("hs","xy","rgb","rgbw","rgbww")}){
            OutlinedTextField(color,{color=it},label={Text(t("Lichtfarbe")+" #RRGGBB")},singleLine=true,enabled=enabled,shape=RectangleShape,modifier=Modifier.fillMaxWidth())
            OutlinedButton(enabled=enabled&&Regex("#[a-fA-F0-9]{6}").matches(color),onClick={send(JSONObject().put("rgb_color",JSONArray(listOf(1,3,5).map{color.substring(it,it+2).toInt(16)})))},shape=RectangleShape){Text(t("Farbe anwenden"))}
        }
        if("color_temp" in modes&&!lamp.isNull("min_kelvin")&&!lamp.isNull("max_kelvin")){
            val minimum=lamp.getInt("min_kelvin").toFloat();val maximum=lamp.getInt("max_kelvin").toFloat()
            Text("${t("Farbtemperatur")}: ${temperature.toInt()} K")
            if(maximum>minimum)AngularSlider(temperature.coerceIn(minimum,maximum),{temperature=it;dragging=true},{dragging=false;send(JSONObject().put("color_temp_kelvin",temperature.toInt()))},minimum..maximum,enabled)
        }
    }}
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun AngularSlider(value:Float,change:(Float)->Unit,finished:()->Unit,range:ClosedFloatingPointRange<Float>,enabled:Boolean){
    val accent=if(enabled)MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline;val line=MaterialTheme.colorScheme.outline
    Slider(value=value,onValueChange=change,onValueChangeFinished=finished,valueRange=range,enabled=enabled,
        thumb={Box(Modifier.size(14.dp,24.dp).background(accent,RectangleShape))},track={state->Canvas(Modifier.fillMaxWidth().height(3.dp)){drawRect(line);drawRect(accent,size=Size(size.width*((state.value-range.start)/(range.endInclusive-range.start)),size.height))}})
}

@Composable fun HomeBridgeSettings(api:Api,connected:Boolean,language:String){
    fun t(s:String)=Localizer.text(s,language)
    val context=LocalContext.current;val scope=rememberCoroutineScope()
    var token by remember{mutableStateOf("")};var busy by remember{mutableStateOf(false)};var error by remember{mutableStateOf("")}
    Text(t("Home-Assistant-Bridge"),style=MaterialTheme.typography.titleMedium)
    Text(t("Starte die Docker-Bridge in deinem Heimnetz. Home Assistant bleibt lokal; die Bridge verbindet sich ausgehend mit dieser App."))
    Text(t("Ein neues Bridge-Token ersetzt das bisherige und trennt eine vorhandene Bridge. Das Home-Assistant-Token bleibt nur im Heimnetz."),style=MaterialTheme.typography.bodySmall)
    OutlinedButton(enabled=connected&&!busy,shape=RectangleShape,onClick={busy=true;error="";scope.launch{try{token=JSONObject(api.call("/smart-home/bridge-token","POST")).getString("token")}catch(e:Exception){error=e.message?:"Request failed"}finally{busy=false}}}){Text(t("Bridge-Token erzeugen / ersetzen"))}
    if(token.isNotBlank()){
        OutlinedTextField(token,{},readOnly=true,label={Text(t("Einmaliges Bridge-Token"))},visualTransformation=PasswordVisualTransformation(),shape=RectangleShape,modifier=Modifier.fillMaxWidth())
        OutlinedButton(shape=RectangleShape,onClick={val clip=ClipData.newPlainText("MainFrame bridge token",token);clip.description.extras=PersistableBundle().apply{putBoolean(ClipDescription.EXTRA_IS_SENSITIVE,true)};(context.getSystemService(Context.CLIPBOARD_SERVICE)as ClipboardManager).setPrimaryClip(clip)}){Text(t("Token kopieren"))}
        OutlinedButton(shape=RectangleShape,onClick={token=""}){Text(t("Ausblenden"))}
        Text(t("Jetzt sicher in der lokalen Secret-Datei speichern. Das Token wird nicht dauerhaft auf diesem Gerät gespeichert."),style=MaterialTheme.typography.bodySmall)
    }
    if(error.isNotBlank())Text(t(error),color=MaterialTheme.colorScheme.error)
    Text(t("Einrichtung: compose.bridge.yaml und docs/home-assistant.md im Repository."),style=MaterialTheme.typography.bodySmall)
}
