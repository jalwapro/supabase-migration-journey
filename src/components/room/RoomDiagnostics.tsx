import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  Check,
  ChevronRight,
  Copy,
  Flag,
  Gamepad2,
  Gift,
  Grid2X2,
  Heart,
  Home,
  Mic,
  MicOff,
  MoreHorizontal,
  Power,
  Rocket,
  Send,
  Share2,
  Smile,
  Trophy,
  User as UserIcon,
  Users,
  Volume2,
} from "lucide-react";

type Status = "idle" | "connecting" | "connected" | "error" | "disabled";

const STATUS_COLOR: Record<Status, string> = {
  idle: "bg-white/30",
  connecting: "bg-yellow-400 animate-pulse",
  connected: "bg-green-500",
  error: "bg-red-500",
  disabled: "bg-white/30",
};

type SeatSnapshot = {
  index: number;
  avatar: string | null;
  name: string;
  occupied: boolean;
  muted: boolean;
  likes: string;
};

type Props = {
  roomId: string | null | undefined;
  rtcChannel: string | null | undefined;
  status: Status;
  error?: string | null;
  remotesCount?: number;
  muted?: boolean;
  speakerMuted?: boolean;
};

const SEAT_PLACEMENT: Record<number, string> = {
  0: "ref-host",
  1: "ref-s1",
  2: "ref-s2",
  3: "ref-s3",
  4: "ref-s4",
  5: "ref-s5",
  6: "ref-s6",
  7: "ref-s7",
  8: "ref-s8",
  9: "ref-s9",
  10: "ref-s10",
  11: "ref-s11",
  12: "ref-s12",
  13: "ref-s13",
  14: "ref-s14",
  15: "ref-s15",
  16: "ref-s16",
  17: "ref-s17",
  18: "ref-s18",
  19: "ref-s19",
};

