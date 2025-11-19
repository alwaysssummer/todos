-- =====================================================
-- Supabase 테이블 완전 삭제 후 재생성
-- 주의: 모든 데이터가 삭제됩니다!
-- =====================================================

-- 1. 기존 테이블 삭제 (존재하는 경우)
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS memos CASCADE;

-- 2. 기존 함수 삭제 (존재하는 경우)
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- =====================================================
-- 테이블 재생성
-- =====================================================

-- Projects 테이블 먼저 생성 (tasks가 참조하므로)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    type TEXT NOT NULL DEFAULT 'folder' CHECK (type IN ('folder', 'student', 'habit')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 학생 시간표 전용
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    schedule_template JSONB, -- [{ day: number, time: string, duration: number }]
    
    -- 루틴/습관 전용
    repeat_days INTEGER[], -- [1, 2, 3, 4, 5] = 월~금
    target_time TEXT,
    target_duration INTEGER
);

-- Tasks 테이블 생성
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ,
    duration INTEGER, -- 분 단위
    is_all_day BOOLEAN DEFAULT FALSE,
    due_date TIMESTAMPTZ,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox', 'scheduled', 'completed', 'cancelled')),
    is_top5 BOOLEAN DEFAULT FALSE,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 자동 생성 여부
    is_auto_generated BOOLEAN DEFAULT FALSE,
    
    -- 학생 시간표 전용
    attendance TEXT CHECK (attendance IN ('present', 'absent', 'late')),
    homework_status TEXT CHECK (homework_status IN ('done', 'pending', 'none')),
    lesson_note TEXT,
    is_makeup BOOLEAN DEFAULT FALSE,
    is_cancelled BOOLEAN DEFAULT FALSE,
    
    -- 루틴/습관 전용
    habit_completed BOOLEAN DEFAULT FALSE,
    actual_duration INTEGER,
    streak_count INTEGER DEFAULT 0
);

-- Memos 테이블 생성 (향후 확장)
CREATE TABLE memos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT,
    tags TEXT[],
    parent_id UUID REFERENCES memos(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 인덱스 생성 (성능 최적화)
-- =====================================================

-- Tasks 인덱스
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_start_time ON tasks(start_time);
CREATE INDEX idx_tasks_order_index ON tasks(order_index);
CREATE INDEX idx_tasks_is_auto_generated ON tasks(is_auto_generated);

-- Projects 인덱스
CREATE INDEX idx_projects_type ON projects(type);
CREATE INDEX idx_projects_status ON projects(status);

-- =====================================================
-- RLS (Row Level Security) 설정
-- =====================================================

-- RLS 활성화
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE memos ENABLE ROW LEVEL SECURITY;

-- 모든 접근 허용 정책 (인증 구현 전까지 임시)
CREATE POLICY "Enable all access for all users" ON tasks
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for all users" ON projects
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for all users" ON memos
    FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 트리거: updated_at 자동 업데이트
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 샘플 데이터 추가 (선택 사항)
-- =====================================================

-- 샘플 Tasks 추가
INSERT INTO tasks (title, status, is_top5, order_index) VALUES
    ('프로젝트 기획서 작성', 'inbox', true, 1),
    ('디자인 시안 검토', 'inbox', false, 2),
    ('주간 회의 준비', 'scheduled', false, 3);

-- 마지막 task에 시간 설정 (2025년 11월 19일 14:00, 60분)
UPDATE tasks 
SET start_time = '2025-11-19T14:00:00+09:00', duration = 60
WHERE title = '주간 회의 준비';

-- =====================================================
-- 완료
-- =====================================================

-- 결과 확인
SELECT 'Tables created successfully!' as status;
SELECT COUNT(*) as task_count FROM tasks;
SELECT COUNT(*) as project_count FROM projects;

