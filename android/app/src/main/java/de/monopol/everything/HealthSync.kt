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
        val permissions = HealthImporter.types.values.map { HealthPermission.getReadPermission(it) }.toSet()
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
        HealthImporter(context).sync()
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
