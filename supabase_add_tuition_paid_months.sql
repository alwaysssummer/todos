-- 월별 수업료 납부 추적을 위한 컬럼 추가
-- 실행: Supabase Dashboard > SQL Editor에서 실행

ALTER TABLE projects ADD COLUMN IF NOT EXISTS tuition_paid_months TEXT[] DEFAULT '{}';

-- 인덱스 추가 (선택사항 - 검색 성능 향상)
-- CREATE INDEX IF NOT EXISTS idx_projects_tuition_paid_months ON projects USING GIN(tuition_paid_months);

