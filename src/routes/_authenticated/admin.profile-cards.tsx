import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadFileAtPath } from "@/lib/uploads";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2, Upload, X } from "lucide-react";

type Card = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  rarity: string;
  bg_media_url: string;
  bg_media_type: string;
  bg_chromakey: string;
  thumbnail_url: string | null;
  frame_media_url: string | null;
  frame_media_type: string;
  frame_chromakey: string;
  frame_effect: string;
  accent_color: string;
  glow_color: string;
  particle_style: string;
  price_coins: number;
  price_diamonds: number;
  min_vip_level: number;
  profile_frame_required_level: number;
  duration_days: number | null;
  is_active: boolean;
  is_limited: boolean;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
};

const blank: Partial<Card> = {
  key: "",
  name: "",
  description: "",
  category: "Basic",
  rarity: "common",
  bg_media_url: "",
  bg_media_type: "image",
  bg_chromakey: "none",
  thumbnail_url: "",
  frame_media_url: "",
  frame_media_type: "none",
  frame_chromakey: "none",
  frame_effect: "gold",
  accent_color: "#ffd76a",
  glow_color: "#a855f7",
  particle_style: "sparkles",
  price_coins: 0,
  price_diamonds: 0,
  min_vip_level: 0,
  profile_frame_required_level: 0,
  duration_days: null,
  is_active: true,
  is_limited: false,
  sort_order: 0,
};

function MediaPreview({
  url,
  type,
  className = "",
}: {
  url?: string | null;
  type?: string;
  className?: string;
}) {
  if (!url) {
    return (
      <div className={`grid place-items-center rounded-xl bg-muted ${className}`}>
        No media
      </div>
    );
  }

  if (type === "mp4" || type === "webm") {
    return (
      <video
        src={url}
        autoPlay
        muted
        loop
        playsInline
        className={`rounded-xl object-contain ${className}`}
      />
    );
  }

  return (
    <img
      src={url}
      className={`rounded-xl object-contain ${className}`}
      alt=""
    />
  );
}

function mediaTypeForFile(file: File) {
  if (file.type === "video/mp4") return "mp4";
  if (file.type === "video/webm") return "webm";
  return "image";
}

