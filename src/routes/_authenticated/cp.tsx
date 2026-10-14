import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Heart,
  Search,
  Users,
  RefreshCw,
  UserRound,
  Check,
  X,
  Clock,
  Sparkles,
  Crown,
  Trophy,
  Flame,
  ShieldCheck,
  ArrowRight,
  Gift,
  Compass,
  Award,
  ChevronRight,
  Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CpProfileModal } from "@/components/CP/CpProfileModal";
import { CpRingSelectorModal } from "@/components/CP/CpRingSelectorModal";
import { CpSpaceView } from "@/components/CP/CpSpaceView";
import {
  getCpProposals,
  getCpStatus,
  getCpWeeklyRanking,
  getCpBreakupRequests,
  requestCpBreakup,
  respondCpBreakupRequest,
  type CpProposal,
  type CpRelation,
  type CpWeeklyRanking,
  type CpBreakupRequest,
} from "@/lib/cp/cpApi";

type Person = { id: string; username: string | null; avatar: string | null; user_code?: string | null };

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
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  // Active Tab: 'space' | 'ranking' | 'rings'
  const [activeTab, setActiveTab] = useState<"space" | "ranking" | "rings">("space");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      const id = auth.user?.id;
      if (!id) throw new Error("Please sign in to view CP Center.");
      setUserId(id);
      const [relation, proposals, ranks, breakupRows] = await Promise.all([
        getCpStatus(id),
        getCpProposals(),
        getCpWeeklyRanking(),
        getCpBreakupRequests(id),
      ]);
      setBreakupRequests(breakupRows);
      setMyRelation(relation);
      setSent(proposals.filter((p) => p.sender_id === id));
      const incomingRows = proposals.filter((p) => p.receiver_id === id);
      const partnerId = relation ? (relation.user1_id === id ? relation.user2_id : relation.user1_id) : null;
      const profileIds = [
        ...new Set([
          ...incomingRows.map((p) => p.sender_id),
          ...(partnerId ? [partnerId] : []),
          ...breakupRows.flatMap((r) => [r.requester_id, r.recipient_id]),
          ...ranks.flatMap((r) => [r.user1_id, r.user2_id]),
        ]),
      ];
      const { data: people, error: peopleError } = profileIds.length
        ? await supabase.from("profiles").select("id,username,avatar,user_code").in("id", profileIds)
        : { data: [], error: null };
      if (peopleError) throw peopleError;
      const map: Record<string, Person> = {};
      for (const person of (people ?? []) as Person[]) map[person.id] = person;
      setRankProfiles(map);
      setPartner(partnerId ? map[partnerId] ?? null : null);
      setIncoming(
        incomingRows.map((proposal) => ({
          proposal,
          person: map[proposal.sender_id] ?? { id: proposal.sender_id, username: "JALWA User", avatar: null },
        }))
      );
      setRanking(ranks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load CP details.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function findPerson() {
    const code = searchCode.trim();
    if (!code) {
      setError("Please enter the partner's JALWA ID.");
      return;
    }
    setSearching(true);
    setError("");
    try {
      const { data, error: queryError } = await supabase
        .from("profiles")
        .select("id,username,avatar,user_code")
        .eq("user_code", code)
        .maybeSingle();
      if (queryError) throw queryError;
      if (!data) throw new Error("No user found with that JALWA ID.");
      if (data.id === userId) throw new Error("You cannot send a CP proposal to yourself.");
      setTarget(data as Person);
      setSearchModalOpen(false);
      setModalOpen(true);
      setSearchCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not find that user.");
    } finally {
      setSearching(false);
    }
  }

  function openPerson(person: Person) {
    setTarget(person);
    setModalOpen(true);
  }

  async function handleBreakupRequest() {
    if (!myRelation) return;
    setBreakupBusy(true);
    try {
      await requestCpBreakup(myRelation.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send CP breakup request.");
    } finally {
      setBreakupBusy(false);
    }
  }

  async function handleBreakupResponse(requestId: string, accept: boolean) {
    setBreakupBusy(true);
    try {
      await respondCpBreakupRequest(requestId, accept);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not respond to CP breakup request.");
    } finally {
      setBreakupBusy(false);
    }
  }

  const top3 = ranking.slice(0, 3);
  const remainingRanks = ranking.slice(3);

  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-[#13071f] via-[#0d0516] to-[#08020d] text-white pb-20">
      {/* Background Romantic Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-fuchsia-600/15 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -left-20 w-80 h-80 bg-pink-600/10 rounded-full blur-[100px]" />
        <div className="absolute top-2/3 -right-20 w-80 h-80 bg-rose-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-2xl px-4 pt-4 sm:px-6">
        {/* Top App Bar Header */}
        <header className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-pink-500 to-fuchsia-600 shadow-lg shadow-pink-500/30">
              <Heart className="h-6 w-6 text-white fill-white animate-pulse" />
              <Sparkles className="absolute -top-1 -right-1 h-3.5 w-3.5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-pink-200 via-rose-100 to-amber-200">
                  CP Romance Center
                </h1>
                <span className="rounded-full bg-pink-500/20 border border-pink-400/30 px-2 py-0.5 text-[10px] font-extrabold text-pink-300">
                  Official
                </span>
              </div>
              <p className="text-xs text-white/50">Soulmates, Exclusive Rings & Privileges</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchModalOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-pink-400/30 bg-pink-500/15 px-3 py-1.5 text-xs font-bold text-pink-200 hover:bg-pink-500/25 transition-all shadow-sm shadow-pink-500/20"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Propose</span>
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 hover:text-white transition-all disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-pink-400" : ""}`} />
            </button>
          </div>
        </header>

        {/* Global Notifications / Alert Banner (Incoming Proposals & Breakup Requests) */}
        {incoming.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-950/60 via-pink-950/40 to-purple-950/60 p-3.5 shadow-xl shadow-amber-500/10">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-xl animate-bounce">
                  💌
                </span>
                <div>
                  <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider">
                    {incoming.length} Incoming CP Proposal{incoming.length > 1 ? "s" : ""}
                  </h4>
                  <p className="text-xs text-zinc-300">
                    <strong className="text-white">{incoming[0].person.username || "A JALWA User"}</strong> has proposed to be your CP!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openPerson(incoming[0].person)}
                className="shrink-0 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 px-3.5 py-1.5 text-xs font-black text-black shadow-md hover:brightness-110"
              >
                View
              </button>
            </div>
          </div>
        )}

        {/* Breakup Request Warning */}
        {myRelation && (() => {
          const pending = breakupRequests.find((r) => r.relation_id === myRelation.id);
          if (!pending) return null;
          if (pending.requester_id === userId) {
            return (
              <div className="mt-3 flex items-center justify-between rounded-2xl border border-amber-400/30 bg-amber-950/40 p-3.5 text-xs text-amber-200">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0 text-amber-400" />
                  <span>Breakup request is pending your partner's approval.</span>
                </div>
              </div>
            );
          }
          return (
            <div className="mt-3 rounded-2xl border border-rose-500/40 bg-rose-950/60 p-3.5">
              <p className="text-xs font-black text-rose-300">Your partner has sent a request to end this CP.</p>
              <div className="mt-2.5 flex gap-2">
                <button
                  type="button"
                  disabled={breakupBusy}
                  onClick={() => void handleBreakupResponse(pending.id, true)}
                  className="flex-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-500"
                >
                  Accept Breakup
                </button>
                <button
                  type="button"
                  disabled={breakupBusy}
                  onClick={() => void handleBreakupResponse(pending.id, false)}
                  className="flex-1 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs font-bold text-white"
                >
                  Reject & Keep CP
                </button>
              </div>
            </div>
          );
        })()}

        {/* Romantic Segmented Tab Switcher */}
        <nav className="mt-4 flex rounded-2xl border border-white/10 bg-white/[0.04] p-1 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setActiveTab("space")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black transition-all ${
              activeTab === "space"
                ? "bg-gradient-to-r from-pink-600 via-rose-500 to-fuchsia-600 text-white shadow-lg shadow-pink-600/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Heart className={`h-3.5 w-3.5 ${activeTab === "space" ? "fill-white" : ""}`} />
            <span>CP Space</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ranking")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black transition-all ${
              activeTab === "ranking"
                ? "bg-gradient-to-r from-pink-600 via-rose-500 to-fuchsia-600 text-white shadow-lg shadow-pink-600/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Trophy className="h-3.5 w-3.5" />
            <span>Leaderboard</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rings")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black transition-all ${
              activeTab === "rings"
                ? "bg-gradient-to-r from-pink-600 via-rose-500 to-fuchsia-600 text-white shadow-lg shadow-pink-600/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Crown className="h-3.5 w-3.5" />
            <span>Rings & Privileges</span>
          </button>
        </nav>

        {/* TAB 1: CP SPACE & ROMANCE NEST */}
        {activeTab === "space" && (
          <section className="mt-4 space-y-4">
            {myRelation ? (
              <CpSpaceView userId={userId} onOpenBreakupDialog={handleBreakupRequest} />
            ) : (
              /* High-Converting Glamorous Soulmate Banner when Single */
              <div className="relative overflow-hidden rounded-3xl border border-pink-500/30 bg-gradient-to-b from-[#260c38]/70 via-[#180927]/90 to-[#0e0417] p-6 text-center shadow-2xl backdrop-blur-xl">
                <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 h-36 w-36 rounded-full bg-pink-500/25 blur-3xl" />
                <div className="relative z-10 flex flex-col items-center">
                  <div className="relative mb-3 flex items-center justify-center">
                    <span className="flex h-20 w-20 items-center justify-center rounded-3xl border border-pink-400/40 bg-pink-500/10 text-4xl shadow-xl shadow-pink-500/30 animate-pulse">
                      💍
                    </span>
                    <span className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-rose-400 text-xs shadow-md">
                      ✨
                    </span>
                  </div>

                  <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-200 via-rose-200 to-amber-200">
                    Find Your Special Soulmate
                  </h2>
                  <p className="mt-1.5 max-w-sm text-xs text-zinc-300 leading-relaxed">
                    Form an exclusive CP bond, unlock luxury voice room seat auras, share daily love diaries, and earn weekly ranking rewards!
                  </p>

                  {/* Highlights Grid */}
                  <div className="mt-5 grid grid-cols-3 gap-2 w-full text-left">
                    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3 text-center">
                      <span className="text-lg">👑</span>
                      <p className="mt-1 text-[11px] font-black text-pink-300">Mic Seat Aura</p>
                      <p className="text-[10px] text-zinc-400">Glow in rooms</p>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3 text-center">
                      <span className="text-lg">📖</span>
                      <p className="mt-1 text-[11px] font-black text-rose-300">Love Nest</p>
                      <p className="text-[10px] text-zinc-400">Photos & diary</p>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3 text-center">
                      <span className="text-lg">🎁</span>
                      <p className="mt-1 text-[11px] font-black text-amber-300">Gift Waivers</p>
                      <p className="text-[10px] text-zinc-400">Up to 15% off</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSearchModalOpen(true)}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-500 to-amber-400 p-3.5 text-sm font-black text-white shadow-xl shadow-pink-600/30 hover:brightness-110 active:scale-[0.98] transition-all"
                  >
                    <span>Send Proposal by JALWA ID</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB 2: WEEKLY INTIMACY LEADERBOARD (3D PODIUM) */}
        {activeTab === "ranking" && (
          <section className="mt-4 space-y-4">
            <div className="relative overflow-hidden rounded-3xl border border-pink-500/20 bg-gradient-to-b from-[#210c32]/80 via-[#130720]/90 to-[#0b0313] p-5 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-pink-200 to-rose-300">
                    <Trophy className="h-4 w-4 text-amber-400" />
                    Weekly CP Leaderboard
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Resets every Sunday at 00:00 (Saudi Arabia Time)
                  </p>
                </div>
                <span className="rounded-full bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 text-[10px] font-bold text-amber-300">
                  Top 3 Win Badges
                </span>
              </div>

              {/* 3D Olympic-Style CP Podium for Top 3 */}
              {top3.length > 0 ? (
                <div className="mt-6 mb-4 flex items-end justify-center gap-2 sm:gap-4 px-2">
                  {/* Rank 2 (Left) */}
                  {top3[1] && (
                    <div className="flex flex-1 flex-col items-center text-center">
                      <div className="relative mb-2">
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-300 px-2 py-0.5 text-[9px] font-black text-black shadow-md">
                          #2
                        </span>
                        <div className="flex -space-x-3">
                          <img
                            src={rankProfiles[top3[1].user1_id]?.avatar || "/avatar-placeholder.png"}
                            alt=""
                            className="h-11 w-11 rounded-full border-2 border-slate-300 object-cover shadow-lg"
                          />
                          <img
                            src={rankProfiles[top3[1].user2_id]?.avatar || "/avatar-placeholder.png"}
                            alt=""
                            className="h-11 w-11 rounded-full border-2 border-slate-300 object-cover shadow-lg"
                          />
                        </div>
                      </div>
                      <p className="max-w-[80px] truncate text-[11px] font-bold text-zinc-200">
                        {rankProfiles[top3[1].user1_id]?.username || "CP"} & {rankProfiles[top3[1].user2_id]?.username || "CP"}
                      </p>
                      <div className="mt-2 w-full rounded-t-2xl border-t border-x border-slate-400/30 bg-gradient-to-b from-slate-600/30 to-slate-900/50 pt-3 pb-4">
                        <span className="flex items-center justify-center gap-1 text-[11px] font-black text-slate-200">
                          <Flame className="h-3 w-3 text-slate-300 fill-slate-300" />
                          {top3[1].weekly_intimacy.toLocaleString()}
                        </span>
                        <span className="text-[9px] text-zinc-400">Silver CP</span>
                      </div>
                    </div>
                  )}

                  {/* Rank 1 (Center, Taller, Gold) */}
                  {top3[0] && (
                    <div className="flex flex-[1.2] flex-col items-center text-center -mt-4">
                      <div className="relative mb-2">
                        <Crown className="absolute -top-6 left-1/2 -translate-x-1/2 h-7 w-7 text-amber-300 fill-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)] animate-bounce" />
                        <span className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 px-2.5 py-0.5 text-[10px] font-black text-black shadow-lg">
                          #1
                        </span>
                        <div className="flex -space-x-3 mt-2">
                          <img
                            src={rankProfiles[top3[0].user1_id]?.avatar || "/avatar-placeholder.png"}
                            alt=""
                            className="h-14 w-14 rounded-full border-2 border-amber-300 object-cover shadow-xl shadow-amber-400/20"
                          />
                          <img
                            src={rankProfiles[top3[0].user2_id]?.avatar || "/avatar-placeholder.png"}
                            alt=""
                            className="h-14 w-14 rounded-full border-2 border-amber-300 object-cover shadow-xl shadow-amber-400/20"
                          />
                        </div>
                      </div>
                      <p className="max-w-[100px] truncate text-xs font-black text-amber-200">
                        {rankProfiles[top3[0].user1_id]?.username || "CP"} & {rankProfiles[top3[0].user2_id]?.username || "CP"}
                      </p>
                      <div className="mt-2 w-full rounded-t-2xl border-t border-x border-amber-400/40 bg-gradient-to-b from-amber-500/25 to-yellow-950/60 pt-4 pb-6 shadow-xl shadow-amber-500/10">
                        <span className="flex items-center justify-center gap-1 text-xs font-black text-amber-300">
                          <Flame className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                          {top3[0].weekly_intimacy.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-bold text-amber-200">Champion Couple</span>
                      </div>
                    </div>
                  )}

                  {/* Rank 3 (Right, Bronze) */}
                  {top3[2] && (
                    <div className="flex flex-1 flex-col items-center text-center">
                      <div className="relative mb-2">
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-700 px-2 py-0.5 text-[9px] font-black text-amber-100 shadow-md">
                          #3
                        </span>
                        <div className="flex -space-x-3">
                          <img
                            src={rankProfiles[top3[2].user1_id]?.avatar || "/avatar-placeholder.png"}
                            alt=""
                            className="h-11 w-11 rounded-full border-2 border-amber-700 object-cover shadow-lg"
                          />
                          <img
                            src={rankProfiles[top3[2].user2_id]?.avatar || "/avatar-placeholder.png"}
                            alt=""
                            className="h-11 w-11 rounded-full border-2 border-amber-700 object-cover shadow-lg"
                          />
                        </div>
                      </div>
                      <p className="max-w-[80px] truncate text-[11px] font-bold text-zinc-200">
                        {rankProfiles[top3[2].user1_id]?.username || "CP"} & {rankProfiles[top3[2].user2_id]?.username || "CP"}
                      </p>
                      <div className="mt-2 w-full rounded-t-2xl border-t border-x border-amber-800/40 bg-gradient-to-b from-amber-900/30 to-amber-950/50 pt-2.5 pb-3">
                        <span className="flex items-center justify-center gap-1 text-[11px] font-black text-amber-400">
                          <Flame className="h-3 w-3 text-amber-600 fill-amber-600" />
                          {top3[2].weekly_intimacy.toLocaleString()}
                        </span>
                        <span className="text-[9px] text-zinc-400">Bronze CP</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-zinc-400">
                  <p className="text-3xl mb-2">🏆</p>
                  <p className="text-sm font-bold text-zinc-300">No couples on the podium this week yet</p>
                  <p className="text-xs text-zinc-500 mt-1">Send romantic gifts in voice rooms to reach #1!</p>
                </div>
              )}

              {/* Ranks 4+ List */}
              {remainingRanks.length > 0 && (
                <div className="mt-4 space-y-2 pt-3 border-t border-white/5">
                  {remainingRanks.map((row) => {
                    const u1 = rankProfiles[row.user1_id];
                    const u2 = rankProfiles[row.user2_id];
                    return (
                      <div
                        key={row.relation_id}
                        className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] p-3 hover:bg-white/[0.06] transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/5 text-xs font-black text-zinc-300">
                            {row.rank}
                          </span>
                          <div className="flex -space-x-2 shrink-0">
                            <img
                              src={u1?.avatar || "/avatar-placeholder.png"}
                              alt=""
                              className="h-8 w-8 rounded-full border border-pink-400/40 object-cover"
                            />
                            <img
                              src={u2?.avatar || "/avatar-placeholder.png"}
                              alt=""
                              className="h-8 w-8 rounded-full border border-purple-400/40 object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-white">
                              {u1?.username || "CP"} ♥ {u2?.username || "CP"}
                            </p>
                            <span className="text-[10px] text-pink-300">Level {row.level} CP</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="flex items-center justify-end gap-1 text-xs font-black text-rose-300">
                            <Flame className="h-3 w-3 text-rose-400 fill-rose-400" />
                            {row.weekly_intimacy.toLocaleString()}
                          </span>
                          <span className="text-[9px] text-zinc-500">weekly</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* TAB 3: RINGS & PRIVILEGES SHOWCASE */}
        {activeTab === "rings" && (
          <section className="mt-4 space-y-4">
            <div className="rounded-3xl border border-pink-500/20 bg-gradient-to-b from-[#1f0b2f]/80 via-[#12061e]/90 to-[#0a0211] p-5 shadow-2xl backdrop-blur-xl">
              <div className="text-center max-w-sm mx-auto mb-6">
                <span className="inline-block rounded-full bg-pink-500/20 border border-pink-400/30 px-3 py-1 text-xs font-black text-pink-300">
                  Couple Privileges
                </span>
                <h3 className="mt-2 text-lg font-black text-white">Choose Your Proposal Ring</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Higher tier rings grant exclusive animated room frames, custom chat badges, and gift fee waivers.
                </p>
              </div>

              {/* Tiers Cards */}
              <div className="space-y-3.5">
                {/* Silver Tier */}
                <div className="rounded-2xl border border-slate-400/30 bg-gradient-to-r from-slate-900/60 to-slate-950/80 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-400/10 text-2xl border border-slate-400/30 shadow-md">
                        💍
                      </span>
                      <div>
                        <h4 className="text-sm font-black text-slate-100">Silver Promise Ring</h4>
                        <p className="text-xs text-amber-300 font-bold">5,000 Coins</p>
                      </div>
                    </div>
                    <span className="rounded-xl bg-slate-800 px-2.5 py-1 text-[10px] font-black text-slate-300">
                      Tier 1
                    </span>
                  </div>
                  <ul className="mt-3.5 space-y-1.5 text-xs text-zinc-300 border-t border-white/5 pt-3">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-pink-400 shrink-0" />
                      <span>Silver Heart Voice Room Seat Aura</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-pink-400 shrink-0" />
                      <span>Sweetheart Couple Chat Badge in rooms</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-pink-400 shrink-0" />
                      <span>5% Romantic gift fee discount</span>
                    </li>
                  </ul>
                </div>

                {/* Gold Tier */}
                <div className="relative rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-950/40 to-yellow-950/60 p-4 shadow-lg shadow-amber-500/10">
                  <span className="absolute -top-2.5 right-4 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 px-3 py-0.5 text-[10px] font-black text-black shadow-md">
                    POPULAR
                  </span>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/20 text-2xl border border-amber-400/40 shadow-md animate-pulse">
                        👑
                      </span>
                      <div>
                        <h4 className="text-sm font-black text-amber-200">Gold Devotion Ring</h4>
                        <p className="text-xs text-amber-300 font-bold">20,000 Coins</p>
                      </div>
                    </div>
                    <span className="rounded-xl bg-amber-500/20 px-2.5 py-1 text-[10px] font-black text-amber-300">
                      Tier 2
                    </span>
                  </div>
                  <ul className="mt-3.5 space-y-1.5 text-xs text-zinc-300 border-t border-white/5 pt-3">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span>Radiant Golden Mic Seat Aura with particles</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span>Golden Crown Chat Badge</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span>10% Romantic gift fee discount</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span>App-wide room entry notification</span>
                    </li>
                  </ul>
                </div>

                {/* Diamond Tier */}
                <div className="relative rounded-2xl border border-fuchsia-400/50 bg-gradient-to-r from-fuchsia-950/50 via-purple-950/60 to-pink-950/50 p-4 shadow-xl shadow-fuchsia-500/20">
                  <span className="absolute -top-2.5 right-4 rounded-full bg-gradient-to-r from-fuchsia-400 via-pink-400 to-rose-300 px-3 py-0.5 text-[10px] font-black text-black shadow-md">
                    LUXURY SUPREME
                  </span>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-fuchsia-500/20 text-2xl border border-fuchsia-400/50 shadow-md">
                        💎
                      </span>
                      <div>
                        <h4 className="text-sm font-black text-fuchsia-100">Diamond Sovereign Ring</h4>
                        <p className="text-xs text-amber-300 font-bold">50,000 Coins</p>
                      </div>
                    </div>
                    <span className="rounded-xl bg-fuchsia-500/20 px-2.5 py-1 text-[10px] font-black text-fuchsia-300">
                      Tier 3
                    </span>
                  </div>
                  <ul className="mt-3.5 space-y-1.5 text-xs text-zinc-300 border-t border-white/5 pt-3">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-fuchsia-400 shrink-0" />
                      <span>Diamond Sovereign Animated Mic Aura</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-fuchsia-400 shrink-0" />
                      <span>Supreme Diamond Chat Badge</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-fuchsia-400 shrink-0" />
                      <span>15% Romantic gift fee discount</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-fuchsia-400 shrink-0" />
                      <span>Full-screen Marquee broadcast upon proposal accept</span>
                    </li>
                  </ul>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSearchModalOpen(true)}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-500 to-amber-400 p-3.5 text-sm font-black text-white shadow-xl shadow-pink-600/30 hover:brightness-110 active:scale-[0.98] transition-all"
              >
                <span>Choose a Partner & Propose</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}
      </div>

      {/* Romantic Search / Propose Modal */}
      {searchModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-sm rounded-3xl border border-pink-500/30 bg-gradient-to-b from-[#21092e] to-[#110419] p-6 text-white shadow-2xl animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => {
                setSearchModalOpen(false);
                setError("");
              }}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="text-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/20 text-2xl shadow-lg shadow-pink-500/20">
                💌
              </span>
              <h3 className="mt-3 text-lg font-black text-white">Find Partner to Propose</h3>
              <p className="mt-1 text-xs text-zinc-400">
                Enter your partner's unique JALWA User ID code to view their profile and send a proposal ring.
              </p>
            </div>

            <form
              className="mt-5 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void findPerson();
              }}
            >
              <input
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                placeholder="Enter partner's JALWA ID (e.g. 10429)"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
              />

              {error && (
                <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={searching || !searchCode.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-500 to-amber-400 py-3 text-sm font-black text-white shadow-lg shadow-pink-600/30 hover:brightness-110 disabled:opacity-50 transition-all"
              >
                <Search className="h-4 w-4" />
                <span>{searching ? "Searching…" : "View Profile & Propose"}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Existing Profile Modal & Ring Modal */}
      <CpProfileModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        currentUserId={userId}
        targetUser={target ?? { id: "", username: null }}
      />
    </main>
  );
}
