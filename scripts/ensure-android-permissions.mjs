import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve("android/app/src/main/AndroidManifest.xml");

if (!existsSync(manifestPath)) {
  console.warn("AndroidManifest.xml not found; run npx cap add android first.");
  process.exit(0);
}

let xml = readFileSync(manifestPath, "utf8");
xml = xml.replace(/\s*<uses-permission android:name="android\.permission\.CAMERA"\s*\/\>/g, "");

const permissions = [
  "android.permission.RECORD_AUDIO",
  "android.permission.MODIFY_AUDIO_SETTINGS",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
];

const missing = permissions.filter(
  (permission) => !xml.includes(`android:name="${permission}"`),
);

const declarations = missing
  .map((permission) => `    <uses-permission android:name="${permission}" />`)
  .join("\n");

const applicationIndex = xml.indexOf("<application");
if (applicationIndex === -1) {
  throw new Error("Could not find <application> in AndroidManifest.xml");
}

const fcmChannelMeta =
  '    <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="jalwa_default" />';

if (!xml.includes("com.google.firebase.messaging.default_notification_channel_id")) {
  const closeIndex = xml.indexOf(">", applicationIndex);
  if (closeIndex === -1) throw new Error("Could not parse <application> in AndroidManifest.xml");
  xml = xml.slice(0, closeIndex + 1) + "\n" + fcmChannelMeta + xml.slice(closeIndex + 1);
}

if (!xml.includes(".JalwaForegroundService")) {
  const serviceXml = `    <service
      android:name=".JalwaForegroundService"
      android:enabled="true"
      android:exported="false"
      android:foregroundServiceType="dataSync"
      android:stopWithTask="false" />
`;
  xml = xml.replace("</application>", serviceXml + "  </application>");
}

xml = xml.slice(0, applicationIndex) + declarations + "\n" + xml.slice(applicationIndex);
writeFileSync(manifestPath, xml);

const javaDir = resolve("android/app/src/main/java/app/lovable/jalwa");
mkdirSync(javaDir, { recursive: true });
const servicePath = resolve(javaDir, "JalwaForegroundService.java");

if (!existsSync(servicePath)) {
  writeFileSync(servicePath, `package app.lovable.jalwa;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

public final class JalwaForegroundService extends Service {
    private static final String CHANNEL_ID = "jalwa_background";

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        startForeground(1001, buildNotification());
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Jalwa Background Service",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Keeps Jalwa background connectivity available.");
            channel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification() {
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);
        return builder
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle("Jalwa")
            .setContentText("Background notification service is active")
            .setOngoing(true)
            .setShowWhen(false)
            .build();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
`);
}

const activityCandidates = [
  resolve("android/app/src/main/java/app/lovable/jalwa/MainActivity.java"),
  resolve("android/app/src/main/java/app/lovable/jalwa/MainActivity.kt"),
];

for (const activityPath of activityCandidates) {
  if (!existsSync(activityPath)) continue;
  let activity = readFileSync(activityPath, "utf8");
  if (activityPath.endsWith(".java")) {
    if (!activity.includes("import android.content.Intent;")) {
      activity = activity.replace(/^package [^;]+;\s*/m, (m) => m + "\nimport android.content.Intent;\n");
    }
    if (!activity.includes("JalwaForegroundService")) {
      const marker = "super.onCreate(savedInstanceState);";
      const start =
        'if (android.os.Build.VERSION.SDK_INT >= 26) { startForegroundService(new Intent(this, JalwaForegroundService.class)); } else { startService(new Intent(this, JalwaForegroundService.class)); }';
      activity = activity.includes(marker)
        ? activity.replace(marker, marker + "\n        " + start)
        : activity.replace("{", "{\n        " + start, 1);
    }
  } else {
    if (!activity.includes("import android.content.Intent")) {
      activity = activity.replace(/^package [^\n]+\n/m, (m) => m + "\nimport android.content.Intent\n");
    }
    if (!activity.includes("JalwaForegroundService")) {
      const marker = "super.onCreate(savedInstanceState)";
      const start =
        'if (android.os.Build.VERSION.SDK_INT >= 26) { startForegroundService(Intent(this, JalwaForegroundService::class.java)) } else { startService(Intent(this, JalwaForegroundService::class.java)) }';
      activity = activity.includes(marker)
        ? activity.replace(marker, marker + "\n        " + start)
        : activity.replace("{", "{\n        " + start, 1);
    }
  }
  writeFileSync(activityPath, activity);
}

console.log("✓ Jalwa Android foreground service configured.");
