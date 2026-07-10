import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { uploadToUserFolder } from "@/lib/uploads";
import { ArrowLeft, Upload, Loader2, Coins, Clock, CheckCircle2, XCircle, Hourglass } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/custom-theme")({
  component: CustomThemePage,
});

type Submission = {
  id: string;
  image_url: string;
  status: "pending" | "approved" | "rejected" | "expired";
  coins_paid: number;
  admin_notes: string | null;
  expires_at: string | null;
  created_at: string;
};

function CustomThemePage() {
  const { profile, user, refresh } = useAuth();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const cfg = useQuery({
    queryKey: ["custom_theme_cfg"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("custom_theme_price_coins,custom_theme_duration_hours,custom_theme_enabled")
        .eq("id", "global")
        .maybeSingle();
      return data as {
        custom_theme_price_coins: number;
        custom_theme_duration_hours: number;
        custom_theme_enabled: boolean;
      } | null;
    },
  });

  const mine = useQuery({
    queryKey: ["my_custom_themes", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_themes")
        .select("id,image_url,status,coins_paid,admin_notes,expires_at,created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as Submission[];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!file || !user) throw new Error("Choose an image first");
      setUploading(true);
      const up = await uploadToUserFolder("shop-assets", file, user.id, "custom-themes");
      const { data, error } = await supabase.rpc("submit_custom_theme", { _image_url: up.url });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      toast.success("Submitted for admin approval");
      setFile(null);
      setPreview(null);
      await refresh();
      qc.invalidateQueries({ queryKey: ["my_custom_themes"] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setUploading(false),
  });

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) {
      toast.error("Image too large (max 8MB)");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  const price = cfg.data?.custom_theme_price_coins ?? 500;
  const hours = cfg.data?.custom_theme_duration_hours ?? 24;
  const enabled = cfg.data?.custom_theme_enabled ?? true;
  const canAfford = (profile?.coins ?? 0) >= price;
  const hasPending = mine.data?.some((m) => m.status === "pending");

  return (
    <>
      <AppShell
        title="Custom Theme"
        subtitle={`Upload your own background · ${hours}h after approval`}
        right={
          <Link to="/theme-shop" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full bg-card/60">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        }
      >
        <div className="space-y-4 px-4 pt-4">
          {!enabled && (
            <div className="glass rounded-2xl p-4 text-sm text-muted-foreground">
              Custom theme submissions are currently disabled.
            </div>
          )}

          <div className="glass rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              How it works
            </p>
            <ol className="mt-2 space-y-1 text-xs text-foreground/80">
              <li>1. Upload your image ({price.toLocaleString()} coins).</li>
              <li>2. Admin reviews it (usually within a few hours).</li>
              <li>3. If approved, it becomes your background for {hours} hours.</li>
              <li>4. If rejected, your coins are refunded.</li>
            </ol>
          </div>

          <div className="glass rounded-2xl p-4">
            <label className="block cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={onPick} disabled={!enabled || hasPending} />
              <div className="grid aspect-video place-items-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-input">
                {preview ? (
                  <img src={preview} alt="preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid place-items-center gap-1 text-muted-foreground">
                    <Upload className="h-6 w-6" />
                    <span className="text-xs">Tap to choose an image</span>
                    <span className="text-[10px]">JPG / PNG · max 8MB</span>
                  </div>
                )}
              </div>
            </label>

            <div className="mt-3 flex items-center gap-2 text-xs">
              <Coins className="h-4 w-4 text-[color:var(--gold)]" />
              <span className="font-bold">{price.toLocaleString()} coins</span>
              <span className="text-muted-foreground">
                · your balance: {(profile?.coins ?? 0).toLocaleString()}
              </span>
            </div>

            <button
              disabled={!file || !enabled || !canAfford || uploading || submit.isPending || hasPending}
              onClick={() => submit.mutate()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--primary)] py-3 text-sm font-black uppercase tracking-widest text-primary-foreground disabled:opacity-50"
            >
              {uploading || submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {hasPending
                ? "Pending review"
                : !canAfford
                ? "Not enough coins"
                : `Submit for ${price.toLocaleString()} coins`}
            </button>
          </div>

          <div className="glass rounded-2xl p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Your submissions
            </p>
            {mine.data?.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">No submissions yet</p>
            )}
            <div className="space-y-2">
              {mine.data?.map((m) => {
                const remaining =
                  m.status === "approved" && m.expires_at
                    ? Math.max(0, Math.floor((new Date(m.expires_at).getTime() - Date.now()) / 3600000))
                    : null;
                return (
                  <div key={m.id} className="flex gap-2 rounded-xl bg-card/40 p-2">
                    <img src={m.image_url} alt="" className="h-16 w-24 rounded object-cover" />
                    <div className="flex-1 text-xs">
                      <div className="flex items-center gap-1 font-bold">
                        {m.status === "pending" && <><Hourglass className="h-3 w-3 text-amber-400" /> Pending</>}
                        {m.status === "approved" && <><CheckCircle2 className="h-3 w-3 text-emerald-400" /> Approved</>}
                        {m.status === "rejected" && <><XCircle className="h-3 w-3 text-red-400" /> Rejected</>}
                        {m.status === "expired" && <><Clock className="h-3 w-3 text-muted-foreground" /> Expired</>}
                      </div>
                      <p className="text-muted-foreground">Paid {m.coins_paid} coins</p>
                      {remaining !== null && (
                        <p className="text-emerald-400">Active · {remaining}h left</p>
                      )}
                      {m.admin_notes && (
                        <p className="mt-1 text-red-400/80">"{m.admin_notes}"</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </AppShell>
      <BottomNav />
    </>
  );
}
