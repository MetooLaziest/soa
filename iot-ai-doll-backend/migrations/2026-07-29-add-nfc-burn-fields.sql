-- NFC 烧录状态字段 — admin /pets CSV 上传回灌用
-- 2026-07-29 新增 · 跟 memory #23 烧录规范闭环
-- 兼容: NULL = 未烧录, NOT NULL = 已烧录 (时间戳即烧录时间)

ALTER TABLE pet_instances
  ADD COLUMN IF NOT EXISTS nfc_burned_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS nfc_burn_batch VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS nfc_burn_device VARCHAR(64) NULL;

-- 部分索引: 只索引已烧录的, 烧录率统计查询走索引扫描
CREATE INDEX IF NOT EXISTS idx_pet_burned_at
  ON pet_instances(nfc_burned_at)
  WHERE nfc_burned_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pet_burn_batch
  ON pet_instances(nfc_burn_batch)
  WHERE nfc_burn_batch IS NOT NULL;

-- 回滚 (如需):
-- ALTER TABLE pet_instances
--   DROP COLUMN IF EXISTS nfc_burn_device,
--   DROP COLUMN IF EXISTS nfc_burn_batch,
--   DROP COLUMN IF EXISTS nfc_burned_at;
-- DROP INDEX IF EXISTS idx_pet_burn_batch;
-- DROP INDEX IF EXISTS idx_pet_burned_at;
