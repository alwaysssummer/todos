import type { Task } from '@/types/database'

/**
 * 메모에서 체크리스트 항목 추출
 */
export interface ChecklistItem {
  text: string
  isCompleted: boolean
  lineIndex: number
}

export function parseChecklistFromMemo(memo: string): ChecklistItem[] {
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

/**
 * 체크리스트 항목을 하위 테스크로 변환
 */
export function checklistItemToSubtask(
  item: ChecklistItem,
  parentId: string
): Partial<Task> {
  return {
    title: item.text,
    parent_id: parentId,
    status: item.isCompleted ? 'completed' : 'inbox',
    is_top5: false,
    order_index: item.lineIndex
  }
}

/**
 * 메모와 하위 테스크 동기화
 * - 메모에 있는 체크리스트 → 하위 테스크 생성/업데이트
 * - 메모에서 삭제된 항목 → 하위 테스크 삭제
 */
export async function syncChecklistWithSubtasks(
  parentTask: Task,
  existingSubtasks: Task[],
  createTask: (task: Partial<Task>) => Promise<any>,
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>,
  deleteTask: (id: string) => Promise<void>
): Promise<void> {
  const memo = parentTask.description || ''
  const checklistItems = parseChecklistFromMemo(memo)
  
  // 기존 하위 테스크 중 이 부모의 것만 필터
  const currentSubtasks = existingSubtasks.filter(t => t.parent_id === parentTask.id)
  
  // 체크리스트 항목과 기존 하위 테스크 매칭
  const processedSubtaskIds = new Set<string>()
  
  for (const item of checklistItems) {
    // 같은 제목의 기존 하위 테스크 찾기
    const existingSubtask = currentSubtasks.find(
      st => st.title === item.text && !processedSubtaskIds.has(st.id)
    )
    
    if (existingSubtask) {
      // 기존 하위 테스크 업데이트 (상태만)
      processedSubtaskIds.add(existingSubtask.id)
      
      const newStatus = item.isCompleted ? 'completed' : 'inbox'
      if (existingSubtask.status !== newStatus) {
        await updateTask(existingSubtask.id, { 
          status: newStatus,
          order_index: item.lineIndex 
        })
      }
    } else {
      // 새 하위 테스크 생성
      const newSubtask = checklistItemToSubtask(item, parentTask.id)
      await createTask(newSubtask)
    }
  }
  
  // 메모에서 삭제된 항목의 하위 테스크 삭제
  for (const subtask of currentSubtasks) {
    if (!processedSubtaskIds.has(subtask.id)) {
      // 메모에 더 이상 없는 항목 → 삭제
      const stillExists = checklistItems.some(item => item.text === subtask.title)
      if (!stillExists) {
        await deleteTask(subtask.id)
      }
    }
  }
}

/**
 * 하위 테스크 상태 변경 시 메모 업데이트
 */
export function updateMemoFromSubtaskToggle(
  memo: string,
  subtaskTitle: string,
  isCompleted: boolean
): string {
  const lines = memo.split('\n')
  
  const updatedLines = lines.map(line => {
    const trimmed = line.trim()
    
    // 해당 제목의 체크리스트 항목 찾기
    if (trimmed.startsWith('[] ') && trimmed.substring(3) === subtaskTitle) {
      if (isCompleted) {
        return line.replace('[] ', '[x] ')
      }
    } else if ((trimmed.startsWith('[x] ') || trimmed.startsWith('[X] ')) && trimmed.substring(4) === subtaskTitle) {
      if (!isCompleted) {
        return line.replace(/\[[xX]\] /, '[] ')
      }
    }
    
    return line
  })
  
  return updatedLines.join('\n')
}

