# Native Permissions — Android & iOS

## Why "No permissions allowed" shows in App info

Agar app **Chrome se "Add to Home Screen"** karke install ki hai (WebAPK),
toh Android ke `App info → Permissions` me kabhi kuch show nahi hoga —
woh site permissions Chrome ke andar rehti hain
(`Chrome → Settings → Site settings → jalwa.lovable.app`).
Yeh Chrome ki design hai, code fix se solve nahi hota.

**Real Android permissions** chahiye toh **Capacitor native APK** build karna hoga
(see `NATIVE_APP.md`). Yeh permissions add karo:

## Android — `android/app/src/main/AndroidManifest.xml`

`<manifest>` tag ke andar, `<application>` se pehle add karo:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />

<uses-feature android:name="android.hardware.microphone" android:required="false" />
<uses-feature android:name="android.hardware.camera"     android:required="false" />
<uses-feature android:name="android.hardware.location"   android:required="false" />
```

## iOS — `ios/App/App/Info.plist`

`<dict>` ke andar add karo:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Jalwa needs mic access for voice rooms and voice messages.</string>
<key>NSCameraUsageDescription</key>
<string>Jalwa needs camera access for video rooms and profile photos.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Jalwa uses your location for nearby rooms and regional ranks.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Jalwa needs photo access to pick a profile picture.</string>
```

## Rebuild

```bash
bun run build
npx cap sync
npx cap open android   # or: npx cap open ios
```

Phir app run karo — first launch pe Jalwa welcome popup 4 permissions
sequentially maangega, aur Android `App info → Permissions` me sab
Allowed/Denied properly show hongi.
