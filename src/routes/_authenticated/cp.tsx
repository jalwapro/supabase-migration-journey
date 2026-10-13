import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Heart, Search, Users, RefreshCw, UserRound, Check, X, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CpProfileModal } from "@/components/CP/CpProfileModal";
import { CpRingSelectorModal } from "@/components/CP/CpRingSelectorModal";
import { CpExclusiveGiftShop } from "@/components/CP/CpExclusiveGiftShop";
import { getCpProposals, getCpStatus, getCpWeeklyRanking, getCpBreakupRequests, requestCpBreakup, respondCpBreakupRequest, type CpProposal, type CpRelation, type CpWeeklyRanking, type CpBreakupRequest } from "@/lib/cp/cpApi";

type Person = { id: string; username: string | null; avatar: string | null; user_code?: string | null };
// Keep the CP Center route explicitly registered under the authenticated shell.
export const Route = createFileRoute("/_authenticated/cp")({ component: CpHome });

function CpHome() {
  const [userId, setUserId] = useState("");
  const [myRelation, setMyRelation] = useState<CpRelation | null>(null);
  const [partner, setPartner] = useState<Person | null>(null);
  const [incoming, setIncoming] = useState<Array<{ proposal: CpProposal; person: Person }>>([]);
  const [sent, setSent] = useState<CpProposal[]>([]);
  const [breakupRequests, setBreakupRequests] = useState<CpBreakupRequest[]>([]);
  const [breakupBusy, setBreakupBusy] = useState(false);
  const [ranking, setRanking] = useState<CpWeeklyRanking[]>([]);
  const [rankProfiles, setRankProfiles] = useState<Record<string, Person>>({});
  const [searchCode, setSearchCode] = useState("");
  const [target, setTarget] = useState<Person | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [ringModalOpen, setRingModalOpen] = useState(false);
  const [ringPrelinkCoins, setRingPrelinkCoins] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      const id = auth.user?.id;
      if (!id) throw new Error("Please sign in to use CP.");
      setUserId(id);
      const [relation, proposals, ranks, breakupRows] = await Promise.all([
        getCpStatus(id), getCpProposals(), getCpWeeklyRanking(), getCpBreakupRequests(id),
      ]);
      setBreakupRequests(breakupRows);
      setMyRelation(relation);
      setSent(proposals.filter((p) => p.sender_id === id));
      const incomingRows = proposals.filter((p) => p.receiver_id === id);
      const partnerId = relation ? (relation.user1_id === id ? relation.user2_id : relation.user1_id) : null;
      const profileIds = [...new Set([...incomingRows.map((p) => p.sender_id), ...(partnerId ? [partnerId] : []), ...breakupRows.flatMap((r) => [r.requester_id, r.recipient_id]), ...ranks.flatMap((r) => [r.user1_id, r.user2_id])])];
      const { data: people, error: peopleError } = profileIds.length
        ? await supabase.from("profiles").select("id,username,avatar,user_code").in("id", profileIds)
        : { data: [], error: null };
      if (peopleError) throw peopleError;
      const map: Record<string, Person> = {};
      for (const person of (people ?? []) as Person[]) map[person.id] = person;
      setRankProfiles(map);
      setPartner(partnerId ? map[partnerId] ?? null : null);
      setIncoming(incomingRows.map((proposal) => ({ proposal, person: map[proposal.sender_id] ?? { id: proposal.sender_id, username: "JALWA User", avatar: null } })));
      setRanking(ranks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load CP details.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function findPerson() {
    const code = searchCode.trim();
    if (!code) { setError("Enter the partner's JALWA ID first."); return; }
    setSearching(true); setError("");
    try {
      const { data, error: queryError } = await supabase.from("profiles")
        .select("id,username,avatar,user_code").eq("user_code", code).maybeSingle();
      if (queryError) throw queryError;
      if (!data) throw new Error("No user found for that JALWA ID.");
      if (data.id === userId) throw new Error("You cannot send a CP proposal to yourself.");
      setTarget(data as Person);
      setModalOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not find that user.");
      setTarget(null);
    } finally { setSearching(false); }
  }

  function openPerson(person: Person) {
    setTarget(person);
    setModalOpen(true);
  }

  async function handleBreakupRequest() {
    if (!myRelation) return;
    setBreakupBusy(true);
    try { await requestCpBreakup(myRelation.id); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not send CP breakup request."); }
    finally { setBreakupBusy(false); }
  }

  async function handleBreakupResponse(requestId: string, accept: boolean) {
    setBreakupBusy(true);
    try { await respondCpBreakupRequest(requestId, accept); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not respond to CP breakup request."); }
    finally { setBreakupBusy(false); }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl space-y-5 bg-background px-4 py-5 text-foreground sm:px-6">
      <header className="rounded-3xl border border-fuchsia-400/20 bg-gradient-to-br from-[#180b22] via-[#100d1c] to-[#151e3b] p-5 sm:p-7">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl bg-fuchsia-500/15"><img src="/images/cp/ic_open_page_cp.png" alt="" className="h-full w-full object-contain" /></span>
          <div><p className="text-xs font-bold uppercase tracking-[.22em] text-fuchsia-300">JALWA Couples</p><h1 className="text-2xl font-black sm:text-3xl">CP Center</h1></div>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-white/65">Send a proposal, manage your relationship and follow the weekly CP intimacy ranking.</p>
        <form className="mt-5 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void findPerson(); }}>
          <input value={searchCode} onChange={(e) => setSearchCode(e.target.value)} placeholder="Enter partner's JALWA ID"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm outline-none focus:border-fuchsia-400" />
          <button disabled={searching} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-3 text-sm font-bold disabled:opacity-50">
            <Search className="h-4 w-4" /> {searching ? "Searching…" : "Find partner"}
          </button>
        </form>
        {error && <p role="alert" className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      </header>

      {!loading && myRelation && (
        <CpExclusiveGiftShop cpLevel={myRelation.ring_level} onGiftSent={() => void refresh()} />
      )}

      {loading ? <div className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">Loading CP details…</div> : (
        <section className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold"><Heart className="h-4 w-4 text-fuchsia-400" /> My CP relationship</div>
            {myRelation && partner ? (
              <button type="button" onClick={() => openPerson(partner)} className="flex w-full items-center gap-3 rounded-xl bg-muted/50 p-3 text-left hover:bg-muted">
                {partner.avatar ? <img src={partner.avatar} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-full bg-fuchsia-500/15"><UserRound /></span>}
                <span className="min-w-0 flex-1"><strong className="block truncate">{partner.username || "JALWA User"}</strong><span className="text-xs text-muted-foreground">Intimacy {myRelation.intimacy_score.toLocaleString()} · Level {myRelation.ring_level}</span></span>
                <span className="text-xs font-bold text-fuchsia-300">Open</span>
              </button>
            ) : <p className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">You are not in a CP relationship yet. Search for a partner by JALWA ID above.</p>}
            {myRelation && (() => {
              const pending = breakupRequests.find((r) => r.relation_id === myRelation.id);
              if (!pending) return <button type="button" disabled={breakupBusy} onClick={() => void handleBreakupRequest()} className="mt-3 w-full rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-300 disabled:opacity-50"><Heart className="mr-2 inline h-4 w-4" /> {breakupBusy ? "Please wait…" : "Request to end CP"}</button>;
              if (pending.requester_id === userId) return <p className="mt-3 flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-200"><Clock className="h-4 w-4 shrink-0" /> Your CP breakup request is waiting for your partner's approval.</p>;
              return <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3"><p className="text-sm font-bold text-rose-200">Your partner wants to end this CP.</p><p className="mt-1 text-xs text-muted-foreground">Accepting ends the relationship for both users. Rejecting keeps CP active.</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={breakupBusy} onClick={() => void handleBreakupResponse(pending.id, true)} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><Check className="mr-1 inline h-4 w-4" /> Accept</button><button type="button" disabled={breakupBusy} onClick={() => void handleBreakupResponse(pending.id, false)} className="rounded-lg border border-border px-3 py-2 text-sm font-bold disabled:opacity-50"><X className="mr-1 inline h-4 w-4" /> Reject</button></div></div>;
            })()}
          </article>
          <article className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold"><Users className="h-4 w-4 text-amber-400" /> Incoming proposals</div>
            {incoming.length ? <div className="space-y-2">{incoming.map(({ proposal, person }) => (
              <button key={proposal.id} type="button" onClick={() => openPerson(person)} className="flex w-full items-center gap-3 rounded-xl bg-muted/50 p-3 text-left hover:bg-muted">
                {person.avatar ? <img src={person.avatar} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-amber-500/15"><Heart className="h-4 w-4" /></span>}
                <span className="min-w-0 flex-1"><strong className="block truncate">{person.username || "JALWA User"}</strong><span className="text-xs text-muted-foreground">Proposal waiting for your response</span></span>
                <span className="text-xs font-bold text-amber-300">Review</span>
              </button>
            ))}</div> : <p className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">No incoming proposals.</p>}
            {sent.length > 0 && <p className="mt-3 text-xs text-muted-foreground">{sent.length} outgoing proposal(s) pending.</p>}
          </article>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="flex items-center gap-2 text-lg font-black"><img src="/images/cp/icon_vpt_cp_rank_double_heart.png" alt="" className="h-7 w-7 object-contain" /> Weekly CP ranking</h2><p className="mt-1 text-xs text-muted-foreground">Resets Sunday at 00:00 Saudi Arabia time.</p></div>
          <button type="button" onClick={() => void refresh()} className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground hover:text-foreground" aria-label="Refresh CP"><RefreshCw className="h-4 w-4" /></button>
        </div>
        {ranking.length ? <div className="space-y-2">{ranking.map((row) => {
          const left = rankProfiles[row.user1_id];
          const right = rankProfiles[row.user2_id];
          return <div key={row.relation_id} className="flex items-center gap-3 rounded-xl bg-muted/40 p-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-400/10 text-sm font-black text-amber-300">{row.rank}</span>
            <span className="min-w-0 flex-1"><strong className="block truncate">{left?.username || "CP Partner"} ♥ {right?.username || "CP Partner"}</strong><span className="text-xs text-muted-foreground">Level {row.level} · Total intimacy {row.total_intimacy.toLocaleString()}</span></span>
            <span className="text-right"><strong className="block text-sm text-fuchsia-300">{row.weekly_intimacy.toLocaleString()}</strong><span className="text-[10px] text-muted-foreground">this week</span></span>
          </div>;
        })}</div> : <p className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">No CP ranking activity this week yet.</p>}
      </section>
      <CpProfileModal isOpen={modalOpen} onClose={() => setModalOpen(false)} currentUserId={userId}
        targetUser={target ?? { id: "", username: null }} />
    </main>
  );
}
