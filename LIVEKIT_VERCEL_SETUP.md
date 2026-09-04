# LiveKit + Vercel setup

The app now contains a production-oriented LiveKit token endpoint at `/api/livekit-token`, an admin room-management endpoint at `/api/livekit-room`, and a reusable client hook at `src/hooks/useLiveKitVoiceRoom.ts`.

## Vercel environment variables

Set these as **server-side** variables in Vercel:

```text
LIVEKIT_URL=wss://YOUR_LIVEKIT_DOMAIN
LIVEKIT_API_KEY=YOUR_LIVEKIT_API_KEY
LIVEKIT_API_SECRET=YOUR_LIVEKIT_API_SECRET
```

Do **not** prefix the API key or secret with `VITE_`. They must never be exposed to browser JavaScript.

The existing Supabase server variables must also remain configured:

```text
SUPABASE_URL=...
SB_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
```

## Important for the current Oracle deployment

`ws://158.101.242.238:7880` is suitable for a local/development connectivity test, but a Vercel HTTPS app should use a TLS endpoint such as `wss://livekit.example.com`. LiveKit's production self-hosting documentation recommends a domain, trusted SSL certificate, and TLS termination in front of port 7880.

The LiveKit host should also expose the WebRTC ports required by the deployment, normally UDP `50000-60000` and TCP `7881`; if TURN/TLS is enabled, expose its configured port as well.

## Security

The LiveKit API secret must only exist on the server. If a secret has ever been committed to a public repository, chat, issue, screenshot, or client bundle, rotate it in the LiveKit server configuration and update Vercel immediately.

## Existing room model

The token endpoint maps the LiveKit room name to the existing Jalwa `live_rooms.id` and checks `room_members` before granting microphone publishing. Hosts, seated users, and moderators can publish unless their membership is muted; viewers receive subscribe-only access.

## Admin room API

`POST /api/livekit-room` creates a room, `GET /api/livekit-room` lists active rooms, and `DELETE /api/livekit-room?name=<room>` deletes a room. All three require a Supabase-authenticated admin.
