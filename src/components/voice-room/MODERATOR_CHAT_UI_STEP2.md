# Step 2 — Moderator Chat Moderation UI

The reusable `ModeratorChatModeration` component was added in this branch. It loads room messages, listens for realtime inserts/updates/deletes, and invokes the server-side `moderate_delete_room_message` RPC for removal. Server authorization remains authoritative.

Integration into the main room panel must use the existing room chat message schema/component rather than assuming column names that are not present in the current generated Supabase types.
