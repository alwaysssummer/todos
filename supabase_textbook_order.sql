-- textbooks 테이블에 order_index 컬럼 추가
ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- 기존 데이터에 순서 부여 (created_at 기준)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY COALESCE(group_id, 'ungrouped') ORDER BY created_at) as rn
  FROM textbooks
)
UPDATE textbooks
SET order_index = ranked.rn
FROM ranked
WHERE textbooks.id = ranked.id;



