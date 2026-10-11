import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const manifestPath = resolve(root, "android/app/src/main/AndroidManifest.xml");
const appGradlePaths = [
  resolve(root, "android/app/build.gradle"),
  resolve(root, "android/app/build.gradle.kts"),
];

if (!existsSync(manifestPath)) {
  console.warn("AndroidManifest.xml not found; run npx cap add android first.");
  process.exit(0);
}

let xml = readFileSync(manifestPath, "utf8");
// Jalwa is an audio/chat app. Remove any stale camera permission left by a prior template.
xml = xml.replace(/\s*<uses-permission android:name="android\.permission\.CAMERA"\s*\/\s*>/g, "");

const permissions = [
  "android.permission.RECORD_AUDIO",
  "android.permission.MODIFY_AUDIO_SETTINGS",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_MICROPHONE",
];
const missing = permissions.filter((permission) => !xml.includes(`android:name="${permission}"`));
if (missing.length) {
  const declarations = missing.map((permission) => `    <uses-permission android:name="${permission}" />`).join("\n");
  const applicationIndex = xml.indexOf("<application");
  if (applicationIndex < 0) throw new Error("Could not find <application> in AndroidManifest.xml");
  xml = xml.slice(0, applicationIndex) + declarations + "\n" + xml.slice(applicationIndex);
}

const applicationIndex = xml.indexOf("<application");
if (applicationIndex < 0) throw new Error("Could not find <application> in AndroidManifest.xml");
const appOpenEnd = xml.indexOf(">", applicationIndex);
if (appOpenEnd < 0) throw new Error("Could not parse <application> in AndroidManifest.xml");

const fcmChannelMeta =
  '    <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="jalwa_default" />';
if (!xml.includes("com.google.firebase.messaging.default_notification_channel_id")) {
  xml = xml.slice(0, appOpenEnd + 1) + "\n" + fcmChannelMeta + xml.slice(appOpenEnd + 1);
}

const serviceDeclaration = [
  '        <service',
  '            android:name=".MicrophoneForegroundService"',
  '            android:enabled="true"',
  '            android:exported="false"',
  '            android:stopWithTask="false"',
  '            android:foregroundServiceType="microphone" />',
].join("\n");
if (!xml.includes("android:name=\".MicrophoneForegroundService\"")) {
  const appClose = xml.lastIndexOf("</application>");
  if (appClose < 0) throw new Error("Could not find </application> in AndroidManifest.xml");
  xml = xml.slice(0, appClose) + serviceDeclaration + "\n    " + xml.slice(appClose);
}
writeFileSync(manifestPath, xml);

// Generated Capacitor Android projects are not committed in this repository.
// Create the native service/plugin after cap sync so every Android build gets it.
const gradlePath = appGradlePaths.find(existsSync);
const gradleText = gradlePath ? readFileSync(gradlePath, "utf8") : "";
const namespace = gradleText.match(/namespace\s*(?:=\s*)?["']([^"']+)["']/)?.[1] || "app.lovable.jalwa";
const packageDir = resolve(root, "android/app/src/main/java", ...namespace.split("."));
mkdirSync(packageDir, { recursive: true });

const serviceSource = `package ${namespace};

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

public class MicrophoneForegroundService extends Service {
    private static final String CHANNEL_ID = "jalwa_voice_room";
    private static final int NOTIFICATION_ID = 7814;

    @Override
    public void onCreate() {
        super.onCreate();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Jalwa voice room", NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Keeps an active Jalwa voice room connected while minimized.");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            notification = new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("Jalwa voice room active")
                .setContentText("Your voice room can continue while Jalwa is minimized.")
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setOngoing(true)
                .build();
        } else {
            notification = new Notification.Builder(this)
                .setContentTitle("Jalwa voice room active")
                .setContentText("Your voice room is active.")
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setOngoing(true)
                .build();
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        stopForeground(true);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
`;
writeFileSync(resolve(packageDir, "MicrophoneForegroundService.java"), serviceSource);

const pluginSource = `package ${namespace};

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MicrophoneForegroundService")
public class MicrophoneForegroundServicePlugin extends Plugin {
    @PluginMethod
    public void start(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), MicrophoneForegroundService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(intent);
            else getContext().startService(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Unable to start microphone foreground service", error);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            getContext().stopService(new Intent(getContext(), MicrophoneForegroundService.class));
            call.resolve();
        } catch (Exception error) {
            call.reject("Unable to stop microphone foreground service", error);
        }
    }
}
`;
writeFileSync(resolve(packageDir, "MicrophoneForegroundServicePlugin.java"), pluginSource);

const mainActivityPath = resolve(packageDir, "MainActivity.java");
if (existsSync(mainActivityPath)) {
  let mainActivity = readFileSync(mainActivityPath, "utf8");
  if (!mainActivity.includes("MicrophoneForegroundServicePlugin.class")) {
    const classOpen = mainActivity.indexOf("{");
    if (classOpen < 0) throw new Error("Could not parse generated MainActivity.java");
    const onCreate = /public\s+void\s+onCreate\s*\(\s*Bundle\s+savedInstanceState\s*\)\s*\{/.exec(mainActivity);
    if (onCreate) {
      const insertion = onCreate.index + onCreate[0].length;
      mainActivity = mainActivity.slice(0, insertion) + "\n        registerPlugin(MicrophoneForegroundServicePlugin.class);" + mainActivity.slice(insertion);
    } else {
      if (!mainActivity.includes("import android.os.Bundle;")) mainActivity = mainActivity.replace(/(package [^;]+;\s*)/, "$1\nimport android.os.Bundle;\n");
      const brace = mainActivity.indexOf("{");
      mainActivity = mainActivity.slice(0, brace + 1) +
        "\n    @Override\n    public void onCreate(Bundle savedInstanceState) {\n        registerPlugin(MicrophoneForegroundServicePlugin.class);\n        super.onCreate(savedInstanceState);\n    }\n" +
        mainActivity.slice(brace + 1);
    }
    writeFileSync(mainActivityPath, mainActivity);
  }
} else {
  console.warn("MainActivity.java not found in expected namespace path; generated microphone plugin may need registration in the project's MainActivity.");
}

console.log("✓ Android microphone, notification, location and foreground-service permissions configured.");
console.log("✓ Generated the Android microphone foreground service and Capacitor bridge plugin.");
