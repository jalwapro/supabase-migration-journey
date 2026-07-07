# Native App (Capacitor) — Jalwa

Jalwa is a mobile-first web app (TanStack Start) wrapped as a native Android/iOS app using **Capacitor 8**. This gives you a real APK / IPA that ships on Play Store and App Store while reusing 100% of the web codebase.

## How it works

- The web app runs on Lovable Cloud (SSR).
- `capacitor.config.ts` points the native shell at the **published web URL**, so updates you make in Lovable ship to users instantly — no store re-review needed for content/UI changes.
- Only *native* changes (icons, splash, plugins, permissions) require a new APK/IPA.

## One-time setup (on your local machine)

Requirements:
- **Android:** Android Studio + JDK 21
- **iOS:** macOS with Xcode 15+

```bash
# 1. Clone your Lovable project locally (Github → Clone)
git clone <your-repo> && cd <your-repo>
bun install

# 2. Build the web fallback bundle
bun run build

# 3. Add native platforms
npx cap add android
npx cap add ios          # macOS only

# 4. Sync web assets + config into native projects
npx cap sync
```

## Development loop

Every time you change `capacitor.config.ts`, add a plugin, or update the web app:

```bash
bun run build
npx cap sync
```

Then open the native project:

```bash
npx cap open android     # launches Android Studio
npx cap open ios         # launches Xcode
```

Run on device from Android Studio / Xcode. The app loads your published Lovable URL, so any content change you publish appears on next launch.

## Configuration

Edit `capacitor.config.ts`:

- `server.url` — the published Lovable URL. **Update this to your custom domain** once you have one.
- `appId` — reverse-domain package id (e.g. `com.yourcompany.jalwa`). **Set this before your first store submission — you cannot change it later.**
- `appName` — display name under the icon.

## App icons & splash screen

Place a 1024×1024 PNG at `resources/icon.png` and 2732×2732 PNG at `resources/splash.png`, then:

```bash
bunx @capacitor/assets generate --iconBackgroundColor "#1a0d2e" --splashBackgroundColor "#1a0d2e"
```

## Store submission

- **Android:** In Android Studio → *Build → Generate Signed Bundle → AAB*. Upload to Play Console.
- **iOS:** In Xcode → *Product → Archive → Distribute App*. Upload to App Store Connect.

Update version in `android/app/build.gradle` (`versionCode`, `versionName`) and `ios/App/App.xcodeproj` before each release.

## Permissions to declare

The app uses the microphone (Agora voice rooms) and network. Add to:

- `android/app/src/main/AndroidManifest.xml`:
  ```xml
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.RECORD_AUDIO" />
  <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
  ```
- `ios/App/App/Info.plist`:
  ```xml
  <key>NSMicrophoneUsageDescription</key>
  <string>Jalwa needs microphone access for live voice rooms.</string>
  ```

## Troubleshooting

- **White screen on launch:** check `server.url` is reachable from the device, and the URL is HTTPS.
- **Mic doesn't work:** confirm permissions above are declared and granted in device settings.
- **Old content:** the WebView caches; pull-to-refresh or reinstall to force reload.
