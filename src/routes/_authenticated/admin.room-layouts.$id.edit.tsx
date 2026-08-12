import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Save, Undo, Redo, Eye, Play, Settings, Layers, Plus,
  ArrowLeft, ZoomIn, ZoomOut, Smartphone, Tablet, Monitor,
  Lock, Unlock, Trash2, Copy, ArrowUp, ArrowDown,
} from "lucide-react";
import type { RoomType, LayoutJSON, LayoutElement, DevicePreset } from "@/lib/room-layouts";
import { DEVICE_PRESETS, DEFAULT_VOICE_LAYOUT, DEFAULT_VIDEO_LAYOUT, DEFAULT_PK_LAYOUT } from "@/lib/room-layouts";

export const Route = createFileRoute("/_authenticated/admin/room-layouts/$id/edit")({
  validateSearch: (search: Record<string, unknown>) => ({
    type: search["type"] === "video" || search["type"] === "pk" ? search["type"] : "voice",
  }),
  component: LayoutEditorPage,
});

function LayoutEditorPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const search = useSearch({ from: Route.id });
  const isNew = id === "new";
  const initialType = search.type as RoomType;

  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [device, setDevice] = useState<DevicePreset>(DEVICE_PRESETS[0]);
  const [history, setHistory] = useState<LayoutJSON[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isDirty, setIsDirty] = useState(false);

  // Fetch layout
  const { data: layout, isLoading } = useQuery({
    queryKey: ['room_layout', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('room_layouts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id && id !== 'new',
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (layoutJson: LayoutJSON) => {
      if (id === 'new') {
        // Create new layout
        const { data, error } = await supabase
          .from('room_layouts')
          .insert({
            name: 'Untitled Layout',
            type: initialType,
            layout_json: layoutJson,
            status: 'draft',
            version: 1,
            created_by: user?.id,
          })
          .select()
          .single();

        if (error) throw error;
        const { error: versionError } = await supabase.from('room_layout_versions').insert({
          layout_id: data.id,
          version: 1,
          layout_json: layoutJson,
          created_by: user?.id,
          change_description: 'Initial layout',
        });
        if (versionError) throw versionError;
        return data;
      } else {
        const nextVersion = Math.max(1, Number(layout?.version ?? 0) + 1);
        const { data, error } = await supabase
          .from('room_layouts')
          .update({
            layout_json: layoutJson,
            version: nextVersion,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        const { error: versionError } = await supabase.from('room_layout_versions').insert({
          layout_id: id,
          version: nextVersion,
          layout_json: layoutJson,
          created_by: user?.id,
          change_description: 'Saved from Layout Studio',
        });
        if (versionError) throw versionError;
        return data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['room_layout', id] });
      queryClient.invalidateQueries({ queryKey: ['room_layouts'] });
      setIsDirty(false);
      if (id === 'new') {
        navigate({ to: `/admin/room-layouts/${data.id}/edit` });
      }
    },
  });

  // Current layout state
  const defaultLayout = initialType === 'video'
    ? DEFAULT_VIDEO_LAYOUT
    : initialType === 'pk'
      ? DEFAULT_PK_LAYOUT
      : DEFAULT_VOICE_LAYOUT;
  const [currentLayout, setCurrentLayout] = useState<LayoutJSON>(defaultLayout);

  // Load the persisted layout after the Supabase query resolves. The old code
  // used useState as an effect, so existing layouts could remain on defaults.
  useEffect(() => {
    if (layout?.layout_json) {
      const persisted = layout.layout_json as LayoutJSON;
      setCurrentLayout(persisted);
      setHistory([persisted]);
      setHistoryIndex(0);
      setSelectedElement(null);
      setIsDirty(false);
    } else if (isNew) {
      setCurrentLayout(defaultLayout);
      setHistory([defaultLayout]);
      setHistoryIndex(0);
      setIsDirty(false);
    }
  }, [layout, isNew, defaultLayout]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCurrentLayout(history[newIndex]);
      setIsDirty(true);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCurrentLayout(history[newIndex]);
      setIsDirty(true);
    }
  }, [history, historyIndex]);

  const addToHistory = useCallback((newLayout: LayoutJSON) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newLayout);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setIsDirty(true);
  }, [history, historyIndex]);

  const handleSave = () => {
    saveMutation.mutate(currentLayout);
  };

  const handlePreview = () => {
    navigate({ to: `/admin/room-layouts/${id}/preview` });
  };

  const handleAddElement = (type: string) => {
    const newElement: LayoutElement = {
      id: `element_${Date.now()}`,
      type: type as any,
      x: device.width / 2 - 50,
      y: device.height / 2 - 50,
      width: 100,
      height: 100,
      zIndex: currentLayout.elements.length + 1,
      visible: true,
      locked: false,
    };

    const newLayout = {
      ...currentLayout,
      elements: [...currentLayout.elements, newElement],
    };

    setCurrentLayout(newLayout);
    addToHistory(newLayout);
  };

  const handleUpdateElementLive = useCallback((id: string, updates: Partial<LayoutElement>) => {
    setCurrentLayout((previous) => ({
      ...previous,
      elements: previous.elements.map((el) =>
        el.id === id ? { ...el, ...updates } : el
      ),
    }));
    setIsDirty(true);
  }, []);

  const handleCommitElementChange = useCallback(() => {
    setCurrentLayout((latest) => {
      setHistory((previousHistory) => {
        const base = previousHistory.slice(0, historyIndex + 1);
        const last = base[base.length - 1];
        if (JSON.stringify(last) === JSON.stringify(latest)) return previousHistory;
        const next = [...base, latest];
        setHistoryIndex(next.length - 1);
        return next;
      });
      return latest;
    });
    setIsDirty(true);
  }, [historyIndex]);

  const handleUpdateElement = (id: string, updates: Partial<LayoutElement>) => {
    const newLayout = {
      ...currentLayout,
      elements: currentLayout.elements.map((el) =>
        el.id === id ? { ...el, ...updates } : el
      ),
    };

    setCurrentLayout(newLayout);
    addToHistory(newLayout);
  };

  const handleDeleteElement = (id: string) => {
    const newLayout = {
      ...currentLayout,
      elements: currentLayout.elements.filter((el) => el.id !== id),
    };

    setCurrentLayout(newLayout);
    addToHistory(newLayout);
    setSelectedElement(null);
  };

  const handleDuplicateElement = (id: string) => {
    const element = currentLayout.elements.find((el) => el.id === id);
    if (!element) return;

    const newElement: LayoutElement = {
      ...element,
      id: `element_${Date.now()}`,
      x: element.x + 20,
      y: element.y + 20,
      zIndex: currentLayout.elements.length + 1,
    };

    const newLayout = {
      ...currentLayout,
      elements: [...currentLayout.elements, newElement],
    };

    setCurrentLayout(newLayout);
    addToHistory(newLayout);
  };

  const handleBringToFront = (id: string) => {
    const maxZ = Math.max(...currentLayout.elements.map((el) => el.zIndex));
    handleUpdateElement(id, { zIndex: maxZ + 1 });
  };

  const handleSendToBack = (id: string) => {
    const minZ = Math.min(...currentLayout.elements.map((el) => el.zIndex));
    handleUpdateElement(id, { zIndex: minZ - 1 });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  const selectedElementData = currentLayout.elements.find((el) => el.id === selectedElement);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate({ to: '/admin/room-layouts' })}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </button>
          <div className="h-6 w-px bg-white/20" />
          <h1 className="text-xl font-bold text-white">
            {layout?.name || 'Untitled Layout'}
          </h1>
          {isDirty && <span className="text-yellow-400 text-sm">(Unsaved)</span>}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Undo className="h-5 w-5" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Redo className="h-5 w-5" />
          </button>
          <div className="h-6 w-px bg-white/20" />
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            <Save className="h-5 w-5" />
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handlePreview}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
          >
            <Eye className="h-5 w-5" />
            Preview
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Components */}
        <div className="w-64 border-r border-white/10 bg-white/5 p-4 overflow-y-auto">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Components
          </h2>
          <div className="space-y-2">
            <ComponentButton label="Seat" onClick={() => handleAddElement('seat')} />
            <ComponentButton label="Host Avatar" onClick={() => handleAddElement('host-avatar')} />
            <ComponentButton label="Chat Panel" onClick={() => handleAddElement('chat-panel')} />
            <ComponentButton label="Gift Button" onClick={() => handleAddElement('gift-button')} />
            <ComponentButton label="Room Header" onClick={() => handleAddElement('room-header')} />
            <ComponentButton label="Video Participant" onClick={() => handleAddElement('video-participant')} />
            <ComponentButton label="PK Player" onClick={() => handleAddElement('pk-player')} />
            <ComponentButton label="Custom Text" onClick={() => handleAddElement('custom-text')} />
            <ComponentButton label="Custom Image" onClick={() => handleAddElement('custom-image')} />
          </div>
        </div>

        {/* Center - Canvas */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#050508] overflow-auto">
          {/* Device Controls */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setDevice(DEVICE_PRESETS[0])}
              className={`p-2 rounded-lg ${device.name === 'mobile' ? 'bg-purple-600' : 'bg-white/10'} text-white`}
            >
              <Smartphone className="h-5 w-5" />
            </button>
            <button
              onClick={() => setDevice(DEVICE_PRESETS[1])}
              className={`p-2 rounded-lg ${device.name === 'tablet' ? 'bg-purple-600' : 'bg-white/10'} text-white`}
            >
              <Tablet className="h-5 w-5" />
            </button>
            <button
              onClick={() => setDevice(DEVICE_PRESETS[2])}
              className={`p-2 rounded-lg ${device.name === 'desktop' ? 'bg-purple-600' : 'bg-white/10'} text-white`}
            >
              <Monitor className="h-5 w-5" />
            </button>
            <div className="h-6 w-px bg-white/20" />
            <button
              onClick={() => setScale(Math.max(0.5, scale - 0.1))}
              className="p-2 rounded-lg bg-white/10 text-white"
            >
              <ZoomOut className="h-5 w-5" />
            </button>
            <span className="text-white/60">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale(Math.min(2, scale + 0.1))}
              className="p-2 rounded-lg bg-white/10 text-white"
            >
              <ZoomIn className="h-5 w-5" />
            </button>
          </div>

          {/* Canvas */}
          <div
            className="relative bg-[#0a0a0f] border-2 border-white/20 rounded-lg overflow-hidden"
            data-canvas-width={device.width}
            style={{
              width: device.width,
              height: device.height,
              transform: `scale(${scale})`,
              transformOrigin: 'center',
            }}
          >
            {currentLayout.elements.map((element) => (
              <CanvasElement
                key={element.id}
                element={element}
                isSelected={selectedElement === element.id}
                onSelect={() => setSelectedElement(element.id)}
                onUpdate={(updates) => handleUpdateElementLive(element.id, updates)}
                onCommit={handleCommitElementChange}
              />
            ))}
          </div>
        </div>

        {/* Right Sidebar - Properties */}
        <div className="w-80 border-l border-white/10 bg-white/5 p-4 overflow-y-auto">
          {selectedElementData ? (
            <>
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Properties
              </h2>

              {/* Position */}
              <div className="mb-6">
                <h3 className="text-white/60 text-sm mb-2">Position</h3>
                <div className="grid grid-cols-2 gap-2">
                  <PropertyInput
                    label="X"
                    value={selectedElementData.x}
                    onChange={(v) => handleUpdateElement(selectedElement!, { x: Number(v) })}
                  />
                  <PropertyInput
                    label="Y"
                    value={selectedElementData.y}
                    onChange={(v) => handleUpdateElement(selectedElement!, { y: Number(v) })}
                  />
                </div>
              </div>

              {/* Size */}
              <div className="mb-6">
                <h3 className="text-white/60 text-sm mb-2">Size</h3>
                <div className="grid grid-cols-2 gap-2">
                  <PropertyInput
                    label="Width"
                    value={selectedElementData.width}
                    onChange={(v) => handleUpdateElement(selectedElement!, { width: Number(v) })}
                  />
                  <PropertyInput
                    label="Height"
                    value={selectedElementData.height}
                    onChange={(v) => handleUpdateElement(selectedElement!, { height: Number(v) })}
                  />
                </div>
              </div>

              {/* Transform */}
              <div className="mb-6">
                <h3 className="text-white/60 text-sm mb-2">Transform</h3>
                <PropertyInput
                  label="Rotation"
                  value={selectedElementData.rotation || 0}
                  onChange={(v) => handleUpdateElement(selectedElement!, { rotation: Number(v) })}
                />
                <PropertyInput
                  label="Scale"
                  value={selectedElementData.scale || 1}
                  onChange={(v) => handleUpdateElement(selectedElement!, { scale: Number(v) })}
                />
                <PropertyInput
                  label="Opacity"
                  value={selectedElementData.opacity || 1}
                  onChange={(v) => handleUpdateElement(selectedElement!, { opacity: Number(v) })}
                />
              </div>

              {/* Layer */}
              <div className="mb-6">
                <h3 className="text-white/60 text-sm mb-2">Layer</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleBringToFront(selectedElement!)}
                    className="flex-1 flex items-center justify-center gap-1 bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg text-sm"
                  >
                    <ArrowUp className="h-4 w-4" />
                    Front
                  </button>
                  <button
                    onClick={() => handleSendToBack(selectedElement!)}
                    className="flex-1 flex items-center justify-center gap-1 bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg text-sm"
                  >
                    <ArrowDown className="h-4 w-4" />
                    Back
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleDuplicateElement(selectedElement!)}
                  className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg"
                >
                  <Copy className="h-4 w-4" />
                  Duplicate
                </button>
                <button
                  onClick={() => handleDeleteElement(selectedElement!)}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 py-2 rounded-lg"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </>
          ) : (
            <div className="text-center text-white/40 py-12">
              <Layers className="h-12 w-12 mx-auto mb-4" />
              <p>Select an element to edit its properties</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ComponentButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-left"
    >
      <Plus className="h-4 w-4" />
      {label}
    </button>
  );
}

function PropertyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-white/60 text-xs">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white outline-none focus:border-purple-500"
      />
    </div>
  );
}

function CanvasElement({
  element,
  isSelected,
  onSelect,
  onUpdate,
  onCommit,
}: {
  element: LayoutElement;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<LayoutElement>) => void;
  onCommit: () => void;
}) {
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (element.locked) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    onSelect();
    const canvas = e.currentTarget.parentElement;
    const rect = canvas?.getBoundingClientRect();
    if (!rect) return;
    const baseWidth = Number(canvas.dataset.canvasWidth) || rect.width;
    const zoom = rect.width / baseWidth;
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    dragRef.current = { pointerId: e.pointerId, offsetX: x - element.x, offsetY: y - element.y };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const canvas = e.currentTarget.parentElement;
    const rect = canvas?.getBoundingClientRect();
    if (!rect) return;
    const baseWidth = Number(canvas.dataset.canvasWidth) || rect.width;
    const zoom = rect.width / baseWidth;
    const x = (e.clientX - rect.left) / zoom - drag.offsetX;
    const y = (e.clientY - rect.top) / zoom - drag.offsetY;
    onUpdate({ x: Math.round(x), y: Math.round(y) });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    onCommit();
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`absolute select-none ${element.locked ? 'cursor-not-allowed' : 'cursor-move'}`}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        zIndex: element.zIndex,
        opacity: element.opacity ?? 1,
        transform: `rotate(${element.rotation || 0}deg) scale(${element.scale || 1})`,
        border: isSelected ? '2px solid #a855f7' : '2px dashed rgba(255,255,255,0.3)',
        borderRadius: element.borderRadius || 8,
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        touchAction: 'none',
      }}
    >
      <div className="w-full h-full flex items-center justify-center text-white/60 text-xs pointer-events-none">
        {element.type}
      </div>
      {isSelected && <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full pointer-events-none" />}
    </div>
  );
}
