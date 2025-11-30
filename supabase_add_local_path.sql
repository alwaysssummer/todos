-- textbook_subgroups 테이블에 local_path 컬럼 추가
-- Supabase SQL Editor에서 실행하세요

ALTER TABLE textbook_subgroups 
ADD COLUMN IF NOT EXISTS local_path TEXT;

-- textbooks 테이블에도 local_path 컬럼 추가
ALTER TABLE textbooks 
ADD COLUMN IF NOT EXISTS local_path TEXT;

