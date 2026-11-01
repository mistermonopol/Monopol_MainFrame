package de.monopol.everything

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONArray
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.text.NumberFormat

@Composable fun StepsChart(days: JSONArray, language: String) {
    var period by remember { mutableStateOf(StepPeriod.DAILY) }
    var selected by remember { mutableStateOf<Int?>(null) }
    val t = { value: String -> Localizer.text(value,language) }
    val locale = if(language=="de") Locale.GERMANY else Locale.UK
    val number = NumberFormat.getIntegerInstance(locale)
    val samples = days.objects().mapNotNull { day -> runCatching { StepSample(LocalDate.parse(day.getString("day")), if(day.isNull("steps")) null else day.getLong("steps")) }.getOrNull() }
    val buckets = aggregateSteps(samples,period,LocalDate.now(ZoneId.of("Europe/Berlin")))
    val maximum = maxOf(1L,buckets.maxOf { it.steps ?: 0L })
    val dateFormat = DateTimeFormatter.ofPattern(if(period==StepPeriod.MONTHLY) "MMM yy" else "dd MMM",locale)
    fun describe(bucket: StepBucket) = "${bucket.start.format(dateFormat)}${if(period==StepPeriod.DAILY) "" else " – ${bucket.end.format(dateFormat)}"}: ${bucket.steps?.let { number.format(it)+" "+t("Schritte") } ?: t("Keine Daten")} · ${bucket.recorded}/${bucket.expected} ${t("erfasste Tage")}${if(bucket.recorded>0&&bucket.recorded<bucket.expected) " · "+t("Unvollständige Daten") else ""}"
    Card(shape=RectangleShape,modifier=Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
        Text(t("Schritte im Zeitverlauf"),style=MaterialTheme.typography.titleMedium)
        Row(horizontalArrangement=Arrangement.spacedBy(6.dp)) {
            listOf(StepPeriod.DAILY to "Täglich",StepPeriod.WEEKLY to "Wöchentlich",StepPeriod.MONTHLY to "Monatlich").forEach { (value,label) ->
                OutlinedButton(onClick={period=value;selected=null},shape=RectangleShape,contentPadding=PaddingValues(9.dp),colors=ButtonDefaults.outlinedButtonColors(containerColor=if(period==value) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface)) { Text(t(label),fontSize=11.sp) }
            }
        }
        Text(if(buckets.any { it.steps!=null }) number.format(buckets.sumOf { it.steps ?: 0L })+" "+t("Schritte") else "— "+t("Schritte"),style=MaterialTheme.typography.titleLarge)
        Text(t(when(period) {StepPeriod.DAILY->"Letzte 14 Tage";StepPeriod.WEEKLY->"Letzte 8 Wochen";StepPeriod.MONTHLY->"Letzte 12 Monate"}),style=MaterialTheme.typography.labelSmall)
        Row(Modifier.fillMaxWidth().height(160.dp),horizontalArrangement=Arrangement.spacedBy(4.dp),verticalAlignment=Alignment.Bottom) {
            buckets.forEachIndexed { index,bucket ->
                Column(Modifier.weight(1f).fillMaxHeight().clickable { selected=index }.semantics(mergeDescendants=true) { contentDescription=describe(bucket) },verticalArrangement=Arrangement.Bottom,horizontalAlignment=Alignment.CenterHorizontally) {
                    Box(Modifier.weight(1f).fillMaxWidth(),contentAlignment=Alignment.BottomCenter) {
                        if(bucket.steps==null) Text("—",color=MaterialTheme.colorScheme.onSurfaceVariant,fontSize=9.sp)
                        else Box(Modifier.fillMaxWidth().height((bucket.steps.toFloat()/maximum*126).dp).background(MaterialTheme.colorScheme.primary))
                    }
                    Text(if(index%2==0) if(period==StepPeriod.MONTHLY) bucket.start.format(DateTimeFormatter.ofPattern("MMM",locale)) else bucket.start.dayOfMonth.toString() else " ",fontSize=8.sp,maxLines=1)
                }
            }
        }
        Text(selected?.let { describe(buckets[it]) } ?: t(if(buckets.any { it.steps!=null }) "Nur vorhandene Messwerte werden summiert. Fehlende Tage werden nicht als null Schritte gewertet." else "Noch keine Schritte synchronisiert."),style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
    } }
}
