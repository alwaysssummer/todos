-- Daily Notes 테이블 생성
-- 일기, 이벤트, 여행 일지 등을 기록하는 테이블

CREATE TABLE IF NOT EXISTS daily_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  date DATE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  emoji TEXT DEFAULT '📅',
  
  -- 확장 필드 (Phase 2)
  photos TEXT[],
  location JSONB,
  weather TEXT,
  mood INTEGER CHECK (mood >= 1 AND mood <= 5),
  tags TEXT[],
  is_private BOOLEAN DEFAULT false,
  category TEXT DEFAULT 'diary',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT daily_notes_user_date_unique UNIQUE(user_id, date)
);

-- RLS 활성화
ALTER TABLE daily_notes ENABLE ROW LEVEL SECURITY;

-- 정책: 본인 기록만 접근
CREATE POLICY "Users can view own daily notes"
  ON daily_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily notes"
  ON daily_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily notes"
  ON daily_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily notes"
  ON daily_notes FOR DELETE
  USING (auth.uid() = user_id);

-- 인덱스
CREATE INDEX idx_daily_notes_user_date ON daily_notes(user_id, date);
CREATE INDEX idx_daily_notes_date ON daily_notes(date);
CREATE INDEX idx_daily_notes_category ON daily_notes(category);
CREATE INDEX idx_daily_notes_tags ON daily_notes USING GIN(tags);

-- 업데이트 트리거
CREATE OR REPLACE FUNCTION update_daily_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_daily_notes_updated_at
  BEFORE UPDATE ON daily_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_notes_updated_at();

-- 코멘트
COMMENT ON TABLE daily_notes IS '사용자의 일일 기록 (일기, 이벤트, 여행 일지 등)';
COMMENT ON COLUMN daily_notes.location IS 'JSON: {lat: number, lng: number, address: string, place_name: string}';
COMMENT ON COLUMN daily_notes.mood IS '1(매우 나쁨) ~ 5(매우 좋음)';
COMMENT ON COLUMN daily_notes.category IS 'diary(일기), event(이벤트), travel(여행), memory(추억)';

