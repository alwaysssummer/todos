-- projects 테이블에 학생 관련 필드 추가
-- 수업료(만원 단위)와 비공개 여부 필드

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tuition INTEGER;

COMMENT ON COLUMN projects.is_private IS '비공개 수업 여부';
COMMENT ON COLUMN projects.tuition IS '수업료 (만원 단위, 12 = 12만원)';

-- 인덱스 추가 (필터링 최적화)
CREATE INDEX IF NOT EXISTS idx_projects_is_private ON projects(is_private) WHERE is_private = true;