function Page() {
  const [rows, setRows] = useState<Card[]>([]);
  const [edit, setEdit] = useState<Partial<Card> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("profile_cards")
      .select("*")
      .order("sort_order")
      .order("created_at");

    if (error) {
      toast.error(error.message);
      return;
    }

    setRows((data ?? []) as Card[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const setField = (key: keyof Card, value: unknown) => {
    setEdit((current) => (current ? { ...current, [key]: value } : current));
  };

  const upload = async (
    key: "bg_media_url" | "thumbnail_url" | "frame_media_url",
    file: File,
  ) => {
    if (!edit) return;

    const isThumbnail = key === "thumbnail_url";
    const allowed = isThumbnail
      ? file.type.startsWith("image/")
      : file.type.startsWith("image/") ||
        file.type === "video/mp4" ||
        file.type === "video/webm";

    if (!allowed) {
      toast.error(
        "Use PNG/JPG for thumbnails, or PNG/JPG/MP4/WebM for media and frames.",
      );
      return;
    }

    try {
      const safeName = file.name.replace(/[^\\w.-]+/g, "_");
      const path = `profile-cards/${Date.now()}_${safeName}`;
      const url = await uploadFileAtPath("shop-assets", path, file);

      setField(key, url);

      if (key === "bg_media_url") {
        setField("bg_media_type", mediaTypeForFile(file));
      }

      if (key === "frame_media_url") {
        setField("frame_media_type", mediaTypeForFile(file));
      }

      toast.success("Uploaded to R2");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    }
  };

  const save = async () => {
    if (!edit?.key?.trim() || !edit.name?.trim()) {
      toast.error("Key and name are required");
      return;
    }

    if (!edit.bg_media_url?.trim()) {
      toast.error("Background media is required");
      return;
    }

    setBusy(true);

    const payload = { ...edit };
    delete (payload as { id?: string }).id;
    delete (payload as { created_at?: string }).created_at;
    delete (payload as { updated_at?: string }).updated_at;

    const rpcPayload = edit.id ? { ...payload, id: edit.id } : payload;
    const result = await supabase.rpc("admin_upsert_profile_card", {
      _payload: rpcPayload,
    });

    setBusy(false);

    if (result.error) {
      toast.error(result.error.message);
      return;
    }

    toast.success("Profile Card saved");
    setEdit(null);
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this Profile Card?")) return;

    const result = await supabase.rpc("admin_delete_profile_card", {
      _id: id,
    });

    if (result.error) {
      toast.error(result.error.message);
      return;
    }

    toast.success("Profile Card deleted");
    void load();
  };

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Profile Card Frames</h1>
          <p className="text-xs text-muted-foreground">
            Outer card frames are automatic level rewards. Users cannot manually equip them. User DP Frames stay completely separate.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setEdit({ ...blank })}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-bold"
        >
          <Plus className="mr-1 inline h-4 w-4" />
          New
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {rows.map((card) => (
          <div
            key={card.id}
            className="rounded-2xl border border-border bg-card p-3"
          >
            <MediaPreview
              url={card.thumbnail_url || card.bg_media_url}
              type={card.thumbnail_url ? "image" : card.bg_media_type}
              className="h-32 w-full"
            />

            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="font-bold">{card.name}</p>
              {card.frame_media_url ? (
                <span className="rounded-full border px-2 py-0.5 text-[10px]">
                  Outer Frame
                </span>
              ) : null}
            </div>

            <p className="text-xs text-muted-foreground">
              {card.category} · {card.rarity} · Auto Lv {card.profile_frame_required_level ?? 0}
            </p>

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setEdit(card)}
                className="flex-1 rounded-lg border py-2 text-xs"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void remove(card.id)}
                className="rounded-lg border border-red-500/30 px-3 text-red-400"
                aria-label={`Delete ${card.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {edit ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">
                  {edit.id ? "Edit" : "New"} Profile Card
                </h2>
                <p className="text-xs text-muted-foreground">
                  Upload the frame that wraps the card&apos;s outside edge.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEdit(null)}
                aria-label="Close"
              >
                <X />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              {(
                [
                  ["key", "Key"],
                  ["name", "Name"],
                  ["description", "Description"],
                  ["category", "Category"],
                  ["bg_media_url", "Background URL"],
                  ["thumbnail_url", "Thumbnail URL"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="space-y-1">
                  <span className="text-xs font-semibold">{label}</span>

                  <div className="flex gap-1">
                    <input
                      value={(edit as Record<string, unknown>)[key] as string ?? ""}
                      onChange={(event) => setField(key, event.target.value)}
                      className="w-full rounded-lg border bg-background px-2 py-2 text-xs"
                    />

                    {key === "bg_media_url" || key === "thumbnail_url" ? (
                      <label className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border">
                        <Upload className="h-4 w-4" />
                        <input
                          type="file"
                          accept={
                            key === "thumbnail_url"
                              ? "image/*"
                              : "image/*,video/mp4,video/webm"
                          }
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void upload(key, file);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                    ) : null}
                  </div>
                </label>
              ))}

              <div className="col-span-1 rounded-xl border border-primary/30 bg-primary/5 p-3 sm:col-span-2">
                <span className="text-xs font-bold">
                  Outer Profile Card Frame Asset
                </span>

                <div className="mt-2 flex gap-2">
                  <input
                    value={edit.frame_media_url ?? ""}
                    onChange={(event) =>
                      setField("frame_media_url", event.target.value)
                    }
                    placeholder="PNG / MP4 / WebM URL"
                    className="w-full rounded-lg border bg-background px-2 py-2 text-xs"
                  />

                  <label className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border">
                    <Upload className="h-4 w-4" />
                    <input
                      type="file"
                      accept="image/*,video/mp4,video/webm"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void upload("frame_media_url", file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>

                <p className="mt-1 text-[10px] text-muted-foreground">
                  PNG/JPG = static frame. MP4/WebM = animated frame with
                  autoplay and loop.
                </p>

                {edit.frame_media_url ? (
                  <MediaPreview
                    url={edit.frame_media_url}
                    type={edit.frame_media_type}
                    className="mt-2 h-28 w-full bg-black/20"
                  />
                ) : null}
              </div>

              <label className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                <span className="text-xs font-bold">Automatic Profile Card Frame Level</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={edit.profile_frame_required_level ?? 0}
                  onChange={(event) => setField("profile_frame_required_level", Math.max(0, Number(event.target.value) || 0))}
                  className="mt-1 w-full rounded-lg border bg-background p-2"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  When the user reaches this level, this outer frame is automatically applied. The user cannot equip it manually.
                </p>
              </label>

              <label>
                <span className="text-xs">Frame Media Type</span>
                <select
                  value={edit.frame_media_type || "none"}
                  onChange={(event) =>
                    setField("frame_media_type", event.target.value)
                  }
                  className="w-full rounded-lg border bg-background p-2"
                >
                  {["none", "image", "mp4", "webm"].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="text-xs">Frame Chroma Key</span>
                <select
                  value={edit.frame_chromakey || "none"}
                  onChange={(event) =>
                    setField("frame_chromakey", event.target.value)
                  }
                  className="w-full rounded-lg border bg-background p-2"
                >
                  {["none", "green", "black", "luma"].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="text-xs">Media Type</span>
                <select
                  value={edit.bg_media_type || "image"}
                  onChange={(event) =>
                    setField("bg_media_type", event.target.value)
                  }
                  className="w-full rounded-lg border bg-background p-2"
                >
                  {["builtin", "image", "mp4", "webm", "lottie", "svga"].map(
                    (value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span className="text-xs">Background Chroma Key</span>
                <select
                  value={edit.bg_chromakey || "none"}
                  onChange={(event) =>
                    setField("bg_chromakey", event.target.value)
                  }
                  className="w-full rounded-lg border bg-background p-2"
                >
                  {["none", "green", "black", "luma"].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              {(
                [
                  ["price_coins", "Coins"],
                  ["price_diamonds", "Diamonds"],
                  ["min_vip_level", "Min VIP"],
                  ["duration_days", "Duration Days"],
                  ["sort_order", "Sort Order"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <span className="text-xs">{label}</span>
                  <input
                    type="number"
                    value={(edit as Record<string, unknown>)[key] as number ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      setField(key, value === "" ? null : Number(value));
                    }}
                    className="w-full rounded-lg border bg-background p-2"
                  />
                </label>
              ))}

              <label className="col-span-1 flex gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={!!edit.is_active}
                  onChange={(event) =>
                    setField("is_active", event.target.checked)
                  }
                />
                Active
              </label>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="mt-4 w-full rounded-xl bg-primary py-3 font-bold disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="mr-1 inline h-4 w-4" />
                  Save Profile Card
                </>
              )}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/admin/profile-cards")({
  component: Page,
});
