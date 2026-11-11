package de.monopol.everything

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import org.json.JSONObject
import java.time.ZonedDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

@Composable fun CanvasText(options:JSONObject,language:String){
    val value=options.optString("text").let{if(it=="Welcome to MainFrame."&&language=="de")"Willkommen im MainFrame." else it}
    Text(value,Modifier.fillMaxWidth(),fontSize=options.optInt("size",28).coerceIn(12,96).sp,fontWeight=if(options.optBoolean("bold"))FontWeight.Bold else FontWeight.Normal,textAlign=when(options.optString("align")){"center"->TextAlign.Center;"right"->TextAlign.Right;else->TextAlign.Left},lineHeight=(options.optInt("size",28)*1.25f).sp)
}
@Composable fun CanvasClock(options:JSONObject,language:String){
    var now by remember{mutableStateOf(ZonedDateTime.now())}
    LaunchedEffect(Unit){while(true){now=ZonedDateTime.now();delay(1000)}}
    val zone=runCatching{ZoneId.of(options.optString("timezone","Europe/Berlin"))}.getOrDefault(ZoneId.of("UTC"))
    val time=now.withZoneSameInstant(zone);val locale=if(language=="de")Locale.GERMANY else Locale.UK;val format=options.optString("format","both")
    Column {
        if(format!="date")Text(time.format(DateTimeFormatter.ofPattern(if(options.optBoolean("seconds"))"HH:mm:ss" else "HH:mm",locale)),fontSize=options.optInt("size",32).coerceIn(12,96).sp)
        if(format!="digital")Text(time.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.FULL).withLocale(locale)),style=MaterialTheme.typography.labelMedium)
        Text(zone.id,style=MaterialTheme.typography.labelSmall)
    }
}
@Composable private fun CanvasChoice(label:String,values:List<String>,selected:String,onSelect:(String)->Unit){
    var open by remember{mutableStateOf(false)}
    Box{OutlinedButton(shape=RectangleShape,onClick={open=true}){Text("$label: ${selected.ifBlank{"Home"}}")};DropdownMenu(expanded=open,onDismissRequest={open=false}){values.forEach{v->DropdownMenuItem(text={Text(v.ifBlank{"Home"})},onClick={onSelect(v);open=false})}}}
}
@Composable fun CanvasElementSettings(widget:JSONObject,boxes:List<JSONObject>,language:String,onUpdate:(JSONObject)->Unit){
    val de=language=="de";val type=widget.optString("type");val options=widget.getJSONObject("options");val appearance=widget.optJSONObject("appearance")?:JSONObject().put("header",true).put("border",true).put("background","panel").put("padding",18)
    fun option(key:String,value:Any){val next=JSONObject(widget.toString());next.getJSONObject("options").put(key,value);onUpdate(next)}
    fun style(key:String,value:Any){val next=JSONObject(widget.toString());next.put("appearance",JSONObject(appearance.toString()).put(key,value));onUpdate(next)}
    if(type=="text"){
        OutlinedTextField(options.optString("text"),{option("text",it.take(10000))},label={Text(if(de)"Textinhalt" else "Text content")},modifier=Modifier.fillMaxWidth(),shape=RectangleShape)
        CanvasChoice(if(de)"Ausrichtung" else "Alignment",listOf("left","center","right"),options.optString("align","left")){option("align",it)}
        OutlinedButton(shape=RectangleShape,onClick={option("bold",!options.optBoolean("bold"))}){Text("${if(options.optBoolean("bold"))"[x]" else "[ ]"} ${if(de)"Fett" else "Bold"}")}
    }
    if(type in listOf("text","clock"))OutlinedTextField(options.optInt("size",28).toString(),{it.toIntOrNull()?.let{size->option("size",size.coerceIn(12,96))}},label={Text(if(de)"Schriftgröße" else "Font size")},shape=RectangleShape)
    if(type=="clock"){
        OutlinedTextField(options.optString("timezone","Europe/Berlin"),{option("timezone",it)},label={Text(if(de)"Zeitzone" else "Time zone")},shape=RectangleShape,modifier=Modifier.fillMaxWidth())
        CanvasChoice(if(de)"Anzeige" else "Display",listOf("digital","date","both"),options.optString("format","both")){option("format",it)}
        OutlinedButton(shape=RectangleShape,onClick={option("seconds",!options.optBoolean("seconds"))}){Text("${if(options.optBoolean("seconds"))"[x]" else "[ ]"} ${if(de)"Sekunden" else "Seconds"}")}
    }
    if(type=="action")CanvasChoice(if(de)"Ziel" else "Destination",listOf("new_task","tasks","health","agent","music","home","obsidian"),options.optString("action","tasks")){option("action",it)}
    for((key,label) in listOf("header" to if(de)"Titelzeile" else "Title bar","border" to if(de)"Rahmen" else "Border"))OutlinedButton(shape=RectangleShape,onClick={style(key,!appearance.optBoolean(key,true))}){Text("${if(appearance.optBoolean(key,true))"[x]" else "[ ]"} $label")}
    CanvasChoice(if(de)"Hintergrund" else "Background",listOf("panel","none","accent"),appearance.optString("background","panel")){style("background",it)}
    OutlinedTextField(appearance.optInt("padding",18).toString(),{it.toIntOrNull()?.let{padding->style("padding",padding.coerceIn(0,48))}},label={Text(if(de)"Innenabstand" else "Padding")},shape=RectangleShape)
    if(type!="box")CanvasChoice(if(de)"In Box" else "Inside box",listOf("")+boxes.map{it.optString("id")},widget.optString("parent_id").takeUnless{it=="null"}?:""){parent->onUpdate(JSONObject(widget.toString()).put("parent_id",if(parent.isBlank())JSONObject.NULL else parent))}
}
