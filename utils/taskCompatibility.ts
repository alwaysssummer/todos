import { Task } from '@/types/database'
import { isSameDay } from 'date-fns'

/**
 * 블록 기반 Task 시스템 호환성 헬퍼
 * - 기존 로직과의 호환성 유지
 * - 중첩 Task 처리
 */

/**
 * 인박스 필터링 (기존 로직 유지)
 * - status가 'inbox'
 * - 자동 생성 수업 제외
 * - 보충 수업 제외
 * - 중첩 Task 제외 (루트만)
 */
export function getInboxTasks(tasks: Task[]): Task[] {
  return tasks.filter(t => 
    t.status === 'inbox' &&
    !t.is_auto_generated &&
    !t.is_makeup &&
    !t.parent_id  // 🆕 중첩 Task 제외
  )
}

/**
 * Top5 필터링 (기존 로직 유지)
 * - is_top5가 true
 * - 중첩 Task 제외 (루트만)
 * - 최대 5개
 */
export function getTop5Tasks(tasks: Task[]): Task[] {
  return tasks
    .filter(t => t.is_top5 && !t.parent_id)  // 🆕 중첩 제외
    .sort((a, b) => a.order_index - b.order_index)
    .slice(0, 5)
}

/**
 * 오늘 할 일 필터링 (기존 로직 유지)
 * - due_date가 오늘
 * - 중첩 Task 제외 (루트만)
 */
export function getTodayTasks(tasks: Task[]): Task[] {
  const today = new Date()
  return tasks.filter(t =>
    t.due_date &&
    isSameDay(new Date(t.due_date), today) &&
    !t.parent_id  // 🆕 중첩 제외
  )
}

/**
 * 캘린더 표시용 Task 필터링 (기존 로직 유지)
 * - start_time이 특정 날짜
 * - 중첩 Task 제외 (루트만 표시)
 */
export function getCalendarTasks(tasks: Task[], date: Date): Task[] {
  return tasks.filter(t =>
    t.start_time &&
    isSameDay(new Date(t.start_time), date) &&
    !t.parent_id  // 🆕 중첩 Task 제외 (부모만 표시)
  )
}

/**
 * 학생 수업만 필터링 (기존 로직 유지)
 * - is_auto_generated 또는 is_makeup
 * - 중첩 Task 제외
 */
export function getStudentLessons(tasks: Task[]): Task[] {
  return tasks.filter(t =>
    (t.is_auto_generated || t.is_makeup) &&
    !t.parent_id  // 🆕 중첩 제외
  )
}

/**
 * 완료된 Task 필터링 (기존 로직 유지)
 * - status가 'completed'
 * - 중첩 Task 제외
 */
export function getCompletedTasks(tasks: Task[]): Task[] {
  return tasks.filter(t =>
    t.status === 'completed' &&
    !t.parent_id  // 🆕 중첩 제외
  )
}

/**
 * 예정된 Task 필터링 (기존 로직 유지)
 * - status가 'scheduled'
 * - 중첩 Task 제외
 */
export function getScheduledTasks(tasks: Task[]): Task[] {
  return tasks.filter(t =>
    t.status === 'scheduled' &&
    !t.parent_id  // 🆕 중첩 제외
  )
}

// =====================================================
// 블록 기반 새 기능 헬퍼
// =====================================================

/**
 * 특정 Task의 직계 자식들 가져오기
 */
export function getChildTasks(tasks: Task[], parentId: string): Task[] {
  return tasks.filter(t => t.parent_id === parentId)
}

/**
 * 특정 Task의 모든 자손 가져오기 (재귀)
 */
export function getAllDescendants(tasks: Task[], parentId: string): Task[] {
  const children = getChildTasks(tasks, parentId)
  const descendants: Task[] = [...children]
  
  children.forEach(child => {
    descendants.push(...getAllDescendants(tasks, child.id))
  })
  
  return descendants
}

/**
 * Task의 계층 깊이 계산
 */
