-- 교재 즐겨찾기 기능 추가
-- textbooks 테이블에 is_favorite 컬럼 추가

ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;

-- 인덱스 추가 (즐겨찾기 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_textbooks_is_favorite ON textbooks(is_favorite);

