import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus, Edit, Trash2, Copy, Eye, Layers, Layout, LayoutTemplate,
  ChevronRight, Search, Filter, MoreVertical, Play, Settings,
} from "lucide-react";
import type { RoomType, LayoutStatus, RoomLayout } from "@/lib/room-layouts";

export const Route = createFileRoute("/_authenticated/admin/room-layouts")({
  component: RoomLayoutsPage,
});

function RoomLayoutsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedType, setSelectedType] = useState<RoomType | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<LayoutStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch layouts
  const { data: layouts, isLoading } = useQuery({
    queryKey: ['room_layouts', selectedType, selectedStatus, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('room_layouts')
        .select('*')
        .order('updated_at', { ascending: false });

      if (selectedType !== 'all') {
        query = query.eq('type', selectedType);
      }
      if (selectedStatus !== 'all') {
        query = query.eq('status', selectedStatus);
      }
      if (searchQuery) {
        query = query.ilike('name', `%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as RoomLayout[];
    },
  });

  // Delete layout mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('room_layouts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room_layouts'] });
    },
  });

  // Duplicate layout mutation
  const duplicateMutation = useMutation({
    mutationFn: async (layout: RoomLayout) => {
      const { data, error } = await supabase
        .from('room_layouts')
        .insert({
          name: `${layout.name} (Copy)`,
          type: layout.type,
          description: layout.description,
          layout_json: layout.layout_json,
          thumbnail: layout.thumbnail,
          status: 'draft',
          version: 1,
          is_default: false,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room_layouts'] });
    },
  });

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this layout?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleDuplicate = (layout: RoomLayout) => {
    duplicateMutation.mutate(layout);
  };

  const handleEdit = (id: string) => {
    navigate({ to: `/admin/room-layouts/${id}/edit` });
  };

  const handlePreview = (id: string) => {
    navigate({ to: `/admin/room-layouts/${id}/preview` });
  };

  const handleCreate = (type: RoomType) => {
    navigate({ to: `/admin/room-layouts/new`, search: { type } });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Room Layout Studio</h1>
            <p className="text-white/60">Design and manage visual layouts for Voice, Video, and PK rooms</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleCreate('voice')}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              <Plus className="h-5 w-5" />
              Voice Layout
            </button>
            <button
              onClick={() => handleCreate('video')}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              <Plus className="h-5 w-5" />
              Video Layout
            </button>
            <button
              onClick={() => handleCreate('pk')}
              className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              <Plus className="h-5 w-5" />
              PK Layout
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6 bg-white/5 p-4 rounded-xl border border-white/10">
          <div className="flex items-center gap-2 flex-1">
            <Search className="h-5 w-5 text-white/40" />
            <input
              type="text"
              placeholder="Search layouts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-white/40"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-white/40" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as RoomType | 'all')}
              className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white outline-none"
            >
              <option value="all">All Types</option>
              <option value="voice">Voice</option>
              <option value="video">Video</option>
              <option value="pk">PK Battle</option>
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as LayoutStatus | 'all')}
              className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white outline-none"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Layouts Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-white/60">Loading layouts...</div>
        ) : layouts && layouts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {layouts.map((layout) => (
              <LayoutCard
                key={layout.id}
                layout={layout}
                onEdit={() => handleEdit(layout.id)}
                onPreview={() => handlePreview(layout.id)}
                onDuplicate={() => handleDuplicate(layout)}
                onDelete={() => handleDelete(layout.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-white/60">
            <LayoutTemplate className="h-16 w-16 mx-auto mb-4 text-white/20" />
            <p className="text-lg mb-2">No layouts found</p>
            <p className="text-sm">Create your first layout to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LayoutCard({
  layout,
  onEdit,
  onPreview,
  onDuplicate,
  onDelete,
}: {
  layout: RoomLayout;
  onEdit: () => void;
  onPreview: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const typeColors = {
    voice: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    video: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    pk: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  };

  const statusColors = {
    draft: 'bg-yellow-500/20 text-yellow-400',
    published: 'bg-green-500/20 text-green-400',
    archived: 'bg-gray-500/20 text-gray-400',
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-colors">
      {/* Thumbnail */}
      <div className="aspect-video bg-gradient-to-br from-purple-900/30 to-blue-900/30 flex items-center justify-center">
        {layout.thumbnail ? (
          <img src={layout.thumbnail} alt={layout.name} className="w-full h-full object-cover" />
        ) : (
          <Layout className="h-12 w-12 text-white/20" />
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-white font-semibold">{layout.name}</h3>
          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${typeColors[layout.type]}`}>
            {layout.type.toUpperCase()}
          </span>
        </div>
        {layout.description && (
          <p className="text-white/60 text-sm mb-3 line-clamp-2">{layout.description}</p>
        )}
        <div className="flex items-center justify-between text-xs text-white/40 mb-4">
          <span>v{layout.version}</span>
          <span className={`px-2 py-1 rounded-full ${statusColors[layout.status]}`}>
            {layout.status}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg transition-colors"
          >
            <Edit className="h-4 w-4" />
            Edit
          </button>
          <button
            onClick={onPreview}
            className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg transition-colors"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={onDuplicate}
            className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg transition-colors"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-2 rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
