package de.monopol.everything

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder

@Composable fun ConnectedModule(screen:String,api:Api,connected:Boolean,language:String) {
    fun t(s:String)=Localizer.text(s,language)
    val scope=rememberCoroutineScope()
    var error by remember(screen){mutableStateOf("")}
    var busy by remember(screen){mutableStateOf(false)}
    var status by remember(screen){mutableStateOf(JSONObject())}
    var prompt by remember {mutableStateOf("")}
    var messages by remember {mutableStateOf(listOf<Pair<String,String>>())}
    var notes by remember {mutableStateOf(JSONArray())}
    var selected by remember {mutableStateOf<JSONObject?>(null)}
    var path by remember {mutableStateOf("")}
    var content by remember {mutableStateOf("")}
    var dirty by remember {mutableStateOf(false)}
    var pending by remember {mutableStateOf<String?>(null)}
    fun open(target:String) {scope.launch {busy=true;error="";try{selected=if(target.isBlank()) JSONObject().put("version","") else JSONObject(api.call("/obsidian/note?path="+URLEncoder.encode(target,"UTF-8")));path=target;content=selected?.optString("content")?:"";dirty=false}catch(e:Exception){error=e.message?:"Request failed"}finally{busy=false}}}
    LaunchedEffect(screen,connected) {if(connected)try{status=JSONObject(api.call("/integrations"));if(screen=="Obsidian"&&status.optBoolean("obsidian"))notes=JSONArray(api.call("/obsidian/notes"))}catch(e:Exception){error=e.message?:"Request failed"}}
    if(error.isNotBlank()) Text(t(error),color=MaterialTheme.colorScheme.error)
    if(screen=="KI-Agent") {
        Text(t("Ein Chat. Dein ganzer Workspace."),style=MaterialTheme.typography.titleLarge)
        Text(t("Beim Senden werden App-Daten inklusive Gesundheitswerten an deinen konfigurierten KI-Anbieter übermittelt. Keine API-Schlüssel im Browser."),style=MaterialTheme.typography.bodySmall)
        if(!status.optBoolean("ai")) Text(t("API nicht verbunden")) else Text(status.optString("model"),color=MaterialTheme.colorScheme.primary)
        messages.forEach {(role,text)->Card(Modifier.fillMaxWidth(),shape=RectangleShape){Column(Modifier.padding(14.dp)){Text(if(role=="user")"YOU" else "MAINFRAME AGENT",style=MaterialTheme.typography.labelSmall);Text(text)}}}
        if(busy) Text(t("Agent denkt nach…"))
        OutlinedTextField(prompt,{prompt=it.take(12000)},label={Text(t("Nachricht an den Agenten"))},modifier=Modifier.fillMaxWidth(),shape=RectangleShape)
        Button(enabled=connected&&status.optBoolean("ai")&&!busy&&prompt.isNotBlank(),shape=RectangleShape,onClick={
            val next=messages+Pair("user",prompt.trim());messages=next;prompt="";busy=true;error=""
            scope.launch{try{val history=JSONArray();next.takeLast(29).forEach{(role,text)->history.put(JSONObject().put("role",role).put("content",text))};val result=JSONObject(api.call("/agent/chat","POST",JSONObject().put("messages",history)));messages=next+Pair("assistant",result.getString("reply"))}catch(e:Exception){error=e.message?:"Request failed"}finally{busy=false}}
        }){Text(t("Senden"))}
    } else {
        Text(t("Dein Wissen, verbunden."),style=MaterialTheme.typography.titleLarge)
        if(!status.optBoolean("obsidian"))Text(t("Binde deinen Obsidian-Ordner auf dem Server ein und setze OBSIDIAN_VAULT_PATH. Deine Markdown-Dateien bleiben in deinem Vault."))
        else {
            OutlinedButton(enabled=!busy,onClick={if(dirty)pending="" else open("")},shape=RectangleShape){Text(t("Neue Vault-Notiz"))}
            for(i in 0 until notes.length()){val n=notes.getJSONObject(i);OutlinedButton(enabled=!busy,onClick={if(dirty)pending=n.getString("path") else open(n.getString("path"))},shape=RectangleShape){Text(n.getString("path"))}}
            if(selected!=null){
                OutlinedTextField(path,{path=it;dirty=true},readOnly=selected!!.optString("version").isNotBlank(),label={Text(t("Dateipfad im Vault"))},modifier=Modifier.fillMaxWidth(),shape=RectangleShape)
                OutlinedTextField(content,{content=it.take(200000);dirty=true},label={Text(t("Markdown-Inhalt"))},minLines=10,modifier=Modifier.fillMaxWidth(),shape=RectangleShape)
                Button(enabled=connected&&!busy&&dirty&&path.isNotBlank(),shape=RectangleShape,onClick={busy=true;error="";scope.launch{try{selected=JSONObject(api.call("/obsidian/note","PUT",JSONObject().put("path",path).put("content",content).put("version",selected!!.optString("version"))));dirty=false;notes=JSONArray(api.call("/obsidian/notes"))}catch(e:Exception){error=e.message?:"Request failed"}finally{busy=false}}}){Text(t("Speichern")+if(dirty)" *" else "")}
            }
        }
    }
    if(pending!=null) AlertDialog(shape=RectangleShape,onDismissRequest={pending=null},title={Text(t("Ungespeicherte Änderungen verwerfen?"))},confirmButton={TextButton(shape=RectangleShape,onClick={val target=pending!!;pending=null;open(target)}){Text(t("Verwerfen"))}},dismissButton={TextButton(shape=RectangleShape,onClick={pending=null}){Text(t("Abbrechen"))}})
}
