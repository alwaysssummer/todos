-- tasks 테이블에 tags 컬럼 추가
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags TEXT[];

-- tags 컬럼에 GIN 인덱스 추가 (배열 검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_tasks_tags ON tasks USING GIN(tags);
