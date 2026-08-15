import { useEffect } from "react";

type Status = "idle" | "connecting" | "connected" | "error" | "disabled";
type Props = {
  roomId: string | null | undefined;
  rtcChannel: string | null | undefined;
  status: Status;
  error?: string | null;
  remotesCount?: number;
  muted?: boolean;
  speakerMuted?: boolean;
};

/** Installs layout rules for the real Voice Room. The old full-screen diagnostic mock is intentionally removed. */
export function RoomDiagnostics(_props: Props) {
  useEffect(() => {
    const id = "jalwa-voice-room-layout-v2";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      html,body{overscroll-behavior:none}
      body:has([data-seat-index="19"]){overflow:hidden!important;height:100dvh!important}
      div:has(>[data-seat-index="0"]):has(>[data-seat-index="19"]){display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;grid-template-rows:repeat(5,minmax(54px,1fr))!important;gap:7px!important;width:100%!important;min-height:0!important}
      div:has(>[data-seat-index="0"]):has(>[data-seat-index="19"])>[data-seat-index="0"]{grid-column:3/5!important;grid-row:1/5!important;min-height:250px!important;border-radius:24px!important;border-width:2px!important;border-color:#d746ff!important;background:radial-gradient(circle at 50% 30%,rgba(221,44,255,.22),transparent 45%),linear-gradient(145deg,#18072a,#030108)!important;box-shadow:0 0 28px rgba(189,48,255,.28),inset 0 0 35px rgba(216,43,255,.1)!important}
      div:has(>[data-seat-index="0"]):has(>[data-seat-index="19"])>[data-seat-index="1"]{grid-column:1!important;grid-row:1!important}
      div:has(>[data-seat-index="0"]):has(>[data-seat-index="19"])>[data-seat-index="2"]{grid-column:2!important;grid-row:1!important}
      div:has(>[data-seat-index="0"]):has(>[data-seat-index="19"])>[data-seat-index="3"]{grid-column:1!important;grid-row:2!important}
      div:has(>[data-seat-index="0"]):has(>[data-seat-index="19"])>[data-seat-index="4"]{grid-column:2!important;grid-row:2!important}
      div:has(>[data-seat-index="0"]):has(>[data-seat-index="19"])>[data-seat-index="5"]{grid-column:1!important;grid-row:3!important}
      div:has(>[data-seat-index="0"]):has(>[data-seat-index="19"])>[data-seat-index="6"]{grid-column:2!important;grid-row:3!important}
      div:has(>[data-seat-index="0"]):has(>[data-seat-index="19"])>[data-seat-index="7"]{grid-column:1!important;grid-row:4!important}
      div:has(>[data-seat-index="0"]):has(>[data-seat-index="19"])>[data-seat-index="8"]{grid-column:2!important;grid-row:4!important}
      div:has(>[data-seat-index="0"]):has(>[data-seat-index="19"])>[data-seat-index="9"]{grid-column:5!important;grid-row:1!important}
      div:has(>[data-seat-index="0"]):has(>[data-seat-index="19"])>[data-seat-index="10"]{grid-column:6!important;grid-row:1!important}
      div:has(>[data-seat-index="0"]):has(>[data-seat-index="19"])>[data-seat-index="11"]{grid-column:5!important;grid-row:2!important}
      div:has(>[data-seat-index="0"]):has(>[data-seat-index="19"])>[data-seat-index="12"]{grid-column:6!important;grid-row:2!important}
      div:has(>[data-seat-index="0"]):has(>[data-seat-index="19"])>[data-seat-index="13"]{grid-column:5!important;grid-row:3!important}
      div:has(>[data-seat-index="0"]):has(>[data-seat-index="19"])>[data-seat-index="14"]{grid-column:6!important;grid-row:3!important}
      div:has(>[data-seat-index="0"]):has(>[data-seat-index="19"])>[data-seat-index="15"]{grid-column:5!important;grid-row:4!important}
      div:has(>[data-seat-index="0"]):has(>[data-seat-index="19"])>[data-seat-index="16"]{grid-column:6!important;grid-row:4!important}
      div:has(>[data-seat-index="0"]):has(>[data-seat-index="19"])>[data-seat-index="17"]{grid-column:1/3!important;grid-row:5!important}
      div:has(>[data-seat-index="0"]):has(>[data-seat-index="19"])>[data-seat-index="18"]{grid-column:3/5!important;grid-row:5!important}
      div:has(>[data-seat-index="0"]):has(>[data-seat-index="19"])>[data-seat-index="19"]{grid-column:5/7!important;grid-row:5!important}
      @media(max-width:700px){
        div:has(>[data-seat-index="0"]):has(>[data-seat-index="19"]){grid-template-rows:repeat(5,minmax(50px,1fr))!important;gap:5px!important}
        div:has(>[data-seat-index="0"]):has(>[data-seat-index="19"])>[data-seat-index="0"]{min-height:300px!important;border-radius:25px!important}
        div:has(>[data-seat-index="0"]):has(>[data-seat-index="19"])>[data-seat-index]:not([data-seat-index="0"]){min-width:0!important;padding:4px!important;border-radius:12px!important}
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
  return null;
}
