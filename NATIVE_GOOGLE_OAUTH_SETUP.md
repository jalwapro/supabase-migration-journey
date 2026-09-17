# Jalwa Native Google OAuth Callback

The web app now uses the custom native redirect URI:

`app.lovable.jalwa://auth/callback`

## Supabase

In Supabase Dashboard → Authentication → URL Configuration, add this exact Redirect URL:

`app.lovable.jalwa://auth/callback`

Keep the production web URL in the allow list as well:

`https://www.jalwa.pro/`

## Google Cloud

For the Google OAuth provider, the Google Authorized redirect URI remains the Supabase callback endpoint, not the native scheme:

`https://vfuiqjxgyptjqhbmzigk.supabase.co/auth/v1/callback`

The native custom scheme is the post-login `redirectTo` handled by Supabase.

## Android Studio

The generated Capacitor Android project must register the custom scheme. In `android/app/src/main/AndroidManifest.xml`, add this intent filter inside the app's `MainActivity` activity:

```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="app.lovable.jalwa" android:host="auth" android:path="/callback" />
</intent-filter>
```

Do not remove the existing Capacitor launcher intent filter.

Then run:

```bash
npx cap sync android
```

Build/install the Android app again. Google login should return from Chrome to the Jalwa app instead of staying in the browser.

## iOS

Register the same URL scheme `app.lovable.jalwa` in the iOS target's URL Types (Xcode → Target → Info → URL Types), then sync/rebuild with:

```bash
npx cap sync ios
```

The app already listens for Capacitor `appUrlOpen` and exchanges the Supabase authorization code for a session.

## Important

The GitHub repository does not contain generated `android/` or `ios/` platform folders, so the native intent-filter / URL-Type registration must be applied to the generated Android Studio/Xcode projects. The web-side OAuth handling is committed in `src/routes/auth.tsx`.
