-- Yard Scene Editor: database schema
-- Run in epet1 database

-- Scene configuration (one active scene per user in future, global for now)
CREATE TABLE IF NOT EXISTS yard_scenes (
  id            BIGSERIAL PRIMARY KEY,
  name          VARCHAR(64) NOT NULL DEFAULT '默认庭院',
  bg_image_url  VARCHAR(255) NOT NULL DEFAULT '/epet/yard-bg.png',
  walk_bounds   JSONB NOT NULL DEFAULT '{"xMin":0.05,"xMax":0.88,"yMin":0.45,"yMax":0.78}',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scene objects placed in the yard (trees, fences, rocks, etc.)
CREATE TABLE IF NOT EXISTS yard_scene_objects (
  id            BIGSERIAL PRIMARY KEY,
  scene_id      BIGINT NOT NULL REFERENCES yard_scenes(id) ON DELETE CASCADE,
  label         VARCHAR(64) NOT NULL DEFAULT '未命名物体',
  object_type   VARCHAR(32) NOT NULL DEFAULT 'decoration',
    -- 'tree' | 'fence' | 'rock' | 'flower' | 'decoration' | 'collider'
  layer         SMALLINT NOT NULL DEFAULT 1,
    -- 0 = background (behind pets), 1 = sorted with pets, 2 = canopy (above pets)
  pos_x         FLOAT NOT NULL DEFAULT 0.5,
    -- viewport fraction 0-1
  pos_y         FLOAT NOT NULL DEFAULT 0.5,
    -- viewport fraction 0-1
  width         FLOAT NOT NULL DEFAULT 0.08,
    -- viewport fraction 0-1
  height        FLOAT NOT NULL DEFAULT 0.1,
    -- viewport fraction 0-1
  image_url     VARCHAR(255) NOT NULL DEFAULT '',
    -- sprite image (empty = invisible collider)
  collidable    BOOLEAN NOT NULL DEFAULT false,
  sort_priority SMALLINT NOT NULL DEFAULT 0,
    -- within same layer, higher = drawn later (on top)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_yard_scene_objects_scene ON yard_scene_objects(scene_id);

-- Seed default scene
INSERT INTO yard_scenes (name, bg_image_url, walk_bounds)
VALUES ('默认庭院', '/epet/yard-bg.png', '{"xMin":0.05,"xMax":0.88,"yMin":0.45,"yMax":0.78}')
ON CONFLICT DO NOTHING;

-- Seed default objects (matching CollisionMap.ts defaults)
INSERT INTO yard_scene_objects (scene_id, label, object_type, layer, pos_x, pos_y, width, height, collidable)
SELECT id, '左侧围栏', 'fence', 1, 0.03, 0.60, 0.06, 0.40, true FROM yard_scenes WHERE is_active = true
UNION ALL
SELECT id, '右侧围栏', 'fence', 1, 0.94, 0.60, 0.12, 0.40, true FROM yard_scenes WHERE is_active = true
UNION ALL
SELECT id, '上方边界', 'fence', 1, 0.465, 0.445, 0.83, 0.05, true FROM yard_scenes WHERE is_active = true
UNION ALL
SELECT id, '下方边界', 'fence', 1, 0.465, 0.785, 0.83, 0.03, true FROM yard_scenes WHERE is_active = true
UNION ALL
SELECT id, '树干', 'tree', 1, 0.46, 0.52, 0.08, 0.08, true FROM yard_scenes WHERE is_active = true
UNION ALL
SELECT id, '树冠', 'tree', 2, 0.46, 0.44, 0.18, 0.12, false FROM yard_scenes WHERE is_active = true
UNION ALL
SELECT id, '左侧花坛', 'flower', 1, 0.13, 0.68, 0.10, 0.08, true FROM yard_scenes WHERE is_active = true
UNION ALL
SELECT id, '右侧石头', 'rock', 1, 0.79, 0.715, 0.10, 0.07, true FROM yard_scenes WHERE is_active = true;
