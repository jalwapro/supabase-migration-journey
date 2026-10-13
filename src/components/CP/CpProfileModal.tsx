import { useEffect, useState } from "react";
import {
  getCpStatus, getCpProposals, getCpPrelinkRomanticGiftTotal, respondCpProposal, sendCpProposal,
  getCpBreakupRequests, requestCpBreakup, respondCpBreakupRequest,
  type CpProposal, type CpRelation, type CpBreakupRequest,
} from "@/lib/cp/cpApi";

type CpTargetUser = { id: string; username?: string | null; avatar?: string | null; avatarUrl?: string | null };
type Props = { isOpen: boolean; onClose: () => void; currentUserId: string; targetUser: CpTargetUser; onStartProposal?: (verifiedPrelinkCoins: number) => void };

export function CpProfileModal({ isOpen, onClose, currentUserId, targetUser, onStartProposal }: Props) {
  const [myCp, setMyCp] = useState<CpRelation | null>(null);
  const [targetCp, setTargetCp] = useState<CpRelation | null>(null);
  const [incoming, setIncoming] = useState<CpProposal | null>(null);
  const [breakupRequests, setBreakupRequests] = useState<CpBreakupRequest[]>([]);
  const [prelinkGiftCoins, setPrelinkGiftCoins] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    setLoading(true); setError("");
    try {
      const [mine, theirs, proposals, prelinkCoins, breakupRows] = await Promise.all([
        getCpStatus(currentUserId), getCpStatus(targetUser.id), getCpProposals(),
        getCpPrelinkRomanticGiftTotal(targetUser.id), getCpBreakupRequests(currentUserId),
      ]);
      setMyCp(mine); setTargetCp(theirs); setPrelinkGiftCoins(prelinkCoins);
      setBreakupRequests(breakupRows);
      setIncoming(proposals.find((p) => p.sender_id === targetUser.id && p.receiver_id === currentUserId) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load CP status");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (isOpen && currentUserId && targetUser.id && currentUserId !== targetUser.id) void refresh();
    // refresh intentionally runs when the modal opens or either identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentUserId, targetUser.id]);

  if (!isOpen) return null;
  const relation = myCp;
  const isPartner = !!relation && (relation.user1_id === targetUser.id || relation.user2_id === targetUser.id);
  const eitherHasPartner = !!myCp || !!targetCp;

  async function act(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(success); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "CP action failed"); }
    finally { setBusy(false); }
  }

  const avatar = targetUser.avatarUrl || targetUser.avatar || "";
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="cp-profile-title" className="w-full max-w-sm rounded-2xl border border-pink-400/30 bg-[#15111b] p-5 text-white shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-300">JALWA Couple</p>
            <h2 id="cp-profile-title" className="mt-1 text-xl font-bold">CP Profile</h2>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg px-3 py-1 text-xl text-white/70 hover:bg-white/10">×</button>
        </div>
        <div className="flex flex-col items-center rounded-xl bg-white/5 p-4">
          {avatar ? <img src={avatar} alt="" className="h-20 w-20 rounded-full border-2 border-pink-400 object-cover" /> :
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-pink-500/20 text-2xl">♥</div>}
          <p className="mt-3 font-bold">{targetUser.username || "JALWA User"}</p>
          {loading ? <p className="mt-3 text-sm text-white/60">Checking CP status…</p> : null}
          {!loading && isPartner && relation ? (
            <div className="mt-3 text-center">
              <p className="font-semibold text-pink-300">♥ Your CP Partner ♥</p>
              <p className="mt-1 text-sm text-white/70">Intimacy: {relation.intimacy_score} · Level {relation.ring_level}</p>
              {(() => {
                const pending = breakupRequests.find((request) => request.relation_id === relation.id);
                if (!pending) return (
                  <button type="button" disabled={busy} onClick={() => {
                    if (window.confirm("Send a request to end CP? Your partner must accept before the relationship ends.")) {
                      void act(() => requestCpBreakup(relation.id), "CP breakup request sent. Your partner must accept to end the relationship.");
                    }
                  }} className="mt-4 w-full rounded-xl bg-red-600 px-4 py-3 font-bold disabled:opacity-50">
                    Request to End CP
                  </button>
                );
                if (pending.requester_id === currentUserId) return <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-200">Your request is pending. CP will end only if your partner accepts.</p>;
                return (
                  <div className="mt-4 w-full rounded-xl border border-red-300/20 bg-red-500/10 p-3">
                    <p className="text-sm font-semibold text-red-200">Your partner requested to end CP.</p>
                    <p className="mt-1 text-xs text-white/65">Accept to end the relationship for both users, or reject to keep CP active.</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" disabled={busy} onClick={() => void act(() => respondCpBreakupRequest(pending.id, true), "CP relationship ended after partner approval.")} className="rounded-lg bg-red-600 px-3 py-2 font-bold disabled:opacity-50">Accept</button>
                      <button type="button" disabled={busy} onClick={() => void act(() => respondCpBreakupRequest(pending.id, false), "Request rejected. Your CP relationship remains active.")} className="rounded-lg bg-white/10 px-3 py-2 font-bold disabled:opacity-50">Reject</button>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : null}
          {!loading && !isPartner && incoming ? (
            <div className="mt-4 grid w-full grid-cols-2 gap-2">
              <button type="button" disabled={busy} onClick={() => void act(() => respondCpProposal(incoming.id, true), "CP proposal accepted.")} className="rounded-xl bg-pink-600 px-3 py-3 font-bold disabled:opacity-50">Accept CP</button>
              <button type="button" disabled={busy} onClick={() => void act(() => respondCpProposal(incoming.id, false), "CP proposal declined.")} className="rounded-xl bg-white/10 px-3 py-3 font-semibold disabled:opacity-50">Decline</button>
            </div>
          ) : null}
          {!loading && !isPartner && !incoming ? (
            <>
            <button type="button" disabled={busy || eitherHasPartner || currentUserId === targetUser.id}
              onClick={() => onStartProposal ? onStartProposal(prelinkGiftCoins) : void act(() => sendCpProposal(targetUser.id, 13333), "CP proposal sent. The server calculated the fee from verified romantic-gift history.")}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 px-4 py-3 font-bold shadow-lg disabled:cursor-not-allowed disabled:opacity-50">
              <span className="inline-flex items-center justify-center gap-2"><img src="/images/cp/icon_vpt_apply_cp.png" alt="" className="h-6 w-6 object-contain" /> {onStartProposal ? "Choose Ring & Send Proposal" : `Send CP Proposal · ${prelinkGiftCoins >= 13333 ? "Free" : "up to 13,333 coins"}`}</span>
            </button>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-white/60">
              <img src="/images/cp/icon_vpt_cp_question.png" alt="" className="h-4 w-4 shrink-0 object-contain" />
              Verified pre-CP romantic gifts: {prelinkGiftCoins.toLocaleString()} coins. The server verifies ring-fee eligibility before charging.
            </p>
            </>
          ) : null}
          {eitherHasPartner && !isPartner && !incoming && !loading ? <p className="mt-3 text-center text-xs text-amber-200">You or this user already has an active CP partner.</p> : null}
          {busy ? <p className="mt-3 text-sm text-white/60">Processing securely…</p> : null}
          {notice ? <p role="status" className="mt-3 text-sm text-emerald-300">{notice}</p> : null}
          {error ? <p role="alert" className="mt-3 text-sm text-red-300">{error}</p> : null}
        </div>
      </section>
    </div>
  );
}
