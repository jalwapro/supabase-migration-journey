import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({ component: Page });

function Page() {
  const { user, profile, refresh } = useAuth() as any;
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [gender, setGender] = useState("other");
  const [country, setCountry] = useState("");
  const [pw, setPw] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username ?? "");
    setFullName(profile.full_name ?? "");
    setBio(profile.bio ?? "");
    setAvatar(profile.avatar ?? "");
    setGender(profile.gender ?? "other");
    setCountry(profile.country ?? "");
  }, [profile]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ username, full_name: fullName, bio, avatar, gender, country })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    refresh?.();
  }

  async function changePassword() {
    if (pw.length < 6) return toast.error("Password must be 6+ chars");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    setPw("");
  }

  return (
    <>
      <AppShell title="Settings" showBack>
        <div className="space-y-4 px-4 pt-4">
          <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Profile</p>
            <Field label="Avatar URL" value={avatar} onChange={setAvatar} />
            <Field label="Username" value={username} onChange={setUsername} />
            <Field label="Full name" value={fullName} onChange={setFullName} />
            <Field label="Bio" value={bio} onChange={setBio} textarea />
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm outline-none"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <Field label="Country" value={country} onChange={setCountry} />
            <button
              onClick={save}
              disabled={saving}
              className="w-full rounded-xl bg-[color:var(--primary)] py-2.5 text-sm font-black text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>

          <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Password</p>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="New password"
              className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm outline-none"
            />
            <button
              onClick={changePassword}
              className="w-full rounded-xl border border-[color:var(--primary)] py-2.5 text-sm font-bold text-[color:var(--primary)]"
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

function Field({
  label,
  value,
  onChange,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm outline-none"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm outline-none"
        />
      )}
    </div>
  );
}
