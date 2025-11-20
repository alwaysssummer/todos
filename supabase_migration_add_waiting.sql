-- tasks 테이블의 status 컬럼 제약조건을 수정하여 'waiting' 상태를 허용합니다.
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('inbox', 'scheduled', 'completed', 'cancelled', 'waiting'));
