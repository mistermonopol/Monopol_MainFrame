package de.monopol.everything

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.work.*
import org.json.JSONArray
import org.json.JSONObject
import java.time.*
import java.util.concurrent.TimeUnit

class HealthSync(private val context: Context) {
    companion object {
        val permissions = setOf(HealthPermission.getReadPermission(StepsRecord::class), HealthPermission.getReadPermission(SleepSessionRecord::class), HealthPermission.getReadPermission(RestingHeartRateRecord::class), HealthPermission.getReadPermission(WeightRecord::class))
        const val BACKGROUND = "android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND"
        fun schedule(context: Context) {
            WorkManager.getInstance(context).enqueueUniquePeriodicWork("health", ExistingPeriodicWorkPolicy.UPDATE,
                PeriodicWorkRequestBuilder<HealthWorker>(1, TimeUnit.HOURS).setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build())
        }
    }
    private val client get() = HealthConnectClient.getOrCreate(context)
    fun backgroundAvailable() = client.features.getFeatureStatus(HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND) == HealthConnectFeatures.FEATURE_STATUS_AVAILABLE
    suspend fun granted() = client.permissionController.getGrantedPermissions()
    suspend fun sync(background: Boolean = false) {
        val store = Store(context)
        if (store.get("syncEnabled") != "true") return
        val granted = granted()
        if (background && BACKGROUND !in granted) return
        if (permissions.intersect(granted).isEmpty()) return
        val zone = ZoneId.of("Europe/Berlin")
        val today = LocalDate.now(zone)
        val days = JSONArray()
        for (offset in 29 downTo 0) {
            val day = today.minusDays(offset.toLong())
            val start = day.atStartOfDay(zone).toInstant()
            val end = minOf(day.plusDays(1).atStartOfDay(zone).toInstant(), Instant.now())
            val filter = TimeRangeFilter.between(start, end)
            val json = JSONObject().put("day", day.toString())
            if (HealthPermission.getReadPermission(StepsRecord::class) in granted) {
                val result = client.aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL), filter))
                json.put("steps", result[StepsRecord.COUNT_TOTAL] ?: JSONObject.NULL)
            }
            if (HealthPermission.getReadPermission(SleepSessionRecord::class) in granted) {
                // Only sessions ending on this Berlin day; merge intervals before summing.
                val records = mutableListOf<SleepSessionRecord>()
                var page: String? = null
                do {
                    val response = client.readRecords(ReadRecordsRequest(SleepSessionRecord::class, TimeRangeFilter.between(start.minus(Duration.ofDays(1)), end), pageToken = page))
                    records.addAll(response.records.filter { it.endTime.atZone(zone).toLocalDate() == day })
                    page = response.pageToken?.takeIf { it.isNotEmpty() }
                } while (page != null)
                // Aggregate the disjoint selected windows through Health Connect (source priorities apply).
                val windows = mergeIntervals(records.map { it.startTime to it.endTime })
                var minutes = 0.0
                var found = false
                for ((from, to) in windows) {
                    val result = client.aggregate(AggregateRequest(setOf(SleepSessionRecord.SLEEP_DURATION_TOTAL), TimeRangeFilter.between(from, to)))
                    result[SleepSessionRecord.SLEEP_DURATION_TOTAL]?.let { minutes += it.toMillis() / 60000.0; found = true }
                }
                json.put("sleep_minutes", if (found) minOf(minutes, 1440.0) else JSONObject.NULL)
            }
            if (HealthPermission.getReadPermission(RestingHeartRateRecord::class) in granted) {
                val values = mutableListOf<Long>()
                var page: String? = null
                do {
                    val response = client.readRecords(ReadRecordsRequest(RestingHeartRateRecord::class, filter, pageToken = page))
                    values.addAll(response.records.map { it.beatsPerMinute })
                    page = response.pageToken?.takeIf { it.isNotEmpty() }
                } while (page != null)
                json.put("resting_pulse", if (values.isEmpty()) JSONObject.NULL else values.average())
            }
            if (HealthPermission.getReadPermission(WeightRecord::class) in granted) {
                var latest: WeightRecord? = null
                var page: String? = null
                do {
                    val response = client.readRecords(ReadRecordsRequest(WeightRecord::class, filter, pageToken = page))
                    response.records.forEach { if (latest == null || it.time > latest!!.time) latest = it }
                    page = response.pageToken?.takeIf { it.isNotEmpty() }
                } while (page != null)
                json.put("weight_kg", latest?.weight?.inKilograms ?: JSONObject.NULL)
                json.put("weight_at", latest?.time?.toString() ?: JSONObject.NULL)
            }
            days.put(json)
        }
        Api(store).call("/health/days", "PUT", JSONObject().put("days", days))
        store.put("healthLastSync", Instant.now().toString())
    }
}

fun mergeIntervals(intervals: List<Pair<Instant, Instant>>): List<Pair<Instant, Instant>> {
    val result = mutableListOf<Pair<Instant, Instant>>()
    for (interval in intervals.sortedBy { it.first }) {
        val last = result.lastOrNull()
        if (last != null && interval.first <= last.second) result[result.lastIndex] = last.first to maxOf(last.second, interval.second)
        else result.add(interval)
    }
    return result
}

class HealthWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = try {
        HealthSync(applicationContext).sync(background = true)
        Result.success()
    } catch (_: SecurityException) { Result.success() }
      catch (_: Exception) { if (runAttemptCount < 3) Result.retry() else Result.failure() }
}
