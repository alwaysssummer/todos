import type { Task } from '@/types/database'

/**
 * 태스크 관련 헬퍼 함수들
 */

/**
 * 부모 태스크의 서브태스크 가져오기
 * 
 * @param tasks - 전체 태스크 배열
 * @param parentId - 부모 태스크 ID
 * @returns order_index로 정렬된 서브태스크 배열
 */
export function getSubtasks(tasks: Task[], parentId: string): Task[] {
  return tasks
    .filter(t => t.parent_id === parentId)
    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
}

/**
 * 체크리스트 아이템 토글
 * 
 * @param task - 대상 태스크
 * @param lineIndex - 체크리스트 라인 인덱스
 * @param newCompleted - 새로운 완료 상태
 * @returns 업데이트된 description 또는 null
 */
export function toggleChecklistItem(
  task: Task,
  lineIndex: number,
  newCompleted: boolean
): string | null {
  if (!task.description) return null

  const lines = task.description.split('\n')
  const line = lines[lineIndex]
  if (!line) return null

  // 체크박스 토글
  if (newCompleted && line.trim().startsWith('[] ')) {
    lines[lineIndex] = line.replace('[] ', '[x] ')
  } else if (!newCompleted && (line.trim().startsWith('[x] ') || line.trim().startsWith('[X] '))) {
    lines[lineIndex] = line.replace(/\[[xX]\] /, '[] ')
  } else {
    return null
  }

  return lines.join('\n')
}

/**
 * 태스크가 오늘 또는 과거 due_date를 가지는지 확인
 * 
 * @param task - 확인할 태스크
 * @returns 오늘 또는 과거 due_date 여부
 */
export function isOverdue(task: Task): boolean {
  if (!task.due_date) return false
  const { getKoreanToday } = require('./dateUtils')
  const todayStr = getKoreanToday().toISOString().split('T')[0]
  return task.due_date.split('T')[0] <= todayStr
}

/**
 * 태스크가 완료되었는지 확인
 * 
 * @param task - 확인할 태스크
 * @returns 완료 여부
 */
export function isCompleted(task: Task): boolean {
  return task.status === 'completed'
}

/**
 * 태스크가 대기 중인지 확인
 * 
 * @param task - 확인할 태스크
 * @returns 대기 여부
 */
export function isWaiting(task: Task): boolean {
  return task.status === 'waiting'
}

/**
 * 태스크가 스케줄되었는지 확인
 * 
 * @param task - 확인할 태스크
 * @returns 스케줄 여부
 */
export function isScheduled(task: Task): boolean {
  return task.status === 'scheduled'
}

/**
 * 태스크의 표시 우선순위 계산
 * 
 * @param task - 태스크
 * @returns 우선순위 점수 (낮을수록 높은 우선순위)
 */
export function calculateTaskPriority(task: Task): number {
  let priority = 0

  // THE FOCUS가 가장 높은 우선순위
  if (task.is_the_focus) priority -= 1000

  // Focus (Top 5)
  if (task.is_top5) priority -= 500

  // 오늘 할 일
  if (isOverdue(task)) priority -= 100

  // 스케줄된 태스크
  if (isScheduled(task)) priority -= 50

  // order_index 반영
  priority += (task.order_index || 0)

  return priority
}

/**
 * 태스크 배열을 우선순위로 정렬
 * 
 * @param tasks - 정렬할 태스크 배열
 * @returns 정렬된 태스크 배열
 */
export function sortTasksByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => calculateTaskPriority(a) - calculateTaskPriority(b))
}

/**
 * 태스크의 체크리스트 진행률 계산
 * 
 * @param task - 태스크
 * @returns { completed: number, total: number, percentage: number }
 */
export function calculateChecklistProgress(task: Task): {
  completed: number
  total: number
  percentage: number
} {
  if (!task.description) {
    return { completed: 0, total: 0, percentage: 0 }
  }

  const lines = task.description.split('\n')
  const checklistItems = lines.filter(line => 
    line.trim().startsWith('[] ') || 
    line.trim().startsWith('[x] ') || 
    line.trim().startsWith('[X] ')
  )

  const total = checklistItems.length
  const completed = checklistItems.filter(line => 
    line.trim().startsWith('[x] ') || 
    line.trim().startsWith('[X] ')
  ).length

  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

  return { completed, total, percentage }
}
