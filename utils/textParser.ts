/**
 * 텍스트에서 태그를 추출하고 정리하는 유틸리티 함수
 * LeftPanel의 빠른 입력과 TaskDetailPopover의 통합 입력에서 공통으로 사용
 */

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

