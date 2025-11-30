-- 교재 관리 메모 시스템 스키마
-- Supabase SQL Editor에서 실행하세요

-- 수준별 메모
ALTER TABLE textbook_subgroups 
ADD COLUMN IF NOT EXISTS memo TEXT;

-- 교재별 메모
ALTER TABLE textbooks 
ADD COLUMN IF NOT EXISTS memo TEXT;

-- 단원별 메모는 이미 textbook_chapters.memo로 존재함

