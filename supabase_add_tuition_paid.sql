-- projects 테이블에 수업료 납부 여부 컬럼 추가
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS tuition_paid BOOLEAN DEFAULT false;

COMMENT ON COLUMN projects.tuition_paid IS '이번 달 수업료 납부 여부';

-- 인덱스 추가 (미납 학생 필터링 최적화)
CREATE INDEX IF NOT EXISTS idx_projects_tuition_paid ON projects(tuition_paid) WHERE tuition_paid = false;

