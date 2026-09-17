import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "src/components/voice-room/VoiceRoomScreen.tsx");
const source = fs.readFileSync(file, "utf8");

const broken = `useEffect(() => { let active = true; void supabase.from("room_messages").select("id,user_id,kind,text,message,created_at,sender_username,sender_avatar").eq("room_id", roomId).order("created_at", { ascending: true }).limit(50).then(({ data }) => { if (active && data) setRoomMessages(data as RoomChatMessage[]); }); return () => { active = false; }; }, [roomId]);`;

const fixed = `useEffect(() => { let active = true; void supabase.from("room_messages").select("id,user_id,kind,text,message,created_at,sender_username,sender_avatar").eq("room_id", roomId).order("created_at", { ascending: true }).limit(50).then(({ data }) => { if (!active || !data) return; setRoomMessages(prev => { const map = new Map<string, RoomChatMessage>(); for (const row of data as RoomChatMessage[]) map.set(row.id, row); for (const row of prev) { if (row.pending || row.failed || !map.has(row.id)) map.set(row.id, row); } return Array.from(map.values()).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).slice(-50); }); }); return () => { active = false; }; }, [roomId]);`;

if (source.includes(fixed)) process.exit(0);
if (!source.includes(broken)) {
  console.error("[voice-chat-fix] expected history effect not found; source may already be changed.");
  process.exit(0);
}
fs.writeFileSync(file, source.replace(broken, fixed));
console.log("[voice-chat-fix] preserved optimistic/realtime room messages during history hydration.");
