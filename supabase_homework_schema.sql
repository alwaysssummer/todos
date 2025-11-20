-- =====================================================
-- 과제 관리 기능 스키마 추가
-- 교재(textbooks) 테이블 및 과제 관리 필드 추가
-- =====================================================

-- 1. 기존 textbooks 테이블이 있으면 삭제 후 재생성
DROP TABLE IF EXISTS textbooks CASCADE;

CREATE TABLE textbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    total_chapters INTEGER NOT NULL CHECK (total_chapters > 0),
    chapter_unit TEXT NOT NULL CHECK (chapter_unit IN ('강', '과', 'Unit', 'Chapter', '직접입력')),
    custom_chapter_unit TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. projects 테이블에 textbooks 컬럼 추가
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS textbooks UUID[] DEFAULT '{}';

-- 3. tasks 테이블에 과제 관리 필드 추가
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS homework_checks JSONB,
ADD COLUMN IF NOT EXISTS homework_assignments JSONB;

-- =====================================================
-- 인덱스 생성 (성능 최적화)
-- =====================================================

-- textbooks 인덱스
CREATE INDEX IF NOT EXISTS idx_textbooks_name ON textbooks(name);
CREATE INDEX IF NOT EXISTS idx_textbooks_created_at ON textbooks(created_at DESC);

-- projects 교재 인덱스 (GIN 인덱스 - 배열 검색용)
CREATE INDEX IF NOT EXISTS idx_projects_textbooks ON projects USING GIN (textbooks);

-- tasks 과제 인덱스 (GIN 인덱스 - JSONB 검색용)
CREATE INDEX IF NOT EXISTS idx_tasks_homework_checks ON tasks USING GIN (homework_checks);
CREATE INDEX IF NOT EXISTS idx_tasks_homework_assignments ON tasks USING GIN (homework_assignments);

-- =====================================================
-- RLS (Row Level Security) 정책
-- =====================================================

-- textbooks RLS 활성화
ALTER TABLE textbooks ENABLE ROW LEVEL SECURITY;

-- 기존 정책이 있으면 삭제 후 재생성
DROP POLICY IF EXISTS "Enable all access for textbooks" ON textbooks;

-- 모든 접근 허용 정책 (인증 구현 전까지 임시)
CREATE POLICY "Enable all access for textbooks" ON textbooks
    FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 샘플 데이터 (개발/테스트용)
-- =====================================================

-- 샘플 교재 추가 (영어 교재)
INSERT INTO textbooks (name, total_chapters, chapter_unit, custom_chapter_unit) VALUES
    ('Grammar in Use', 20, 'Unit', NULL),
    ('Oxford Reading Tree', 15, '직접입력', 'Stage'),
    ('Phonics Kids', 12, 'Unit', NULL),
    ('Oxford Discover', 18, 'Chapter', NULL);

-- =====================================================
-- 검증 쿼리
-- =====================================================

-- 테이블 생성 확인
SELECT 'textbooks 테이블 생성 완료' as status, COUNT(*) as sample_count FROM textbooks;

-- 컬럼 추가 확인
SELECT 
    'projects.textbooks 컬럼 추가 완료' as status,
    column_name,
    data_type 
FROM information_schema.columns 
WHERE table_name = 'projects' AND column_name = 'textbooks';

SELECT 
    'tasks 과제 필드 추가 완료' as status,
    column_name,
    data_type 
FROM information_schema.columns 
WHERE table_name = 'tasks' AND column_name IN ('homework_checks', 'homework_assignments');

-- 인덱스 확인
SELECT 
    'GIN 인덱스 생성 완료' as status,
    indexname 
FROM pg_indexes 
WHERE tablename IN ('textbooks', 'projects', 'tasks') 
    AND (indexname LIKE '%homework%' OR indexname LIKE '%textbooks%');

-- 완료 메시지
SELECT '✅ Phase 1: DB 스키마 생성 완료!' as result;

