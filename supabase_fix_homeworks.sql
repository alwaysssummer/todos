-- homeworks 테이블 RLS 정책 재설정 및 권한 확인
ALTER TABLE homeworks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for homeworks" ON homeworks;

CREATE POLICY "Enable all access for homeworks" ON homeworks
    FOR ALL USING (true) WITH CHECK (true);

-- 인덱스 이름이 틀렸을 수 있으므로 확인 (upsert onConflict 용)
-- task_id가 NULL인 경우도 고려해야 하지만, 현재 로직상 task_id는 필수
-- 기존 인덱스 삭제 후 다시 생성 (확실하게 하기 위해)
DROP INDEX IF EXISTS idx_unique_lesson_homework;

CREATE UNIQUE INDEX idx_unique_lesson_homework 
ON homeworks(task_id, textbook_id, chapter) 
WHERE task_id IS NOT NULL;







