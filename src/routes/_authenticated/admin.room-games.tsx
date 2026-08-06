import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Save, Trash2, Loader2, Eye, EyeOff, GripVertical } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { FileUploader } from "@/components/FileUploader";
import { useAdminRoomGames, useRoomGamesAdmin, type RoomGame } from "@/lib/roomGames";

/**
 * Admin → Room Games
 * --------------------
 * Add a game here and it instantly shows up as a PNG button in every
 * room's Games popup — no app redeploy needed. `game_url` can point to:
 *   - a game deployed on Vercel/GitHub Pages (e.g. https://my-game.vercel.app)
 *   - a static bundle's index.html uploaded into the R2 bucket
 * It opens inside an <iframe> in the room popup when a user taps it.
 */

export const Route = createFileRoute("/_authenticated/admin/room-games")({
  component: RoomGamesAdmin,
});

function RoomGamesAdmin() {
  const games = useAdminRoomGames();
  const { create, update, remove } = useRoomGamesAdmin();

  const [form, setForm] = useState({
    slug: "",
    name: "",
    icon_url: "" as string | null,
    game_url: "",
    sort_order: 100,
  });

  const addGame = () => {
    if (!form.slug.trim() || !form.name.trim() || !form.game_url.trim()) {
      toast.error("Slug, name and game link are required");
      return;
    }
    create.mutate(
      { ...form, icon_url: form.icon_url ?? null, enabled: true },
      {
        onSuccess: () => {
          toast.success("Game added");
          setForm({ slug: "", name: "", icon_url: "", game_url: "", sort_order: 100 });
        },
        onError: (e: Error) => toast.error(e.message),
      }
    );
  };

  return (
    <div className="pb-24">
      <AdminPageHeader title="Room games" subtitle="PNG icon + link — shown in every room's Games popup" />

      {/* Add new game */}
      <div className="mx-4 mb-5 rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <p className="text-xs font-black uppercase tracking-widest text-foreground/60">Add a game</p>

        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="slug (e.g. carrom)"
            value={form.slug}
            onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value.trim() }))}
            className="rounded-lg border border-border bg-input px-3 py-2 text-xs"
          />
          <input
            placeholder="Display name"
            value={form.name}
            onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            className="rounded-lg border border-border bg-input px-3 py-2 text-xs"
          />
        </div>

        <FileUploader
          bucket="room-games"
          folder="icons"
          accept="image/png,image/webp,image/jpeg"
          value={form.icon_url}
          onChange={(url) => setForm((s) => ({ ...s, icon_url: url }))}
          label="Upload PNG icon"
        />

        <input
          placeholder="Game link — https://your-game.vercel.app or R2 file URL"
          value={form.game_url}
          onChange={(e) => setForm((s) => ({ ...s, game_url: e.target.value.trim() }))}
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-xs"
        />

        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Order"
            value={form.sort_order}
            onChange={(e) => setForm((s) => ({ ...s, sort_order: Number(e.target.value) || 0 }))}
            className="w-24 rounded-lg border border-border bg-input px-3 py-2 text-xs"
          />
          <button
            onClick={addGame}
            disabled={create.isPending}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[color:var(--gold)] to-[color:var(--primary)] px-4 py-2 text-xs font-black uppercase tracking-widest text-primary-foreground disabled:opacity-50"
          >
            {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add
          </button>
        </div>
      </div>

      {/* Existing games */}
      <div className="mx-4 space-y-2">
        {games.isLoading && (
          <div className="grid place-items-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-[color:var(--gold)]" />
          </div>
        )}
        {games.data?.map((g) => (
          <GameRow key={g.id} game={g} onSave={update.mutate} onDelete={remove.mutate} />
        ))}
      </div>
    </div>
  );
}

function GameRow({
  game,
  onSave,
  onDelete,
}: {
  game: RoomGame;
  onSave: (patch: Partial<RoomGame> & { id: string }) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState(game);
  const dirty = JSON.stringify(draft) !== JSON.stringify(game);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-3">
        <GripVertical className="h-4 w-4 shrink-0 text-foreground/30" />
        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black/30">
          {draft.icon_url ? (
            <img src={draft.icon_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-lg">🎮</span>
          )}
        </div>
        <input
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          className="min-w-0 flex-1 rounded-lg border border-border bg-input px-2 py-1.5 text-xs font-bold"
        />
        <button
          onClick={() => setDraft((d) => ({ ...d, enabled: !d.enabled }))}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border"
          aria-label="Toggle enabled"
        >
          {draft.enabled ? <Eye className="h-4 w-4 text-emerald-400" /> : <EyeOff className="h-4 w-4 text-foreground/40" />}
        </button>
      </div>

      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
        <input
          value={draft.game_url}
          onChange={(e) => setDraft((d) => ({ ...d, game_url: e.target.value.trim() }))}
          className="min-w-0 rounded-lg border border-border bg-input px-2 py-1.5 text-[11px]"
        />
        <input
          type="number"
          value={draft.sort_order}
          onChange={(e) => setDraft((d) => ({ ...d, sort_order: Number(e.target.value) || 0 }))}
          className="w-16 rounded-lg border border-border bg-input px-2 py-1.5 text-[11px]"
        />
      </div>

      <div className="mt-2 flex items-center justify-end gap-2">
        {dirty && (
          <button
            onClick={() => onSave(draft)}
            className="flex items-center gap-1 rounded-lg bg-[color:var(--primary)] px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
          >
            <Save className="h-3.5 w-3.5" /> Save
          </button>
        )}
        <button
          onClick={() => {
            if (confirm(`Delete "${game.name}"?`)) onDelete(game.id);
          }}
          className="flex items-center gap-1 rounded-lg border border-red-500/40 px-3 py-1.5 text-[11px] font-bold text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>
    </div>
  );
}
