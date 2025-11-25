-- ============================================
-- 루틴(Routine) 기능 테이블 생성 SQL
-- 실행 위치: Supabase SQL Editor
-- ============================================

-- 1. 기존 테이블 삭제 (있을 경우)
DROP TABLE IF EXISTS routine_logs CASCADE;
DROP TABLE IF EXISTS routines CASCADE;

-- 2. 루틴 테이블 생성
CREATE TABLE routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  repeat_days INTEGER[] DEFAULT '{0,1,2,3,4,5,6}',  -- 0=일, 1=월, ... 6=토 (기본값: 매일)
  target_time TEXT,                                  -- "07:00" 형식 (선택)
  is_active BOOLEAN DEFAULT TRUE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 루틴 기록 테이블 생성
CREATE TABLE routine_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(routine_id, date)  -- 루틴+날짜 조합은 유일
);

-- 4. 인덱스 생성 (성능 최적화)
CREATE INDEX idx_routines_active ON routines(is_active);
CREATE INDEX idx_routines_order ON routines(order_index);
CREATE INDEX idx_routine_logs_date ON routine_logs(date);
CREATE INDEX idx_routine_logs_routine ON routine_logs(routine_id);
CREATE INDEX idx_routine_logs_routine_date ON routine_logs(routine_id, date);

-- 5. RLS 비활성화 (개인 사용)
ALTER TABLE routines DISABLE ROW LEVEL SECURITY;
ALTER TABLE routine_logs DISABLE ROW LEVEL SECURITY;

-- 6. 테스트 데이터 (선택사항 - 필요시 주석 해제)
-- INSERT INTO routines (title, repeat_days, order_index) VALUES
--   ('운동하기', '{1,2,3,4,5}', 0),      -- 월~금
--   ('영어 공부', '{0,1,2,3,4,5,6}', 1), -- 매일
--   ('독서 30분', '{0,6}', 2);           -- 주말만

-- ============================================
-- 실행 완료 후 확인:
-- SELECT * FROM routines;
-- SELECT * FROM routine_logs;
-- ============================================