const REFERENCE_CSS = `
/* The reference skin is only enabled when the current room has the 20 voice seats. */
body:has([data-jalwa-reference-room]) { background:#030107 !important; }
body:has([data-jalwa-reference-room]) > div.fixed.inset-0.flex.flex-col { overflow:hidden !important; background:#030107 !important; }
body:has([data-jalwa-reference-room]) > div.fixed.inset-0.flex.flex-col > img,
body:has([data-jalwa-reference-room]) > div.fixed.inset-0.flex.flex-col > div.absolute.inset-0.bg-black,
body:has([data-jalwa-reference-room]) > div.fixed.inset-0.flex.flex-col > div[class*="blur"] { display:none !important; }
body:has([data-jalwa-reference-room]) > div.fixed.inset-0.flex.flex-col > *:not([data-jalwa-reference-room]) { visibility:hidden !important; }
body:has([data-jalwa-reference-room]) [data-jalwa-reference-room] { visibility:visible !important; }

.ref-overlay { position:fixed; inset:0; z-index:2147483000; overflow:auto; background:#030107; color:#fff; scrollbar-width:none; }
.ref-overlay::-webkit-scrollbar { display:none; }
.ref-page { width:min(820px,100%); min-height:100%; margin:0 auto; padding:10px 10px 14px; box-sizing:border-box; }
.ref-panel { border:1px solid rgba(178,66,255,.45); background:linear-gradient(145deg,rgba(10,5,18,.97),rgba(3,1,9,.98)); border-radius:18px; box-shadow:inset 0 0 24px rgba(173,57,255,.05),0 0 18px rgba(154,45,255,.06); }
.ref-header { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:10px; padding:10px; }
.ref-brand { display:flex; align-items:center; gap:10px; min-width:0; }
.ref-logo { width:62px; height:62px; flex:0 0 62px; border:1px solid rgba(190,70,255,.65); border-radius:15px; background:radial-gradient(circle,#35104d,#09030f 68%); display:grid; place-items:center; overflow:hidden; box-shadow:0 0 16px rgba(190,60,255,.2); }
.ref-logo img { width:100%; height:100%; object-fit:cover; }
.ref-title { min-width:0; }
.ref-title strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:22px; line-height:1.1; font-weight:900; }
.ref-title span { display:block; margin-top:5px; font-size:12px; color:rgba(255,255,255,.62); }
.ref-heart { font-size:44px; line-height:1; color:#ff43dc; text-shadow:0 0 18px rgba(255,67,220,.8); padding:0 10px; }
.ref-actions { display:flex; gap:8px; }
.ref-action { width:66px; height:70px; border:1px solid rgba(178,66,255,.48); border-radius:14px; background:#07040d; color:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; font-size:11px; }
.ref-action svg { width:23px; height:23px; }
.ref-action.exit { border-color:rgba(244,63,94,.65); }
.ref-subrow { display:grid; grid-template-columns:1fr auto; gap:10px; align-items:center; margin-top:10px; }
.ref-rank { min-height:48px; padding:0 15px; display:flex; align-items:center; gap:10px; border:1px solid rgba(178,66,255,.45); border-radius:14px; background:#07040d; font-size:14px; font-weight:700; }
.ref-rank svg { color:#ffc400; }
.ref-rank-chevron { margin-left:auto; color:rgba(255,255,255,.65); }
.ref-online { min-width:120px; min-height:48px; padding:0 13px; display:flex; align-items:center; justify-content:center; gap:8px; border:1px solid rgba(178,66,255,.45); border-radius:14px; background:#07040d; font-size:15px; font-weight:800; }
.ref-online-dot { width:8px; height:8px; border-radius:50%; background:#18d765; box-shadow:0 0 9px #18d765; }
.ref-stage { position:relative; display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); grid-template-rows:repeat(6,minmax(55px,1fr)); gap:8px; margin-top:10px; }
.ref-seat { position:relative; min-width:0; min-height:92px; border:1px solid rgba(154,60,255,.72); border-radius:14px; background:linear-gradient(145deg,rgba(12,6,22,.98),rgba(2,1,8,.98)); box-shadow:inset 0 0 16px rgba(158,57,255,.06),0 0 10px rgba(158,57,255,.06); display:flex; flex-direction:column; align-items:center; justify-content:center; padding:8px 4px 5px; cursor:pointer; color:#fff; }
.ref-seat:hover { border-color:rgba(238,92,255,.9); }
.ref-seat .num { position:absolute; left:5px; top:5px; font-size:11px; font-weight:800; }
.ref-seat .avatar { width:57px; height:57px; border-radius:50%; overflow:hidden; border:1px solid rgba(188,73,255,.7); background:#09050f; display:grid; place-items:center; }
.ref-seat .avatar img { width:100%; height:100%; object-fit:cover; }
.ref-seat .avatar svg { color:rgba(255,255,255,.35); width:24px; }
.ref-seat .seat-name { max-width:90%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:4px; font-size:11px; font-weight:700; }
.ref-seat .seat-points { display:flex; align-items:center; gap:2px; margin-top:2px; font-size:10px; color:#fff; }
.ref-seat .seat-points svg { width:11px; height:11px; color:#ff6abf; fill:#ff6abf; }
.ref-seat .mic { position:absolute; right:5px; bottom:5px; width:20px; height:20px; border-radius:50%; display:grid; place-items:center; background:#0b0b0d; border:1px solid rgba(255,255,255,.28); }
.ref-seat .mic.live { background:#0b8e4d; border-color:#2af68c; }
.ref-seat .mic.muted { background:#9c1838; border-color:#ff557e; }
.ref-seat .plus { width:30px; height:30px; border:1px solid rgba(255,255,255,.35); border-radius:50%; display:grid; place-items:center; color:#fff; }
.ref-host { position:relative; min-width:0; min-height:300px; grid-column:3/5; grid-row:2/6; border:2px solid rgba(206,65,255,.9); border-radius:23px; background:radial-gradient(circle at 50% 35%,rgba(221,44,255,.22),transparent 43%),linear-gradient(145deg,#17072a,#030108); box-shadow:0 0 28px rgba(189,48,255,.32),inset 0 0 35px rgba(216,43,255,.1); display:flex; flex-direction:column; align-items:center; justify-content:center; padding:22px 10px 12px; cursor:pointer; }
.ref-host::before { content:"HOST"; position:absolute; top:-11px; left:50%; transform:translateX(-50%); border:1px solid rgba(235,89,255,.9); border-radius:999px; background:#07020d; padding:4px 18px; font-size:11px; font-weight:900; letter-spacing:1.5px; }
.ref-host .host-avatar { width:132px; height:132px; border-radius:50%; overflow:hidden; border:2px solid rgba(232,76,255,.85); background:#09030f; box-shadow:0 0 22px rgba(221,58,255,.3); display:grid; place-items:center; }
.ref-host .host-avatar img { width:100%; height:100%; object-fit:cover; }
.ref-host .host-name { margin-top:9px; font-size:20px; font-weight:900; }
.ref-host .host-points { display:flex; align-items:center; gap:5px; margin-top:4px; font-size:15px; }
.ref-host .host-points svg { color:#ff2d86; fill:#ff2d86; width:17px; }
.ref-mic-icon { margin-top:8px; font-size:37px; color:#fff; text-shadow:0 0 10px rgba(255,255,255,.25); }
.ref-wave { height:35px; margin-top:7px; display:flex; align-items:center; justify-content:center; gap:2px; }
.ref-wave i { width:2px; border-radius:2px; background:linear-gradient(#ff43dc,#7b5cff); display:block; }
.ref-controls { display:flex; align-items:center; justify-content:center; gap:28px; margin-top:12px; }
.ref-control { width:72px; height:72px; border:1px solid rgba(178,66,255,.65); border-radius:19px; background:#08040f; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; color:#fff; font-size:10px; font-weight:700; }
.ref-control.mic { width:88px; height:88px; border-radius:25px; border:2px solid rgba(204,68,255,.9); box-shadow:0 0 24px rgba(201,56,255,.25); }
.ref-control.mic svg { width:42px; height:42px; color:#ff73f3; filter:drop-shadow(0 0 8px rgba(255,93,239,.6)); }
.ref-control svg { width:24px; height:24px; }
.ref-mic-status { text-align:center; margin-top:4px; color:#26e879; font-size:11px; font-weight:800; }
.ref-announce { margin-top:12px; min-height:42px; padding:0 13px; display:flex; align-items:center; gap:10px; border:1px solid rgba(178,66,255,.45); border-radius:14px; background:#07040d; font-size:12px; overflow:hidden; }
.ref-announce .rocket { margin-left:auto; color:#ff6cff; }
.ref-bottom { display:grid; grid-template-columns:minmax(0,1.65fr) minmax(250px,1fr); gap:10px; margin-top:10px; }
.ref-chat { min-height:300px; border:1px solid rgba(178,66,255,.45); border-radius:18px; background:#04020a; overflow:hidden; display:flex; flex-direction:column; }
.ref-tabs { display:flex; height:47px; border-bottom:1px solid rgba(178,66,255,.3); }
.ref-tab { flex:0 0 92px; border:0; background:transparent; color:rgba(255,255,255,.5); font-size:14px; font-weight:700; }
.ref-tab.active { color:#fff; border-bottom:2px solid #bb3cff; background:linear-gradient(180deg,rgba(177,59,255,.16),transparent); }
.ref-chat-body { flex:1; min-height:190px; padding:12px; overflow:auto; scrollbar-width:none; }
.ref-chat-body::-webkit-scrollbar { display:none; }
.ref-empty { height:100%; min-height:160px; display:grid; place-items:center; text-align:center; color:rgba(255,255,255,.55); font-size:14px; }
.ref-empty svg { width:54px; height:54px; margin:0 auto 8px; color:#8e7aa9; }
.ref-message { margin:5px 0; padding:7px 9px; border-radius:11px; background:rgba(255,255,255,.045); font-size:11px; line-height:1.35; }
.ref-composer { display:flex; align-items:center; gap:8px; padding:9px; border-top:1px solid rgba(178,66,255,.24); }
.ref-input { flex:1; min-width:0; height:43px; border:1px solid rgba(178,66,255,.4); border-radius:999px; background:#07040e; color:#fff; padding:0 14px; outline:none; }
.ref-send { width:45px; height:45px; border:0; border-radius:50%; display:grid; place-items:center; color:#fff; background:linear-gradient(135deg,#6f2dff,#e12dff); box-shadow:0 0 18px rgba(193,48,255,.32); }
.ref-side { display:flex; flex-direction:column; gap:10px; }
.ref-card { flex:1; min-height:92px; border:1px solid rgba(178,66,255,.45); border-radius:16px; background:linear-gradient(145deg,#0a0513,#04020a); padding:14px; }
.ref-card-title { display:flex; align-items:center; gap:10px; font-size:14px; font-weight:800; }
.ref-card-title svg { color:#d86aff; width:26px; height:26px; }
.ref-progress { height:10px; margin-top:12px; border:1px solid rgba(178,66,255,.4); border-radius:999px; overflow:hidden; background:#08030e; }
.ref-progress > i { display:block; height:100%; width:var(--pct,0%); background:linear-gradient(90deg,#8f43ff,#e945ff); box-shadow:0 0 10px rgba(214,69,255,.55); }
.ref-event-copy { margin-top:9px; font-size:11px; color:rgba(255,255,255,.62); line-height:1.45; }
.ref-dock { display:grid; grid-template-columns:repeat(3,1fr) 1.15fr repeat(2,1fr); gap:6px; margin-top:10px; padding:7px; border:1px solid rgba(178,66,255,.45); border-radius:18px; background:#05020b; }
.ref-dock-btn { min-height:67px; border:0; border-radius:12px; background:transparent; color:rgba(255,255,255,.8); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; font-size:11px; font-weight:700; }
.ref-dock-btn.active { color:#fff; }
.ref-dock-btn svg { width:25px; height:25px; }
.ref-dock-btn.mic { border:2px solid rgba(206,68,255,.8); border-radius:22px; background:radial-gradient(circle,#281044,#07030d 65%); box-shadow:0 0 22px rgba(202,57,255,.25); }
.ref-dock-btn.mic svg { color:#ff6ef4; width:36px; height:36px; }

@media (max-width: 700px) {
  .ref-page { padding:7px 7px 10px; }
  .ref-header { grid-template-columns:1fr; }
  .ref-actions { justify-content:flex-end; }
  .ref-action { width:54px; height:58px; }
  .ref-heart { display:none; }
  .ref-title strong { font-size:18px; }
  .ref-logo { width:54px; height:54px; flex-basis:54px; }
  .ref-stage { grid-template-rows:repeat(6,minmax(48px,1fr)); gap:5px; }
  .ref-seat { min-height:74px; padding:5px 2px 4px; }
  .ref-seat .avatar { width:42px; height:42px; }
  .ref-seat .seat-name { font-size:9px; }
  .ref-host { min-height:245px; padding-top:20px; }
  .ref-host .host-avatar { width:92px; height:92px; }
  .ref-host .host-name { font-size:14px; }
  .ref-host .host-points { font-size:11px; }
  .ref-mic-icon { font-size:28px; }
  .ref-controls { gap:12px; margin-top:8px; }
  .ref-control { width:56px; height:56px; border-radius:15px; }
  .ref-control.mic { width:68px; height:68px; border-radius:19px; }
  .ref-control.mic svg { width:32px; height:32px; }
  .ref-bottom { grid-template-columns:1fr; }
  .ref-side { display:grid; grid-template-columns:1fr 1fr; }
  .ref-card { min-height:100px; }
  .ref-dock { grid-template-columns:repeat(3,1fr) 1.15fr repeat(2,1fr); }
}
`;

