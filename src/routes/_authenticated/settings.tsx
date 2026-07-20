import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LevelAvatar } from "@/components/LevelAvatar";
import {
  Camera,
  Loader2,
  User as UserIcon,
  AtSign,
  FileText,
  Globe2,
  Lock,
  Save,
  Sparkles,
  Venus,
  Mars,
  CircleDot,
  Sun,
  Moon,
} from "lucide-react";
import { useThemeMode } from "@/hooks/useThemeMode";


export const Route = createFileRoute("/_authenticated/settings")({ component: Page });

function Page() {
  const { user, profile, refresh } = useAuth() as any;
  const { mode, setMode } = useThemeMode();
  const [username, setUsername] = useState("");

  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other">("other");
  const [country, setCountry] = useState("");
  const [pw, setPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username ?? "");
    setFullName(profile.full_name ?? "");
    setBio(profile.bio ?? "");
    setAvatar(profile.avatar ?? "");
    setGender((profile.gender as any) ?? "other");
    setCountry(profile.country ?? "");
  }, [profile]);

  async function onPickAvatar(file: File) {
    if (!user) return;
    if (!file.type.startsWith("image/")) return toast.error("Please pick an image");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5 MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = pub.publicUrl;
      setAvatar(url);
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar: url })
        .eq("id", user.id);
      if (dbErr) throw dbErr;
      toast.success("Photo updated ✨");
      refresh?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ username, full_name: fullName, bio, gender, country })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    refresh?.();
  }

  async function changePassword() {
    if (pw.length < 6) return toast.error("Password must be 6+ chars");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    setPw("");
  }

  const level = profile?.vip_level ?? 0;

  return (
    <>
      <AppShell title="Edit Profile">
        <div className="space-y-5 px-4 pb-8 pt-4">
          {/* Hero avatar card */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a0b2e] via-[#2d0b4d] to-[#050510] p-6 text-white shadow-2xl">
            <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-[color:var(--primary)]/30 opacity-40 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-[color:var(--secondary)]/30 opacity-30 blur-3xl" />

            <div className="relative flex flex-col items-center text-center">
              <div className="relative">
                <LevelAvatar src={avatar} name={username} level={level} size="xl" showBadge />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  aria-label="Change photo"
                  className="glow-4d absolute -right-1 -bottom-1 grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[color:var(--gold)] via-[color:var(--primary)] to-[color:var(--secondary)] text-white shadow-lg ring-2 ring-black/60 disabled:opacity-60"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onPickAvatar(f);
                  }}
                />
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/90 backdrop-blur disabled:opacity-60"
              >
                <Sparkles className="h-3 w-3 text-[color:var(--gold)]" />
                {uploading ? "Uploading…" : "Upload from device"}
              </button>
              <p className="mt-2 text-[10px] text-white/50">JPG / PNG / WEBP · up to 5 MB</p>
            </div>
          </div>

          {/* Profile info card */}
          <div className="space-y-4 rounded-3xl border border-border bg-card/70 p-5 backdrop-blur">
            <SectionTitle icon={<UserIcon className="h-3.5 w-3.5" />} title="Profile info" />
            <FancyField
              icon={<AtSign className="h-4 w-4" />}
              label="Username"
              value={username}
              onChange={setUsername}
              placeholder="your_handle"
            />
            <FancyField
              icon={<UserIcon className="h-4 w-4" />}
              label="Full name"
              value={fullName}
              onChange={setFullName}
              placeholder="Your name"
            />
            <FancyField
              icon={<FileText className="h-4 w-4" />}
              label="Bio"
              value={bio}
              onChange={setBio}
              placeholder="Tell people about you…"
              textarea
            />
            <FancyField
              icon={<Globe2 className="h-4 w-4" />}
              label="Country"
              value={country}
              onChange={setCountry}
              placeholder="e.g. Pakistan"
            />

            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Gender
              </label>
              <div className="grid grid-cols-3 gap-2">
                <GenderChip active={gender === "male"} onClick={() => setGender("male")} icon={<Mars className="h-4 w-4" />} label="Male" />
                <GenderChip active={gender === "female"} onClick={() => setGender("female")} icon={<Venus className="h-4 w-4" />} label="Female" />
                <GenderChip active={gender === "other"} onClick={() => setGender("other")} icon={<CircleDot className="h-4 w-4" />} label="Other" />
              </div>
            </div>

            <button
              onClick={save}
              disabled={saving}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[color:var(--primary)] via-[color:var(--secondary)] to-[color:var(--primary)] py-3 text-sm font-black text-white shadow-lg shadow-[color:var(--primary)]/30 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>

          {/* Password card */}
          <div className="space-y-4 rounded-3xl border border-border bg-card/70 p-5 backdrop-blur">
            <SectionTitle icon={<Lock className="h-3.5 w-3.5" />} title="Security" />
            <FancyField
              icon={<Lock className="h-4 w-4" />}
              label="New password"
              value={pw}
              onChange={setPw}
              placeholder="At least 6 characters"
              type="password"
            />
            <button
              onClick={changePassword}
              className="w-full rounded-2xl border border-[color:var(--primary)]/60 bg-[color:var(--primary)]/10 py-3 text-sm font-bold text-[color:var(--primary)]"
            >
              Update Password
            </button>
          </div>
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-6 w-6 place-items-center rounded-lg bg-[color:var(--primary)]/15 text-[color:var(--primary)]">
        {icon}
      </span>
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{title}</p>
    </div>
  );
}

function FancyField({
  icon,
  label,
  value,
  onChange,
  placeholder,
  textarea,
  type = "text",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      <div className="group relative">
        <span className="pointer-events-none absolute left-3 top-3 text-muted-foreground group-focus-within:text-[color:var(--primary)]">
          {icon}
        </span>
        {textarea ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className="w-full resize-none rounded-2xl border border-border bg-background/60 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[color:var(--primary)]/60 focus:ring-2 focus:ring-[color:var(--primary)]/20"
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-2xl border border-border bg-background/60 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[color:var(--primary)]/60 focus:ring-2 focus:ring-[color:var(--primary)]/20"
          />
        )}
      </div>
    </div>
  );
}

function GenderChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-2xl border py-2.5 text-xs font-bold transition ${
        active
          ? "border-[color:var(--primary)] bg-gradient-to-br from-[color:var(--primary)]/25 to-[color:var(--secondary)]/25 text-white shadow-inner"
          : "border-border bg-background/60 text-muted-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
