# Android Push Build

The repository intentionally keeps generated Capacitor Android files out of `main`, but push notifications require a real native Android project. This workflow generates a fresh Capacitor 8 Android project, restores Jalwa's Firebase config, applies Android location and notification permissions/channel, and builds a debug APK.

## Local build

```bash
npm install
npm run build
node scripts/bootstrap-android.mjs
# This step adds ACCESS_COARSE_LOCATION, ACCESS_FINE_LOCATION,
# and POST_NOTIFICATIONS to the generated Android manifest.
cd android
./gradlew assembleDebug
```

On Windows PowerShell:

```powershell
npm install
npm run build
node scripts/bootstrap-android.mjs
cd android
.gradlew.bat assembleDebug
```

The generated APK is:

`android/app/build/outputs/apk/debug/app-debug.apk`

## Closed-app notification requirement

Install the newly generated APK on the physical Android device and grant notification permission. The Capacitor Push Notifications plugin uses Firebase Cloud Messaging on Android; the app-level `google-services.json` and Google Services Gradle plugin are part of the generated native project. Android 13+ also requires the notification runtime permission.

Do not test this using the web browser/PWA and do not reuse an old APK. A newly generated native APK is required after native Firebase/notification changes.

The workflow also produces the debug APK as a GitHub Actions artifact.

## Scope protection

This change only bootstraps the missing native Android platform and notification build path. It does not modify LiveKit token/room APIs, VoiceRoom seat logic, or the VoiceRoom DP frame.
