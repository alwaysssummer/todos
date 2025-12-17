// 파싱된 단원 정보
export interface ParsedChapter {
  chapterNumber: string;  // "01-01", "02-03" 등
  chapterName: string;    // "주어 + 수식어" 등
}

/**
 * 텍스트를 파싱하여 단원 목록으로 변환
 * 
 * 지원 포맷:
 * - "01-01 주어 + 수식어"
 * - "02-03 불완전자동사(3): 감각동사"
 * - "1강 함수의 극한"
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
  
  const results: ParsedChapter[] = [];
  
  // 패턴 1: "01-01 주어 + 수식어" (XX-XX 형식 + 공백 + 단원명)
  const pattern1 = /^(\d+(?:-\d+)?)\s+(.+)$/;
  
  // 패턴 2: "01강 함수의 극한" (XX강 형식 + 공백 + 단원명)
  const pattern2 = /^(\d+)\s*강\s+(.+)$/;
  
  for (const line of lines) {
    let match;
    
    // 패턴 1 시도
    if (match = pattern1.exec(line)) {
      results.push({
        chapterNumber: match[1],
        chapterName: match[2].trim()
      });
      continue;
    }
    
    // 패턴 2 시도
    if (match = pattern2.exec(line)) {
      results.push({
        chapterNumber: match[1],
        chapterName: match[2].trim()
      });
      continue;
    }
    
    // 매칭되지 않는 라인은 무시
  }
  
  return results;
}
