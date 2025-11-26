/**
 * 텍스트에서 태그를 추출하고 정리하는 유틸리티 함수
 * LeftPanel의 빠른 입력과 TaskDetailPopover의 통합 입력에서 공통으로 사용
 */

/**
 * 긴 입력을 제목과 메모로 분리
 * - 첫 줄 또는 50자까지를 제목으로 사용
 * - 나머지는 메모로 저장 (전체 원본 포함)
 */
export function splitTitleAndDescription(text: string): { title: string; description?: string } {
  const trimmed = text.trim()
  
  // 빈 입력 처리
  if (!trimmed) {
    return { title: '' }
  }
  
  // 줄바꿈 기준으로 분리
  const lines = trimmed.split('\n')
  const firstLine = lines[0].trim()
  
  // 첫 줄이 50자 이하이고, 여러 줄이면 → 첫 줄 = 제목, 전체 = 메모
  if (firstLine.length <= 50 && lines.length > 1) {
    return {
      title: firstLine,
      description: trimmed // 전체 원본을 메모에 저장
    }
  }
  
  // 첫 줄이 50자 초과면 → 50자까지 제목, 전체 = 메모
  if (firstLine.length > 50) {
    // 50자 근처에서 단어 단위로 자르기
    let cutIndex = 50
    const spaceIndex = firstLine.lastIndexOf(' ', 50)
    if (spaceIndex > 30) {
      cutIndex = spaceIndex
    }
    
    return {
      title: firstLine.substring(0, cutIndex).trim() + '...',
      description: trimmed // 전체 원본을 메모에 저장
    }
  }
  
  // 짧은 한 줄 입력 → 제목만
  return { title: firstLine }
}

export function extractTags(text: string): { cleanTitle: string; tags: string[] } {
  const tags: string[] = []

  // 1. [[inline tag]] 추출 및 변환
  const inlineTagRegex = /\[\[([^\]]+)\]\]/g
  let cleanTitle = text.replace(inlineTagRegex, (match, tag) => {
    tags.push(tag.trim())
    return tag.trim()  // [[태그]] -> 태그
  })

  // 2. #hashtag 추출
  const hashtagRegex = /#([\w가-힣]+)/g
  const hashtagMatches = cleanTitle.match(hashtagRegex)
  if (hashtagMatches) {
    hashtagMatches.forEach(tag => {
      tags.push(tag.substring(1))  // # 제거
    })
  }

  // 3. #hashtag는 제목에서 제거하지 않음 (연하게 표시할 예정)

  return { cleanTitle: cleanTitle.trim(), tags: [...new Set(tags)] }  // 중복 제거
}

