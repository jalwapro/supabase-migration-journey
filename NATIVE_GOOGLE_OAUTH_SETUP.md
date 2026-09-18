# Native Google Sign-In (Jalwa)

Jalwa's Capacitor app now uses a Jalwa-branded login sheet followed by the native Google account picker on Android/iOS. It does not use the old browser OAuth callback for Google on native builds.

## App flow

1. User taps **Continue with Google**.
2. Jalwa opens its own bottom-sheet UI.
3. User taps **Choose Google account**.
4. Android/iOS opens Google's secure native account selector.
5. The selected Google ID token is passed directly to Supabase `signInWithIdToken`.
6. Jalwa receives the Supabase session and returns to the app home screen.

The native Google plugin uses Android Credential Manager / iOS Google Sign-In SDK. The Google account selector itself is intentionally Google-controlled for security and cannot be replaced with a fake account picker. See the official plugin documentation for the native flow. https://capawesome.io/docs/sdks/capacitor/google-sign-in/

## Required build configuration

Set this Vite environment variable in Vercel and in the native build environment:

`VITE_GOOGLE_WEB_CLIENT_ID=<Google Web OAuth Client ID>`

The plugin requires the Web client ID in `GoogleSignIn.initialize()` on Android and iOS.

## Android Google Cloud setup

Create an Android OAuth client in the same Google Cloud project as the Web client:

- Package name: `app.lovable.jalwa`
- SHA-1: debug signing certificate for local builds and Google Play app-signing certificate for Play builds.
- Keep the Web OAuth client ID for `VITE_GOOGLE_WEB_CLIENT_ID`.

A matching Android client + SHA-1 is required or account selection can succeed and sign-in can fail immediately afterward.

## iOS setup

In the generated native iOS project, add the Google iOS client ID as `GIDClientID` in `Info.plist` and add the reversed iOS client ID as the URL scheme.

## Native project sync

The repository currently does not contain generated `android/` or `ios/` folders. On the machine used to build the native app, run:

```bash
npm install
npx cap sync
```

Then build/run the Android or iOS project.

## Security

The app sends Google's ID token to Supabase using `signInWithIdToken`; it does not collect a Google password. Server-side verification is recommended before trusting token claims.

## Web behavior

The public website keeps the existing Supabase OAuth behavior. The native Capacitor app uses the native Google flow, so users do not leave the Jalwa app for a browser-based Google callback.