export function getTaskDepth(tasks: Task[], taskId: string): number {
  const task = tasks.find(t => t.id === taskId)
  if (!task || !task.parent_id) return 0
  return 1 + getTaskDepth(tasks, task.parent_id)
}

/**
 * 루트 Task만 필터링 (중첩되지 않은 Task)
 */
export function getRootTasks(tasks: Task[]): Task[] {
  return tasks.filter(t => !t.parent_id)
}

/**
 * Task가 루트인지 확인
 */
export function isRootTask(task: Task): boolean {
  return !task.parent_id
}

/**
 * Task가 자식을 가지고 있는지 확인
 */
export function hasChildren(tasks: Task[], taskId: string): boolean {
  return tasks.some(t => t.parent_id === taskId)
}

/**
 * 시험 Task만 필터링
 */
export function getExamTasks(tasks: Task[]): Task[] {
  return tasks.filter(t => t.type === 'exam')
}

/**
 * 특정 시험의 문제들 가져오기
 */
export function getExamQuestions(tasks: Task[], examId: string): Task[] {
  return tasks.filter(t => 
    t.parent_id === examId && 
    t.type === 'exam_question'
  ).sort((a, b) => a.order_index - b.order_index)
}

/**
 * 퀴즈 Task만 필터링
 */
export function getQuizTasks(tasks: Task[]): Task[] {
  return tasks.filter(t => t.type === 'quiz')
}

/**
 * 노트 Task만 필터링
 */
export function getNoteTasks(tasks: Task[]): Task[] {
  return tasks.filter(t => t.type === 'note')
}

// =====================================================
// 호환성 검증 헬퍼
// =====================================================

/**
 * 기존 로직과 새 로직의 결과가 같은지 검증
 * (개발/디버깅용)
 */
export function validateCompatibility(tasks: Task[]): {
  isCompatible: boolean
  errors: string[]
} {
  const errors: string[] = []

  // 1. 모든 중첩 Task는 유효한 부모를 가져야 함
  const nestedTasks = tasks.filter(t => t.parent_id)
  nestedTasks.forEach(task => {
    const parent = tasks.find(t => t.id === task.parent_id)
    if (!parent) {
      errors.push(`Task ${task.id} (${task.title})의 부모 ${task.parent_id}를 찾을 수 없습니다.`)
    }
  })

  // 2. 순환 참조 검사
  nestedTasks.forEach(task => {
    const visited = new Set<string>()
    let current: Task | undefined = task
    
    while (current && current.parent_id) {
      if (visited.has(current.id)) {
        errors.push(`Task ${task.id} (${task.title})에 순환 참조가 있습니다.`)
        break
      }
      visited.add(current.id)
      current = tasks.find(t => t.id === current?.parent_id)
    }
  })

  // 3. type 필드가 유효한지 검사
  const validTypes = ['task', 'lesson', 'exam', 'exam_question', 'homework', 'quiz', 'note', 'habit', 'project']
  tasks.forEach(task => {
    if (task.type && !validTypes.includes(task.type)) {
      errors.push(`Task ${task.id} (${task.title})의 type '${task.type}'이 유효하지 않습니다.`)
    }
  })

  // 4. properties가 유효한 JSON 객체인지 검사
  tasks.forEach(task => {
    if (task.properties && typeof task.properties !== 'object') {
      errors.push(`Task ${task.id} (${task.title})의 properties가 객체가 아닙니다.`)
    }
  })

  return {
    isCompatible: errors.length === 0,
    errors
  }
}

/**
 * 기존 필드 기반 Task를 블록 기반으로 마이그레이션
 * (선택사항 - 향후 사용)
 */
export function migrateToBlockBased(task: Task): Task {
  // 이미 type이 설정되어 있으면 그대로 반환
  if (task.type && task.type !== 'task') {
    return task
  }

  // 학생 수업인 경우
  if (task.is_auto_generated || task.is_makeup) {
    return {
      ...task,
      type: 'lesson'
    }
  }

  // 습관인 경우
  if (task.habit_completed !== undefined) {
    return {
      ...task,
      type: 'habit'
    }
  }

  // 기본값
  return {
    ...task,
    type: 'task'
  }
}