function clickExisting(predicate: (button: HTMLButtonElement) => boolean) {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
  const button = buttons.find(predicate);
  if (button) {
    button.click();
    return true;
  }
  return false;
}

function clickByAria(label: RegExp) {
  return clickExisting((b) => label.test(b.getAttribute("aria-label") ?? ""));
}

function clickByText(text: RegExp) {
  return clickExisting((b) => text.test((b.textContent ?? "").replace(/\s+/g, " ")));
}

function readSeat(index: number): SeatSnapshot {
  const el = document.querySelector<HTMLElement>(`[data-seat-index="${index}"]`);
  if (!el) return { index, avatar: null, name: "Empty", occupied: false, muted: false, likes: "0" };
  const img = el.querySelector<HTMLImageElement>("img");
  const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  const muted = !!el.querySelector("svg");
  const occupied = !!el.getAttribute("data-user-dp");
  const number = `No.${index + 1}`;
  let name = "Empty";
  if (occupied) {
    const cleaned = text.replace(String(index + 1), "").replace(/No\.\s*\d+/i, "").replace(/\d+/g, " ").replace(/♥/g, " ").trim();
    if (cleaned && cleaned.length < 40) name = cleaned;
  }
  const likesMatch = text.match(/(\d+)$/);
  return {
    index,
    avatar: img?.src ?? null,
    name: name || number,
    occupied,
    muted,
    likes: likesMatch?.[1] ?? "0",
  };
}

