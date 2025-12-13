// 파싱된 단원 정보
export interface ParsedChapter {
  chapterNumber: string;  // 사용 안 함 (빈 문자열)
  chapterName: string;    // 한 줄 전체 텍스트
}

/**
 * 텍스트를 파싱하여 단원 목록으로 변환
 * 
 * 각 줄을 하나의 단원으로 처리합니다.
 * 빈 줄은 자동으로 무시됩니다.
 * 
 * 예시:
 * - "01-01 주어 + 수식어" → 그대로 단원명으로 등록
 * - "불완전자동사(1): ~상태로 있다" → 그대로 단원명으로 등록
 * 
 * @param text 붙여넣은 텍스트
 * @returns 파싱된 단원 배열
 */
export function parseChapterText(text: string): ParsedChapter[] {
  if (!text || !text.trim()) {
    return [];
  }

  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  // 각 줄을 그대로 단원명으로 사용
  return lines.map(line => ({
    chapterNumber: '',  // 사용 안 함
    chapterName: line   // 한 줄 전체
  }));
}
