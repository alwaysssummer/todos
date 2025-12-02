-- THE FOCUS 기능을 위한 컬럼 추가
-- 실행: Supabase Dashboard > SQL Editor에서 실행

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_the_focus BOOLEAN DEFAULT FALSE;

-- 인덱스 추가 (선택사항 - 검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_tasks_is_the_focus ON tasks(is_the_focus);


