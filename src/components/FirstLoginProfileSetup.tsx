import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Globe2, Loader2, Sparkles, UserRound } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { uploadFileAtPath } from "@/lib/uploads";
import { LevelAvatar } from "@/components/LevelAvatar";

const REGION_CODES = ("AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW").split(" ");
const DISPLAY_NAMES = new Intl.DisplayNames(["en"], { type: "region" });
const COUNTRIES = REGION_CODES.map((code) => ({ code, name: DISPLAY_NAMES.of(code) ?? code }))
  .sort((a, b) => a.name.localeCompare(b.name));

function flagFor(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return "🌍";
  return String.fromCodePoint(...[...code].map((char) => 127397 + char.charCodeAt(0)));
}

function profileIsComplete(profile: { full_name?: string | null; username?: string | null; avatar?: string | null; country?: string | null; country_code?: string | null } | null) {
  return !!profile?.full_name?.trim() && !!profile?.avatar?.trim() && !!profile?.country?.trim() && /^[A-Z]{2}$/i.test(profile?.country_code ?? "");
}

/**
 * First-login onboarding. It is intentionally mounted at the app root so it
 * appears after auth/profile hydration regardless of the first destination.
 */
export function FirstLoginProfileSetup() {
  const { user, profile, loading, refresh } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [countryQuery, setCountryQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.full_name ?? "");
    setAvatar(profile.avatar ?? "");
    setCountryCode((profile.country_code ?? "").toUpperCase());
  }, [profile?.id]);

  const country = COUNTRIES.find((item) => item.code === countryCode);
  const filteredCountries = useMemo(() => {
    const query = countryQuery.trim().toLowerCase();
    if (!query) return COUNTRIES;
    return COUNTRIES.filter((item) => item.name.toLowerCase().includes(query) || item.code.toLowerCase() === query);
  }, [countryQuery]);

  const publicRoute = pathname === "/auth" || pathname === "/privacy" || pathname === "/terms" || pathname === "/splash";
  const needsSetup = !!user && !!profile && !profileIsComplete(profile) && !publicRoute && !pathname.startsWith("/room/");

  async function pickAvatar(file: File) {
    if (!user) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB."); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const url = await uploadFileAtPath("avatars", `${user.id}/avatar-${Date.now()}.${ext}`, file);
      setAvatar(url);
      toast.success("Profile photo uploaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Photo upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveProfile() {
    if (!user || saving) return;
    setAttempted(true);
    if (name.trim().length < 2) { toast.error("Please enter your name (at least 2 characters)."); return; }
    if (!avatar) { toast.error("Please upload your profile photo."); return; }
    if (!country) { toast.error("Please select your country."); return; }
    setSaving(true);
    try {
      // Save every onboarding field explicitly. Uploading a file only stores it
      // in Storage; it does not automatically update profiles.avatar.
      const { data: savedProfile, error } = await supabase
        .from("profiles")
        .update({
          full_name: name.trim(),
          avatar: avatar.trim(),
          country: country.name,
          country_code: country.code,
        })
        .eq("id", user.id)
        .select("id,full_name,avatar,country,country_code")
        .maybeSingle();
      if (error) throw error;
      if (!savedProfile) {
        throw new Error("Profile was not saved. Please check your connection and try again.");
      }
      await refresh();
      toast.success("Profile saved. Welcome to JALWA!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !needsSetup) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="jalwa-profile-setup-title">
      <div className="relative my-auto w-full max-w-md overflow-hidden rounded-[28px] border border-fuchsia-300/20 bg-[#100b19] text-white shadow-[0_25px_100px_rgba(0,0,0,.7)]">
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-br from-fuchsia-600/25 via-purple-500/10 to-transparent" />
        <div className="relative p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[.22em] text-fuchsia-300"><Sparkles className="h-4 w-4" /> Welcome to JALWA</div>
          <h2 id="jalwa-profile-setup-title" className="text-2xl font-black tracking-tight">Set up your profile</h2>
          <p className="mt-2 text-sm leading-5 text-white/60">Add your name, photo and country flag so friends can recognize you in rooms.</p>

          <div className="mt-5 flex flex-col items-center">
            <div className="relative">
              {avatar ? <img src={avatar} alt="Profile preview" className="h-24 w-24 rounded-full border-2 border-fuchsia-300/70 object-cover shadow-[0_0_28px_rgba(217,70,239,.25)]" /> : <div className="grid h-24 w-24 place-items-center rounded-full border-2 border-dashed border-white/25 bg-white/5"><UserRound className="h-9 w-9 text-white/40" /></div>}
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="absolute bottom-0 right-0 grid h-9 w-9 place-items-center rounded-full bg-fuchsia-500 text-white shadow-lg disabled:opacity-50" aria-label="Upload profile photo">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void pickAvatar(file); }} />
            </div>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="mt-2 text-xs font-semibold text-fuchsia-300">{uploading ? "Uploading photo…" : avatar ? "Change profile photo" : "Upload profile photo"}</button>
            {attempted && !avatar && <p className="mt-1 text-xs text-rose-300">Profile photo is required.</p>}
          </div>

          <label className="mt-5 block text-xs font-bold text-white/70">Your name</label>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} autoComplete="name" placeholder="Enter your name" className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/[.06] px-4 text-sm text-white outline-none placeholder:text-white/30 focus:border-fuchsia-400/70" />
          {attempted && name.trim().length < 2 && <p className="mt-1 text-xs text-rose-300">Enter at least 2 characters.</p>}

          <label className="mt-4 block text-xs font-bold text-white/70"><span className="inline-flex items-center gap-2"><Globe2 className="h-4 w-4" /> Country and flag</span></label>
          <div className="mt-2 flex h-12 items-center gap-2 rounded-xl border border-white/10 bg-white/[.06] px-3 focus-within:border-fuchsia-400/70">
            <span className="text-xl">{flagFor(countryCode)}</span>
            <input value={countryQuery || country?.name || ""} onChange={(event) => { setCountryQuery(event.target.value); setCountryCode(""); }} placeholder="Search country…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/30" />
            {countryCode && <button type="button" aria-label="Clear country" onClick={() => { setCountryCode(""); setCountryQuery(""); }} className="px-1 text-white/50">×</button>}
          </div>
          {(!countryCode || countryQuery) && (
            <div className="mt-2 max-h-36 overflow-y-auto rounded-xl border border-white/10 bg-[#171020]">
              {filteredCountries.slice(0, 70).map((item) => (
                <button type="button" key={item.code} onClick={() => { setCountryCode(item.code); setCountryQuery(""); }} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-fuchsia-500/15">
                  <span className="text-lg">{flagFor(item.code)}</span><span className="flex-1">{item.name}</span><span className="text-xs text-white/40">{item.code}</span>{countryCode === item.code && <Check className="h-4 w-4 text-fuchsia-300" />}
                </button>
              ))}
              {filteredCountries.length === 0 && <p className="p-3 text-sm text-white/50">No countries found.</p>}
            </div>
          )}
          {attempted && !country && <p className="mt-1 text-xs text-rose-300">Please choose a country.</p>}

          <button type="button" onClick={() => void saveProfile()} disabled={saving || uploading} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 text-sm font-extrabold shadow-lg shadow-fuchsia-950/30 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving profile…</> : <><Check className="h-4 w-4" /> Save and continue</>}
          </button>
          <p className="mt-3 text-center text-[11px] text-white/40">You can update your name and photo later in Edit Profile.</p>
        </div>
      </div>
    </div>
  );
}
