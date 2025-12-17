-- 노트/테스크 보관 기능을 위한 is_archived 컬럼 추가
-- Supabase SQL Editor에서 실행하세요

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- 인덱스 추가 (보관된 항목 필터링 성능 향상)
CREATE INDEX IF NOT EXISTS idx_tasks_is_archived ON tasks(is_archived);

-- 확인
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'tasks' AND column_name = 'is_archived';


















