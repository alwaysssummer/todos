// 메모에서 체크리스트 항목 파싱
export interface ChecklistItem {
  text: string
  isCompleted: boolean
  lineIndex: number
}

export function parseChecklistFromMemo(memo: string | undefined): ChecklistItem[] {
  if (!memo) return []
  
  const items: ChecklistItem[] = []
  const lines = memo.split('\n')
  
  lines.forEach((line, index) => {
    const trimmed = line.trim()
    
    if (trimmed.startsWith('[] ')) {
      items.push({
        text: trimmed.substring(3),
        isCompleted: false,
        lineIndex: index
      })
    } else if (trimmed.startsWith('[x] ') || trimmed.startsWith('[X] ')) {
      items.push({
        text: trimmed.substring(4),
        isCompleted: true,
        lineIndex: index
      })
    }
  })
  
  return items
}

