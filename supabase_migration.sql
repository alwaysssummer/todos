-- =====================================================
-- Supabase 테이블 마이그레이션 SQL
-- 기존 테이블에 누락된 컬럼 추가
-- =====================================================

-- 1. Tasks 테이블에 누락된 컬럼 추가
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS attendance TEXT CHECK (attendance IN ('present', 'absent', 'late'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS homework_status TEXT CHECK (homework_status IN ('done', 'pending', 'none'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS lesson_note TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_makeup BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS habit_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_duration INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Projects 테이블에 누락된 컬럼 추가
ALTER TABLE projects ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'folder' CHECK (type IN ('folder', 'student', 'habit'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS schedule_template JSONB;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS repeat_days INTEGER[];
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_time TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_duration INTEGER;

-- 3. 인덱스 생성 (이미 존재하면 무시됨)
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_start_time ON tasks(start_time);
CREATE INDEX IF NOT EXISTS idx_tasks_order_index ON tasks(order_index);
CREATE INDEX IF NOT EXISTS idx_tasks_is_auto_generated ON tasks(is_auto_generated);

CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(type);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- 4. updated_at 트리거 생성 (이미 존재하면 교체)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. RLS 정책 추가 (이미 존재하면 무시됨)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 후 재생성
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON tasks;
CREATE POLICY "Enable all access for authenticated users" ON tasks
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON projects;
CREATE POLICY "Enable all access for authenticated users" ON projects
    FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 완료
-- =====================================================

