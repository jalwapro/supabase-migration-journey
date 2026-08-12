-- ============================================
-- ROOM LAYOUTS SYSTEM
-- ============================================
-- This migration creates the database structure for the
-- Visual Room Layout Builder system
-- ============================================

-- Main room layouts table
CREATE TABLE IF NOT EXISTS room_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('voice', 'video', 'pk')),
  description TEXT,
  layout_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  thumbnail TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  version INTEGER NOT NULL DEFAULT 1,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Layout versions for version history
CREATE TABLE IF NOT EXISTS room_layout_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id UUID NOT NULL REFERENCES room_layouts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  layout_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  thumbnail TEXT,
  change_description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(layout_id, version)
);

-- Layout templates (saved designs that can be reused)
CREATE TABLE IF NOT EXISTS room_layout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('voice', 'video', 'pk')),
  description TEXT,
  layout_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  thumbnail TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Room-specific layout assignments
CREATE TABLE IF NOT EXISTS room_layout_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES live_rooms(id) ON DELETE CASCADE,
  layout_id UUID REFERENCES room_layouts(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(room_id)
);

-- Category-specific layout assignments
CREATE TABLE IF NOT EXISTS category_layout_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('voice', 'video', 'pk')),
  layout_id UUID REFERENCES room_layouts(id) ON DELETE SET NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(category, type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_room_layouts_type ON room_layouts(type);
CREATE INDEX IF NOT EXISTS idx_room_layouts_status ON room_layouts(status);
CREATE INDEX IF NOT EXISTS idx_room_layouts_is_default ON room_layouts(is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_room_layouts_created_by ON room_layouts(created_by);

CREATE INDEX IF NOT EXISTS idx_room_layout_versions_layout_id ON room_layout_versions(layout_id);
CREATE INDEX IF NOT EXISTS idx_room_layout_versions_version ON room_layout_versions(layout_id, version);

CREATE INDEX IF NOT EXISTS idx_room_layout_templates_type ON room_layout_templates(type);
CREATE INDEX IF NOT EXISTS idx_room_layout_templates_is_system ON room_layout_templates(is_system);

CREATE INDEX IF NOT EXISTS idx_room_layout_assignments_room_id ON room_layout_assignments(room_id);
CREATE INDEX IF NOT EXISTS idx_room_layout_assignments_layout_id ON room_layout_assignments(layout_id);

CREATE INDEX IF NOT EXISTS idx_category_layout_assignments_category ON category_layout_assignments(category, type);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_room_layouts_updated_at
  BEFORE UPDATE ON room_layouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_room_layout_templates_updated_at
  BEFORE UPDATE ON room_layout_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to get active layout for a room
CREATE OR REPLACE FUNCTION get_room_layout(p_room_id UUID, p_type TEXT)
RETURNS JSONB AS $$
DECLARE
  v_layout JSONB;
BEGIN
  -- Check for room-specific layout first
  SELECT rl.layout_json INTO v_layout
  FROM room_layout_assignments rla
  JOIN room_layouts rl ON rla.layout_id = rl.id
  WHERE rla.room_id = p_room_id
    AND rl.type = p_type
    AND rl.status = 'published'
  LIMIT 1;

  -- If no room-specific layout, check category layout
  IF v_layout IS NULL THEN
    SELECT lr.category INTO v_layout
    FROM live_rooms lr
    WHERE lr.id = p_room_id
    LIMIT 1;

    IF v_layout IS NOT NULL THEN
      SELECT rl.layout_json INTO v_layout
      FROM category_layout_assignments cla
      JOIN room_layouts rl ON cla.layout_id = rl.id
      WHERE cla.category = v_layout
        AND cla.type = p_type
        AND rl.status = 'published'
      ORDER BY cla.priority DESC
      LIMIT 1;
    END IF;
  END IF;

  -- If still no layout, get default
  IF v_layout IS NULL THEN
    SELECT layout_json INTO v_layout
    FROM room_layouts
    WHERE type = p_type
      AND is_default = true
      AND status = 'published'
    LIMIT 1;
  END IF;

  RETURN COALESCE(v_layout, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (admin only)
GRANT SELECT, INSERT, UPDATE, DELETE ON room_layouts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON room_layout_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON room_layout_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON room_layout_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON category_layout_assignments TO authenticated;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION get_room_layout TO authenticated;
