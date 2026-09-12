# Native App (Capacitor) — Jalwa

Jalwa is a mobile-first web app (TanStack Start) wrapped as a native Android/iOS app using **Capacitor 8**. The native shell loads the production Jalwa web app at **https://www.jalwa.pro** while reusing the web codebase.

## How it works

- The production web app is served from `https://www.jalwa.pro`.
- `capacitor.config.ts` points the native shell at that production URL.
- The native WebView therefore uses the same production frontend and same-origin `/api/*` endpoints, including the LiveKit token endpoint.
- Live voice rooms use **LiveKit audio**, not Agora or ZegoCloud.
- Native-only changes (icons, splash, plugins, permissions) require a new APK/IPA.

## One-time setup (on your local machine)

Requirements:
- **Android:** Android Studio + JDK 21
- **iOS:** macOS with Xcode 15+

```bash
# 1. Clone the GitHub repository locally
git clone <your-repo> && cd <your-repo>
bun install

# 2. Build the web fallback bundle
bun run build

# 3. Add native platforms (only if android/ios do not already exist)
npx cap add android
npx cap add ios          # macOS only

# 4. Sync web assets + Capacitor config/plugins into native projects
npx cap sync
```

> `npx cap sync` updates existing native projects; it does not create a missing Android/iOS platform. Run `npx cap add android` / `npx cap add ios` once when those directories are absent.

## Development loop

After changing `capacitor.config.ts`, adding a Capacitor plugin, or changing the web app:

```bash
bun run build
npx cap sync
```

Then open the native project:

```bash
npx cap open android     # launches Android Studio
npx cap open ios         # launches Xcode
```

Run on a physical device or emulator from Android Studio / Xcode. The native shell loads `https://www.jalwa.pro`.

## Production configuration

`capacitor.config.ts` must use:

```ts
server: {
  url: "https://www.jalwa.pro",
  cleartext: false,
  androidScheme: "https",
}
```

The app should not point at the old `*.lovable.app` deployment as its production WebView origin.

The existing `appId` is `app.lovable.jalwa`. Do not change it casually after distributing the app because changing an Android/iOS application identifier creates a different native application identity.

## LiveKit audio requirements

The web app uses `livekit-client` for LiveKit audio. The native WebView must be able to access the microphone and network.

### Android

In `android/app/src/main/AndroidManifest.xml`, verify:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

If a camera feature is actually shipped in the native app, also verify:

```xml
<uses-permission android:name="android.permission.CAMERA" />
```

The runtime microphone permission must also be granted on the device. `INTERNET` is a normal manifest permission; microphone/camera are runtime permissions.

### iOS

In `ios/App/App/Info.plist`, verify microphone usage text:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Jalwa needs microphone access for live voice rooms.</string>
```

If the shipped native app uses the camera, also add an appropriate `NSCameraUsageDescription` entry.

## Native project status in GitHub

The GitHub repository currently keeps the Capacitor configuration and web code, but generated `android/` and `ios/` platform directories are not part of the repository's `main` branch. Therefore Android `AndroidManifest.xml` and iOS `Info.plist` cannot be verified or modified from GitHub until the native platforms are generated locally and, if desired, committed to the repository.

## Backend/API alignment

The production native shell should call APIs relative to `https://www.jalwa.pro`, for example:

```text
https://www.jalwa.pro/api/livekit-token
```

The LiveKit token flow is server-side: the client sends the authenticated Supabase session to the production API, and the API issues a LiveKit participant token. Do not put LiveKit API secrets in the frontend or native app.

## App icons & splash screen

Place a 1024×1024 PNG at `resources/icon.png` and 2732×2732 PNG at `resources/splash.png`, then:

```bash
bunx @capacitor/assets generate --iconBackgroundColor "#1a0d2e" --splashBackgroundColor "#1a0d2e"
```

## Store submission

- **Android:** In Android Studio → *Build → Generate Signed Bundle → AAB*. Upload to Play Console.
- **iOS:** In Xcode → *Product → Archive → Distribute App*. Upload to App Store Connect.

Update native version/build numbers before each release.

## Troubleshooting

- **White screen on launch:** verify `https://www.jalwa.pro` is reachable from the device and is HTTPS, then run `bun run build` and `npx cap sync`.
- **Mic doesn't work:** verify `RECORD_AUDIO` / `NSMicrophoneUsageDescription` and grant microphone permission on the device.
- **LiveKit does not connect:** verify the production `/api/livekit-token` endpoint, authenticated Supabase session, and LiveKit server URL/environment configuration. Never expose LiveKit secrets to the client.
- **Old content:** rebuild/sync the native project and reinstall the development APK/IPA if the WebView is holding old native assets.
