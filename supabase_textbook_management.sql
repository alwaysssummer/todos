-- =====================================================
-- 교재 관리 시스템 v2 - 데이터베이스 스키마
-- =====================================================

-- 1. 그룹1 테이블 (textbook_groups) - 이미 존재하면 무시
CREATE TABLE IF NOT EXISTS textbook_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 그룹2 테이블 (textbook_subgroups) - 서브그룹/수준 + 로컬폴더 경로
CREATE TABLE IF NOT EXISTS textbook_subgroups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES textbook_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    local_path TEXT,  -- 로컬 폴더 경로 (예: D:\교재\어법\초급)
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_textbook_subgroups_group_id ON textbook_subgroups(group_id);

-- 3. textbooks 테이블에 컬럼 추가
-- group_id 컬럼 추가 (이미 있으면 무시)
ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES textbook_groups(id) ON DELETE SET NULL;

-- subgroup_id 컬럼 추가
ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS subgroup_id UUID REFERENCES textbook_subgroups(id) ON DELETE SET NULL;

-- order_index 컬럼 추가
ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_textbooks_group_id ON textbooks(group_id);
CREATE INDEX IF NOT EXISTS idx_textbooks_subgroup_id ON textbooks(subgroup_id);

-- 4. textbook_chapters 테이블 (단원 관리) - 이미 존재하면 무시
CREATE TABLE IF NOT EXISTS textbook_chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    textbook_id UUID NOT NULL REFERENCES textbooks(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL,
    custom_name TEXT,
    memo TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(textbook_id, chapter_number)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_textbook_chapters_textbook_id ON textbook_chapters(textbook_id);








