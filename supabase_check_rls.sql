-- =====================================================
-- RLS 및 정책 확인 스크립트
-- =====================================================

-- 1. 모든 테이블의 RLS 상태 확인
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. 각 테이블의 RLS 정책 확인
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. textbooks 테이블 존재 여부 및 구조 확인
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'textbooks'
ORDER BY ordinal_position;

-- 4. projects 테이블 존재 여부 및 구조 확인
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'projects'
ORDER BY ordinal_position;

-- 5. textbooks 테이블 데이터 확인
SELECT COUNT(*) as textbook_count FROM textbooks;

-- 6. projects 테이블 데이터 확인
SELECT COUNT(*) as project_count FROM projects;

-- 7. RLS 비활성화 (임시 테스트용)
-- 개인 사용이므로 RLS를 완전히 비활성화
ALTER TABLE textbooks DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE memos DISABLE ROW LEVEL SECURITY;

SELECT '✅ RLS 비활성화 완료 - 모든 테이블에서 인증 없이 접근 가능' as result;

