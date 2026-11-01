package de.monopol.everything

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import org.json.JSONObject
import kotlin.math.*

@Composable fun BrainGraph(graph:JSONObject,language:String,onOpen:(String)->Unit) {
    fun t(s:String)=Localizer.text(s,language)
    val nodes=graph.optJSONArray("nodes")?.objects()?:emptyList()
    val edges=graph.optJSONArray("edges")?.objects()?:emptyList()
    var selected by remember{mutableStateOf("")}
    var zoom by remember{mutableStateOf(1f)}
    val primary=MaterialTheme.colorScheme.primary;val muted=MaterialTheme.colorScheme.onSurfaceVariant;val line=MaterialTheme.colorScheme.outline
    fun point(i:Int,width:Float,height:Float):Offset {val radius=sqrt((i+.5)/max(1,nodes.size));val angle=i*2.39996;return Offset(width/2+(cos(angle)*radius*width*.42*zoom).toFloat(),height/2+(sin(angle)*radius*height*.42*zoom).toFloat())}
    val indexes=nodes.mapIndexed{i,n->n.optString("path") to i}.toMap()
    Text(graph.optString("name","mono_frame_brain"),style=MaterialTheme.typography.titleLarge)
    Text("${nodes.size} / ${graph.optInt("total")} ${t("Notizen")} · ${edges.size} ${t("Verbindungen")}",style=MaterialTheme.typography.labelSmall)
    Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick={zoom=max(.5f,zoom-.25f)},shape=RectangleShape){Text("−")}
        OutlinedButton(onClick={zoom=1f;selected=""},shape=RectangleShape){Text(t("Zurücksetzen"))}
        OutlinedButton(onClick={zoom=min(3f,zoom+.25f)},shape=RectangleShape){Text("+")}
    }
    Canvas(Modifier.fillMaxWidth().height(320.dp).pointerInput(graph,zoom){detectTapGestures{tap->val i=nodes.indices.minByOrNull{(point(it,size.width.toFloat(),size.height.toFloat())-tap).getDistance()};if(i!=null&&(point(i,size.width.toFloat(),size.height.toFloat())-tap).getDistance()<35f)selected=nodes[i].optString("path")}}) {
        clipRect {
            edges.forEach{e->val a=indexes[e.optString("source")];val b=indexes[e.optString("target")];if(a!=null&&b!=null)drawLine(if(selected==e.optString("source")||selected==e.optString("target"))primary else line,point(a,size.width,size.height),point(b,size.width,size.height),1.5f)}
            nodes.forEachIndexed{i,n->val p=point(i,size.width,size.height);drawRect(if(n.optString("path")==selected)primary else muted,p-Offset(5f,5f),Size(10f,10f))}
        }
    }
    if(nodes.isEmpty())Text(t("Noch keine Notizen im Graph."))
    if(graph.optBoolean("truncated"))Text(t("Begrenzte Graphansicht. Große oder nicht lesbare Notizen wurden teilweise ausgelassen."),style=MaterialTheme.typography.labelSmall)
    if(selected.isNotBlank())OutlinedButton(onClick={onOpen(selected)},shape=RectangleShape){Text("${t("Notiz öffnen")}: $selected")}
}
