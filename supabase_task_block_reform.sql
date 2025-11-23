-- =====================================================
-- Task 블록 기반 리폼 (Phase 1: 스키마 확장)
-- ✅ 기존 컬럼 100% 유지
-- ✅ 새 컬럼만 추가
-- ✅ 기존 데이터 손실 없음
-- ✅ 중복 실행 방지 (IF NOT EXISTS)
-- =====================================================

-- 1. 기존 제약 조건 확인 및 삭제 (중복 방지)
DO $$ 
BEGIN
    -- tasks_type_check 제약이 있으면 삭제
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'tasks_type_check' 
        AND conrelid = 'tasks'::regclass
    ) THEN
        ALTER TABLE tasks DROP CONSTRAINT tasks_type_check;
    END IF;

    -- tasks_properties_json_check 제약이 있으면 삭제
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'tasks_properties_json_check' 
        AND conrelid = 'tasks'::regclass
    ) THEN
        ALTER TABLE tasks DROP CONSTRAINT tasks_properties_json_check;
    END IF;
END $$;

-- 2. 새 컬럼 추가 (중복 방지)
DO $$ 
BEGIN
    -- parent_id 컬럼 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'parent_id'
    ) THEN
        ALTER TABLE tasks ADD COLUMN parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE;
    END IF;

    -- type 컬럼 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'type'
    ) THEN
        ALTER TABLE tasks ADD COLUMN type TEXT DEFAULT 'task';
    END IF;

    -- properties 컬럼 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'properties'
    ) THEN
        ALTER TABLE tasks ADD COLUMN properties JSONB DEFAULT '{}';
    END IF;
END $$;

-- 3. type 컬럼에 체크 제약 추가 (확장 가능한 구조)
ALTER TABLE tasks
ADD CONSTRAINT tasks_type_check 
CHECK (type IN (
  'task',           -- 일반 작업
  'lesson',         -- 수업 (기존 is_auto_generated)
  'exam',           -- 시험
  'exam_question',  -- 시험 문제
  'homework',       -- 과제 (향후)
  'quiz',           -- 퀴즈
  'note',           -- 노트
  'habit',          -- 습관
  'project'         -- 프로젝트
));

-- 4. properties JSONB 유효성 체크
ALTER TABLE tasks
ADD CONSTRAINT tasks_properties_json_check 
CHECK (jsonb_typeof(properties) = 'object');

-- 5. 인덱스 추가 (성능 최적화, 중복 방지)
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_properties ON tasks USING GIN (properties);

-- 6. 기존 데이터 타입 자동 분류 (기본값이 'task'인 것만 업데이트)
UPDATE tasks
SET type = CASE
  WHEN is_auto_generated = true OR is_makeup = true THEN 'lesson'
  WHEN project_id IN (SELECT id FROM projects WHERE type = 'habit') THEN 'habit'
  ELSE 'task'
END
WHERE type = 'task';

-- 7. 완료 확인 및 통계
DO $$
DECLARE
  total_count INTEGER;
  nested_count INTEGER;
  type_stats JSONB;
BEGIN
  SELECT COUNT(*) INTO total_count FROM tasks;
  SELECT COUNT(*) INTO nested_count FROM tasks WHERE parent_id IS NOT NULL;
  
  SELECT jsonb_object_agg(type, cnt) INTO type_stats
  FROM (
    SELECT type, COUNT(*) as cnt
    FROM tasks
    GROUP BY type
  ) t;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Task 블록 리폼 완료!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '총 Task 수: %', total_count;
  RAISE NOTICE '중첩 Task 수: %', nested_count;
  RAISE NOTICE '타입별 분포: %', type_stats;
  RAISE NOTICE '========================================';
END $$;

