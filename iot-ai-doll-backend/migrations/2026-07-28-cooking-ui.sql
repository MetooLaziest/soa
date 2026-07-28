-- 料理 UI 重构 - 数据库迁移
-- 日期: 2026-07-28
-- 兼容: 旧数据保留,新字段默认安全值

-- 1. cooking_methods 加 cook_btn_char (per-method 按钮字符: 炖/煮/炒/煎)
ALTER TABLE cooking_methods
  ADD COLUMN IF NOT EXISTS cook_btn_char VARCHAR(4) NOT NULL DEFAULT '煮';

-- 2. 新表 cooking_config (singleton, id=1)
CREATE TABLE IF NOT EXISTS cooking_config (
  id                SMALLINT      PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_bg_url    TEXT          NOT NULL DEFAULT '',
  progress_track_color VARCHAR(16) NOT NULL DEFAULT '#e0e0e0',
  progress_fill_from VARCHAR(16)   NOT NULL DEFAULT '#9ccc65',
  progress_fill_to   VARCHAR(16)   NOT NULL DEFAULT '#ffb300',
  progress_height   SMALLINT      NOT NULL DEFAULT 12,
  button_color      VARCHAR(16)   NOT NULL DEFAULT '#7cb342',
  button_text_color VARCHAR(16)   NOT NULL DEFAULT '#ffffff',
  button_size       VARCHAR(8)    NOT NULL DEFAULT 'l' CHECK (button_size IN ('s','m','l')),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 3. 插默认行 (singleton)
INSERT INTO cooking_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 回滚 (如需):
-- DROP TABLE IF EXISTS cooking_config;
-- ALTER TABLE cooking_methods DROP COLUMN IF EXISTS cook_btn_char;
