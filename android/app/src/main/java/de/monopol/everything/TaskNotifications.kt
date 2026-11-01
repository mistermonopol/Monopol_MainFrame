package de.monopol.everything

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.*
import org.json.JSONArray
import java.time.Instant
import java.util.concurrent.TimeUnit

object TaskNotifications {
    const val CHANNEL="task-reminders"
    fun schedule(context:Context) {
        WorkManager.getInstance(context).enqueueUniquePeriodicWork("task-reminders",ExistingPeriodicWorkPolicy.UPDATE,
            PeriodicWorkRequestBuilder<TaskReminderWorker>(15,TimeUnit.MINUTES).setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build())
        WorkManager.getInstance(context).enqueueUniqueWork("task-reminders-now",ExistingWorkPolicy.KEEP,
            OneTimeWorkRequestBuilder<TaskReminderWorker>().setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build())
    }
    fun stop(context:Context){WorkManager.getInstance(context).cancelUniqueWork("task-reminders");WorkManager.getInstance(context).cancelUniqueWork("task-reminders-now")}
}

class TaskReminderWorker(context:Context,params:WorkerParameters):CoroutineWorker(context,params) {
    override suspend fun doWork():Result {
        val store=Store(applicationContext)
        if(store.get("taskNotifications")!="true"||store.get("token").isBlank())return Result.success()
        if(applicationContext.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return Result.success()
        val manager=applicationContext.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(TaskNotifications.CHANNEL,"Task reminders",NotificationManager.IMPORTANCE_DEFAULT).apply{description="Monopol_MainFrame task reminders"})
        if(!NotificationManagerCompat.from(applicationContext).areNotificationsEnabled()||manager.getNotificationChannel(TaskNotifications.CHANNEL).importance==NotificationManager.IMPORTANCE_NONE)return Result.success()
        return try {
            val reminders=JSONArray(Api(store).call("/notifications/due"))
            for(i in 0 until reminders.length()){
                val reminder=reminders.getJSONObject(i);val id=reminder.getString("id");val key="task-sent-$id"
                if(store.get(key).isNotBlank())continue
                val intent=Intent(applicationContext,MainActivity::class.java).putExtra("open_tasks",true)
                val pending=PendingIntent.getActivity(applicationContext,id.hashCode(),intent,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
                val notification=NotificationCompat.Builder(applicationContext,TaskNotifications.CHANNEL)
                    .setSmallIcon(R.drawable.ic_task_notification).setContentTitle(Localizer.text("Aufgabe fällig",store.get("language")))
                    .setContentText(reminder.getString("title")).setContentIntent(pending).setAutoCancel(true)
                    .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).build()
                manager.notify(id,id.hashCode(),notification)
                store.put(key,Instant.now().toString())
            }
            Result.success()
        }catch(e:Exception){if(runAttemptCount<3)Result.retry() else Result.failure()}
    }
}
