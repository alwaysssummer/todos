-- =====================================================
-- Notion Links Table (프로젝트 링크 관리)
-- =====================================================

CREATE TABLE notion_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 추가 (정렬 최적화)
CREATE INDEX idx_notion_links_order ON notion_links(order_index);

-- RLS 비활성화 (개인 사용)
ALTER TABLE notion_links DISABLE ROW LEVEL SECURITY;

