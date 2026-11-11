package de.monopol.everything

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.*
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.request.*
import androidx.health.connect.client.time.TimeRangeFilter
import org.json.JSONObject
import org.json.JSONArray
import java.time.*
import kotlin.reflect.KClass
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers

/** Per-type changes cursors are committed only after acknowledged reconciliation. */
class HealthImporter(context:Context) {
    private val store=Store(context)
    private val client=HealthConnectClient.getOrCreate(context)
    companion object {
        private val mutex=Mutex()
        val types:Map<String,KClass<out Record>> = linkedMapOf(
            "steps" to StepsRecord::class,"sleep_minutes" to SleepSessionRecord::class,
            "resting_pulse" to RestingHeartRateRecord::class,"weight_kg" to WeightRecord::class,
            "heart_rate" to HeartRateRecord::class,"hrv_ms" to HeartRateVariabilityRmssdRecord::class,
            "oxygen_pct" to OxygenSaturationRecord::class,"respiratory_rate" to RespiratoryRateRecord::class,
            "distance_m" to DistanceRecord::class,"active_kcal" to ActiveCaloriesBurnedRecord::class,
            "total_kcal" to TotalCaloriesBurnedRecord::class,"exercise_minutes" to ExerciseSessionRecord::class)
    }
    @Suppress("UNCHECKED_CAST")
    private suspend fun records(type:KClass<out Record>,filter:TimeRangeFilter):List<Record> {
        val result=mutableListOf<Record>();var page:String?=null
        do {val response=client.readRecords(ReadRecordsRequest(type as KClass<Record>,filter,pageToken=page));result.addAll(response.records);page=response.pageToken?.takeIf{it.isNotEmpty()}}while(page!=null)
        return result
    }
    private fun timestamp(r:Record):Instant = when(r){
        is StepsRecord -> r.endTime.minusNanos(1)
        is SleepSessionRecord -> r.endTime.minusNanos(1)
        is DistanceRecord -> r.endTime.minusNanos(1)
        is ActiveCaloriesBurnedRecord -> r.endTime.minusNanos(1)
        is TotalCaloriesBurnedRecord -> r.endTime.minusNanos(1)
        is ExerciseSessionRecord -> r.endTime.minusNanos(1)
        else -> Instant.EPOCH
    }
    private fun values(r:Record):List<Pair<Instant,Double>> = when(r){
        is HeartRateRecord -> r.samples.map{it.time to it.beatsPerMinute.toDouble()}
        is HeartRateVariabilityRmssdRecord -> listOf(r.time to r.heartRateVariabilityMillis)
        is OxygenSaturationRecord -> listOf(r.time to r.percentage.value)
        is RespiratoryRateRecord -> listOf(r.time to r.rate)
        is RestingHeartRateRecord -> listOf(r.time to r.beatsPerMinute.toDouble())
        is WeightRecord -> listOf(r.time to r.weight.inKilograms)
        is ExerciseSessionRecord -> listOf(r.endTime.minusNanos(1) to Duration.between(r.startTime,r.endTime).toMillis()/60000.0)
        else -> emptyList()
    }
    suspend fun sync()=withContext(Dispatchers.IO){mutex.withLock {
        val api=Api(store);val granted=client.permissionController.getGrantedPermissions()
        val generation=JSONObject(api.call("/health/metrics")).optString("generation","0")
        if(store.get("healthGeneration")!=generation){for(metric in types.keys){store.remove("healthCursor-$metric");store.remove("healthStatus-$metric");store.remove("healthSources-$metric")};store.put("healthGeneration",generation)}
        suspend fun upload(payload:JSONObject)=api.call("/health/sync","PUT",payload.put("generation",generation))
        val today=LocalDate.now(ZoneId.of("Europe/Berlin"));val zone=ZoneId.of("Europe/Berlin")
        val dayValues=mutableMapOf<String,JSONObject>()
        var anyError=false
        for((metric,type) in types) {
            val status=JSONObject().put("permission",HealthPermission.getReadPermission(type) in granted)
            if(HealthPermission.getReadPermission(type) !in granted){
                upload(JSONObject().put("status",JSONObject().put(metric,status.put("state","denied"))))
                continue
            }
            try {
                val cursorKey="healthCursor-$metric";var cursor=store.get(cursorKey);var full=cursor.isBlank()
                // Reserve before initial read so writes made during backfill are not missed.
                if(full)cursor=client.getChangesToken(ChangesTokenRequest(setOf(type)))
                else {
                    var more:Boolean
                    do {val changes=client.getChanges(cursor);if(changes.changesTokenExpired){full=true;cursor=client.getChangesToken(ChangesTokenRequest(setOf(type)));break};if(changes.changes.isNotEmpty())full=true;cursor=changes.nextChangesToken;more=changes.hasMore}while(more)
                }
                if(store.get("healthEarliest-$metric").isBlank())store.put("healthEarliest-$metric",today.minusDays(29).toString())
                val earliest=maxOf(today.minusDays(89),LocalDate.parse(store.get("healthEarliest-$metric")))
                val previousSources=store.get("healthSources-$metric").split('|').filter{it.isNotBlank()}.toMutableSet()
                val sourceSet=mutableSetOf<String>();var latest:Instant?=null
                // Reconcile a rolling window on changes, otherwise refresh today's evolving values.
                for(offset in (if(full)java.time.temporal.ChronoUnit.DAYS.between(earliest,today).toInt() else 0) downTo 0){
                    val day=today.minusDays(offset.toLong());val start=day.atStartOfDay(zone).toInstant();val end=minOf(day.plusDays(1).atStartOfDay(zone).toInstant(),Instant.now());val filter=TimeRangeFilter.between(start,end)
                    val rec=records(type,if(metric=="sleep_minutes")TimeRangeFilter.between(start.minus(Duration.ofDays(1)),end) else filter)
                    val windows=JSONArray();val samplesBySource=mutableMapOf<String,MutableList<Pair<Instant,Double>>>()
                    val summary=dayValues.getOrPut(day.toString()){JSONObject().put("day",day.toString())}
                    if(metric in setOf("steps","sleep_minutes","distance_m","active_kcal","total_kcal","exercise_minutes")) {
                        val value:Double?=when(metric){
                            "steps"->client.aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL),filter))[StepsRecord.COUNT_TOTAL]?.toDouble()
                            "distance_m"->client.aggregate(AggregateRequest(setOf(DistanceRecord.DISTANCE_TOTAL),filter))[DistanceRecord.DISTANCE_TOTAL]?.inMeters
                            "active_kcal"->client.aggregate(AggregateRequest(setOf(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL),filter))[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories
                            "total_kcal"->client.aggregate(AggregateRequest(setOf(TotalCaloriesBurnedRecord.ENERGY_TOTAL),filter))[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories
                            "exercise_minutes"->client.aggregate(AggregateRequest(setOf(ExerciseSessionRecord.EXERCISE_DURATION_TOTAL),filter))[ExerciseSessionRecord.EXERCISE_DURATION_TOTAL]?.toMillis()?.div(60000.0)
                            else->{val sessions=rec.filterIsInstance<SleepSessionRecord>().filter{it.endTime.atZone(zone).toLocalDate()==day};var total:Double?=null;for((from,to)in mergeIntervals(sessions.map{it.startTime to it.endTime})){client.aggregate(AggregateRequest(setOf(SleepSessionRecord.SLEEP_DURATION_TOTAL),TimeRangeFilter.between(from,to)))[SleepSessionRecord.SLEEP_DURATION_TOTAL]?.let{total=(total?:0.0)+it.toMillis()/60000.0}};total?.coerceAtMost(1440.0)}
                        }
                        summary.put(metric,value?:JSONObject.NULL)
                        samplesBySource["health_connect"]=if(value==null)mutableListOf() else mutableListOf(end.minusMillis(1) to value)
                        for(r in rec){sourceSet.add(r.metadata.dataOrigin.packageName);val ts=timestamp(r);if(latest==null||ts>latest)latest=ts}
                    } else {
                        for(r in rec){val src=r.metadata.dataOrigin.packageName;sourceSet.add(src);for(p in values(r).filter{it.first>=start&&it.first<end}){samplesBySource.getOrPut(src){mutableListOf()}.add(p);if(latest==null||p.first>latest)latest=p.first}}
                        val chosen=samplesBySource.keys.sorted().firstOrNull();val vals=chosen?.let{samplesBySource[it]}?:emptyList()
                        summary.put(metric,if(vals.isEmpty())JSONObject.NULL else if(metric=="weight_kg")vals.maxBy{it.first}.second else vals.map{it.second}.average())
                        if(metric=="weight_kg")summary.put("weight_at",if(vals.isEmpty())JSONObject.NULL else vals.maxBy{it.first}.first.toString())
                        if(metric=="heart_rate"){summary.put("heart_rate_min",vals.minOfOrNull{it.second}?:JSONObject.NULL);summary.put("heart_rate_max",vals.maxOfOrNull{it.second}?:JSONObject.NULL);summary.put("heart_rate_last",vals.maxByOrNull{it.first}?.second?:JSONObject.NULL);summary.put("heart_rate_at",vals.maxByOrNull{it.first}?.first?.toString()?:JSONObject.NULL)}
                    }
                    previousSources.addAll(samplesBySource.keys)
                    // Remember discovered sources before upload, including interrupted backfills.
                    store.put("healthSources-$metric",previousSources.joinToString("|"))
                    val allSources=previousSources.toSet()
                    val training=rec.filterIsInstance<ExerciseSessionRecord>().map{r->when(r.exerciseType){ExerciseSessionRecord.EXERCISE_TYPE_RUNNING->"Running";ExerciseSessionRecord.EXERCISE_TYPE_WALKING->"Walking";ExerciseSessionRecord.EXERCISE_TYPE_BIKING->"Cycling";ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING->"Strength training";ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL->"Swimming";else->"Exercise ${r.exerciseType}"}}.distinct().joinToString(", ").take(100)
                    for(src in allSources){val list=samplesBySource[src]?:emptyList();val samples=JSONArray();list.distinctBy{it.first}.sortedBy{it.first}.forEach{(at,value)->val sample=JSONObject().put("at",at.toString()).put("value",value);if(metric=="exercise_minutes"&&training.isNotBlank())sample.put("label",training);samples.put(sample)};windows.put(JSONObject().put("day",day.toString()).put("metric",metric).put("source",src).put("samples",samples))}
                    for(i in 0 until windows.length())upload(JSONObject().put("windows",JSONArray().put(windows.getJSONObject(i))))
                }
                // Persist day summaries before advancing the cursor. Retried windows are idempotent.
                val days=JSONArray(dayValues.values.toList());upload(JSONObject().put("days",days))
                val oldStatus=runCatching{JSONObject(store.get("healthStatus-$metric"))}.getOrDefault(JSONObject())
                if(!full&&latest==null){oldStatus.optString("last_measurement").takeIf{it.isNotBlank()&&it!="null"}?.let{latest=Instant.parse(it)}}
                val sources=if(full)sourceSet else (sourceSet+oldStatus.optJSONArray("sources").let{a->(0 until (a?.length()?:0)).map{a!!.getString(it)}})
                status.put("state",if(latest!=null)"ok" else "no_data").put("sources",JSONArray(sources.toList())).put("last_measurement",latest?.toString()?:JSONObject.NULL)
                upload(JSONObject().put("status",JSONObject().put(metric,status)))
                store.put("healthSources-$metric",(previousSources+sourceSet+setOf("health_connect")).joinToString("|"));store.put("healthStatus-$metric",status.toString());store.put(cursorKey,cursor)
            }catch(e:Exception){
                if(e is kotlinx.coroutines.CancellationException)throw e
                store.remove("healthCursor-$metric")
                anyError=true
                upload(JSONObject().put("status",JSONObject().put(metric,status.put("state","error"))))
            }
        }
        if(anyError)throw IllegalStateException("Some health metrics could not be synced. Other metrics remain available.")
        store.put("healthLastSync",Instant.now().toString())
    }}
}
