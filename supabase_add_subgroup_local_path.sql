-- textbook_subgroups 테이블에 local_path 컬럼 추가
-- Supabase SQL Editor에서 실행

ALTER TABLE textbook_subgroups ADD COLUMN IF NOT EXISTS local_path TEXT;

-- 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'textbook_subgroups';