function readCurrentRoom() {
  const header = document.querySelector<HTMLElement>(
    "div.relative.z-10.mx-auto.w-full.max-w-md.px-3.pb-2",
  );
  const title = header?.querySelector(".text-\\[14px\\]")?.textContent?.trim() || "Live Voice Room";
  const idMatch = header?.textContent?.match(/ID:\s*([0-9]+)/i);
  const hostAvatar = document.querySelector<HTMLImageElement>(`[data-seat-index="0"] img`)?.src ?? null;
  const rankButton = Array.from(document.querySelectorAll("button")).find((b) => /No ranking yet|Top Gifters|Ranked/i.test(b.textContent ?? ""));
  const onlineButton = document.querySelector<HTMLButtonElement>('button[aria-label="View viewers"]');
  const popButton = document.querySelector<HTMLButtonElement>('button[aria-label="Open leaderboard"]');
  const popMatch = popButton?.textContent?.match(/(\d+)%/);
  return {
    title,
    roomCode: idMatch?.[1] ?? "00000000",
    hostAvatar,
    ranking: rankButton?.textContent?.replace(/\s+/g, " ").trim() || "No ranking yet",
    online: onlineButton?.textContent?.match(/\d+/)?.[0] || "0",
    popularity: popMatch?.[1] || "0",
  };
}

