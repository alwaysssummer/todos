-- 교재에 로컬 폴더 경로 필드 추가
-- 실행: Supabase SQL Editor에서 실행

ALTER TABLE textbooks ADD COLUMN IF NOT EXISTS local_path TEXT;

-- 설명:
-- local_path: 로컬 폴더 경로 (예: D:/Main_Box/Dropbox/my_lec/teacher/02_내신/25년_2학기_기말)
-- 웹앱에서 openfolder:// 프로토콜을 통해 Windows 탐색기로 직접 열기 가능
