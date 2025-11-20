-- =====================================================
-- Supabase 테이블 스키마 생성 SQL
-- =====================================================

-- 1. Tasks 테이블 생성
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ,
    duration INTEGER, -- 분 단위
    is_all_day BOOLEAN DEFAULT FALSE,
    due_date TIMESTAMPTZ,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('inbox', 'scheduled', 'completed', 'cancelled', 'waiting')),
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

-- 2. Projects 테이블 생성
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    type TEXT NOT NULL CHECK (type IN ('folder', 'student', 'habit')),
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

-- 3. Memos 테이블 생성 (향후 확장)
CREATE TABLE IF NOT EXISTS memos (
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
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_start_time ON tasks(start_time);
CREATE INDEX IF NOT EXISTS idx_tasks_order_index ON tasks(order_index);
CREATE INDEX IF NOT EXISTS idx_tasks_is_auto_generated ON tasks(is_auto_generated);

-- Projects 인덱스
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(type);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- =====================================================
-- RLS (Row Level Security) 설정
-- =====================================================

-- Tasks RLS 활성화
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Projects RLS 활성화
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Memos RLS 활성화
ALTER TABLE memos ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 자신의 데이터를 읽고 쓸 수 있도록 설정
-- (인증 구현 전까지는 임시로 모든 접근 허용)
CREATE POLICY "Enable all access for authenticated users" ON tasks
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for authenticated users" ON projects
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for authenticated users" ON memos
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
-- 완료
-- =====================================================