function readMessages() {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(".max-h-24, .max-h-\\[26vh\\]"));
  const node = candidates.find((n) => (n.textContent ?? "").trim().length > 0);
  if (!node) return [];
  return (node.innerText || node.textContent || "")
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(-8);
}

export function RoomDiagnostics({
  roomId,
  rtcChannel,
  status,
  error,
  remotesCount,
  muted,
  speakerMuted,
}: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [referenceReady, setReferenceReady] = useState(false);
  const [roomInfo, setRoomInfo] = useState(() => ({ title: "Live Voice Room", roomCode: "00000000", hostAvatar: null as string | null, ranking: "No ranking yet", online: "0", popularity: "0" }));
  const [seats, setSeats] = useState<SeatSnapshot[]>(() => Array.from({ length: 20 }, (_, i) => ({ index: i, avatar: null, name: "Empty", occupied: false, muted: false, likes: "0" })));
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    const detect = () => {
      const twenty = document.querySelector('[data-seat-index="19"]');
      const voice = !!twenty;
      setReferenceReady(voice);
      if (!voice) return;
      setRoomInfo(readCurrentRoom());
      setSeats(Array.from({ length: 20 }, (_, i) => readSeat(i)));
      setMessages(readMessages());
    };
    detect();
    const timer = window.setInterval(detect, 700);
    return () => window.clearInterval(timer);
  }, []);

  const roomShort = useMemo(() => (roomId ? `${roomId.slice(0, 8)}…` : "—"), [roomId]);

  async function copyRoom() {
    try {
      await navigator.clipboard.writeText(roomId ?? "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  }

  function seatClick(index: number) {
    clickExisting((b) => b.getAttribute("data-seat-index") === String(index));
  }

  function openChat() {
    clickByText(/Type a message\.\.\.|Type a message/);
  }

  function sendGift() {
    clickByAria(/Send gift/i) || clickByText(/^Gift$/);
  }

  function openGames() {
    clickByAria(/^Games$/i) || clickByText(/^Games$/);
  }

  function openMore() {
    clickByAria(/^More$/i) || clickByText(/^More$/);
  }

  function toggleMic() {
    clickByAria(/Enable mic|Unmute mic|Mute mic|Mic/i) || clickByText(/^Mic$/);
  }

  function toggleSpeaker() {
    clickByText(/Speaker On|Speaker Off|Speaker/);
  }

  if (!referenceReady) {
    return (
      <div
        data-jalwa-voice-room-redesign
        className="pointer-events-auto fixed left-2 top-[calc(env(safe-area-inset-top)+56px)] z-[70] select-none"
      >
        <style dangerouslySetInnerHTML={{ __html: REFERENCE_CSS }} />
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur"
        >
          <Activity className="h-3 w-3" />
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLOR[status]}`} />
          <span>{status}</span>
        </button>
        {open && (
          <div className="mt-1.5 w-[260px] rounded-2xl border border-white/15 bg-black/85 p-2.5 text-[11px] text-white shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between"><span>Room</span><button onClick={copyRoom} className="flex items-center gap-1">{roomShort}{copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}</button></div>
            <div className="mt-1 flex items-center justify-between"><span>RTC</span><span className="font-mono">ZEGOCLOUD</span></div>
            <div className="mt-1 flex items-center justify-between"><span>Remotes</span><span>{remotesCount ?? 0}</span></div>
            {error && <div className="mt-2 rounded-lg bg-red-500/10 p-1.5 text-red-200">{error}</div>}
          </div>
        )}
      </div>
    );
  }

  const online = Number(roomInfo.online || 0);
  const popularity = Math.max(0, Math.min(100, Number(roomInfo.popularity || 0)));
  const host = seats[0];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: REFERENCE_CSS }} />
      <div data-jalwa-voice-room-redesign data-jalwa-reference-room className="ref-overlay">
        <div className="ref-page">
          <section className="ref-panel ref-header">
            <div className="ref-brand">
              <button className="ref-logo" onClick={() => seatClick(0)} aria-label="Host">
                {roomInfo.hostAvatar ? <img src={roomInfo.hostAvatar} alt="" /> : <UserIcon />}
              </button>
              <div className="ref-title">
                <strong>{roomInfo.title} <span style={{ display: "inline", color: "#d96aff" }}>✓</span></strong>
                <span>ID: {roomInfo.roomCode} · Room {roomShort}</span>
              </div>
              <div className="ref-heart" aria-hidden>♡</div>
            </div>
            <div className="ref-actions">
              <button className="ref-action" onClick={() => clickByText(/Report this room|Report/i)}><Flag /><span>Report</span></button>
              <button className="ref-action" onClick={() => clickByAria(/Share/i) || clickByText(/^Share$/)}><Share2 /><span>Share</span></button>
              <button className="ref-action exit" onClick={() => clickByAria(/Exit room|Exit/i) || clickByText(/^Exit$/)}><Power /><span>Exit</span></button>
            </div>
          </section>

          <div className="ref-subrow">
            <button className="ref-rank" onClick={() => clickByText(/No ranking yet|Top Gifters|Ranked/i)}>
              <Trophy /><span>{roomInfo.ranking || "No ranking yet"}</span><ChevronRight className="ref-rank-chevron" />
            </button>
            <button className="ref-online" onClick={() => clickByAria(/View viewers/i)}><Users /><span className="ref-online-dot" />{online}</button>
          </div>

          <section className="ref-stage">
            {seats.slice(1).map((seat) => (
              <button key={seat.index} className={`ref-seat ${SEAT_PLACEMENT[seat.index]}`} onClick={() => seatClick(seat.index)} aria-label={`Seat ${seat.index + 1}`}>
                <span className="num">{seat.index + 1}</span>
                {seat.occupied ? (
                  <div className="avatar">{seat.avatar ? <img src={seat.avatar} alt="" /> : <UserIcon />}</div>
                ) : <div className="plus">+</div>}
                <span className="seat-name">{seat.occupied ? seat.name : `No.${seat.index + 1}`}</span>
                <span className="seat-points"><Heart />{seat.likes}</span>
                <span className={`mic ${seat.muted ? "muted" : "live"}`}><MicOff style={{ display: seat.muted ? "block" : "none", width:11 }} /><Mic style={{ display: seat.muted ? "none" : "block", width:11 }} /></span>
              </button>
            ))}

            <button className="ref-host" onClick={() => seatClick(0)} aria-label="Host seat">
              <div className="host-avatar">{host.avatar ? <img src={host.avatar} alt="" /> : <UserIcon />}</div>
              <div className="ref-mic-icon">♩</div>
              <div className="host-name">{host.name === "Empty" ? roomInfo.title : host.name} <span style={{ color: "#d96aff" }}>♛</span></div>
              <div className="host-points"><Heart />12.5K</div>
              <div className="ref-wave" aria-hidden>{Array.from({ length: 31 }, (_, i) => <i key={i} style={{ height: `${8 + ((i * 17) % 26)}px` }} />)}</div>
            </button>
          </section>

          <div className="ref-controls">
            <button className="ref-control" onClick={toggleSpeaker}><Volume2 /><span>Speaker</span></button>
            <button className="ref-control mic" onClick={toggleMic}><Mic /><span>Mic</span></button>
            <button className="ref-control" onClick={toggleMic}><MicOff /><span>Mute All</span></button>
          </div>
          <div className="ref-mic-status"><span style={{ color: muted ? "#ff547a" : "#22df78" }}>●</span> {muted ? "Mic Off" : "Mic On"}</div>

          <div className="ref-announce">
            <span style={{ fontSize:20 }}>📢</span>
            <span>{messages.length ? messages[messages.length - 1] : "User activity and room announcements appear here"}</span>
            <Rocket className="rocket" />
          </div>

          <section className="ref-bottom">
            <div className="ref-chat">
              <div className="ref-tabs"><button className="ref-tab active">All</button><button className="ref-tab" onClick={openChat}>Chat</button></div>
              <div className="ref-chat-body">
                {messages.length ? messages.map((m, i) => <div className="ref-message" key={`${m}-${i}`}>{m}</div>) : <div className="ref-empty"><div><Smile /><div>No messages yet</div><small>Start the conversation</small></div></div>}
              </div>
              <div className="ref-composer">
                <button style={{ background:"transparent", border:0, color:"#aaa" }} onClick={openChat}><Smile /></button>
                <button className="ref-input" style={{ textAlign:"left" }} onClick={openChat}>Say something...</button>
                <button className="ref-send" onClick={openChat} aria-label="Send message"><Send /></button>
              </div>
            </div>

            <aside className="ref-side">
              <button className="ref-card" onClick={() => clickByText(/Top Gifters|Ranked|No ranking yet/i)}>
                <div className="ref-card-title"><Rocket /><span>Room Popularity</span><span style={{ marginLeft:"auto" }}>{popularity}%</span></div>
                <div className="ref-progress"><i style={{ ["--pct" as string]: `${popularity}%` }} /></div>
              </button>
              <div className="ref-card"><div className="ref-card-title"><CalendarDays /><span>No active events</span></div><div className="ref-event-copy">Check back later</div></div>
              <div className="ref-card"><div className="ref-card-title"><Flag /><span>Room Announcement</span></div><div className="ref-event-copy">No announcement yet</div></div>
            </aside>
          </section>

          <nav className="ref-dock">
            <button className="ref-dock-btn active" onClick={() => clickByAria(/Exit room|Exit/i)}><Home /><span>Home</span></button>
            <button className="ref-dock-btn" onClick={sendGift}><Gift /><span>Gifts</span></button>
            <button className="ref-dock-btn" onClick={openGames}><Gamepad2 /><span>Game</span></button>
            <button className="ref-dock-btn mic" onClick={toggleMic}><Mic /><span>Mic</span></button>
            <button className="ref-dock-btn" onClick={openChat}><Smile /><span>Chat</span></button>
            <button className="ref-dock-btn" onClick={openMore}><Grid2X2 /><span>More</span></button>
          </nav>
        </div>
      </div>
    </>
  );
}
