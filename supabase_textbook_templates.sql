-- =====================================================
-- 교재 템플릿 시스템 - 데이터베이스 스키마
-- =====================================================

-- 교재 템플릿 테이블
CREATE TABLE IF NOT EXISTS textbook_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,                    -- 템플릿명 (예: "수능 어법 10강", "기초 문법 15과")
    total_chapters INTEGER NOT NULL,       -- 총 단원 수
    chapter_unit TEXT NOT NULL DEFAULT '강', -- 단원 단위 ('강', '과', 'Unit', 'Chapter', '직접입력')
    custom_chapter_unit TEXT,              -- 직접입력 시 사용자 정의 단위
    chapters JSONB,                        -- 단원 정보 배열 [{chapter_number: 1, custom_name: "수일치"}, ...]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_textbook_templates_name ON textbook_templates(name);

-- RLS 정책 (필요시)
-- ALTER TABLE textbook_templates ENABLE ROW LEVEL SECURITY;
