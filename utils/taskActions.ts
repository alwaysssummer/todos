import { extractTags, splitTitleAndDescription, extractAllTags } from './textParser'
import type { Task } from '@/types/database'
import type { DragEndEvent } from '@dnd-kit/core'

/**
 * 태스크 입력 파싱 결과
 */
export interface ParsedTaskInput {
  cleanTitle: string
  description?: string
  isTop5: boolean
  dueDate?: string
  tags?: string[]
}

/**
 * 사용자 입력을 파싱하여 태스크 생성에 필요한 데이터로 변환
 * 
 * @param input - 사용자 입력 문자열
 * @returns 파싱된 태스크 데이터
 * 
 * @example
 * parseTaskInput("*중요한 일 | 설명입니다 #태그1 #태그2")
 * // { cleanTitle: "중요한 일", description: "설명입니다 #태그1 #태그2", isTop5: true, tags: ["태그1", "태그2"] }
 * 
 * @example
 * parseTaskInput("/오늘 할 일")
 * // { cleanTitle: "오늘 할 일", isTop5: false, dueDate: "2024-01-01T00:00:00.000Z" }
 */
export function parseTaskInput(input: string): ParsedTaskInput {
  let title = input.trim()
  let isTop5 = false
  let dueDate: string | undefined = undefined

  // 접두사 처리
  if (title.startsWith('*')) {
    isTop5 = true
    title = title.substring(1).trim()
  } else if (title.startsWith('/')) {
    dueDate = new Date().toISOString()
    title = title.substring(1).trim()
  }

  // 제목과 설명 분리
  const { title: splitTitle, description } = splitTitleAndDescription(title)
  
  // 태그 추출
  const { cleanTitle } = extractTags(splitTitle)
  const allTags = extractAllTags(splitTitle, description)

  return {
    cleanTitle,
    description,
    isTop5,
    dueDate,
    tags: allTags.length > 0 ? allTags : undefined
  }
}

/**
 * 파싱된 데이터로 태스크 생성
 * 
 * @param parsedData - parseTaskInput의 결과
 * @param createTask - 태스크 생성 함수
 * @param type - 태스크 타입 ('task' | 'note')
 * @returns 생성된 태스크
 */
export async function createTaskFromParsedData(
  parsedData: ParsedTaskInput,
  createTask: (task: Partial<Task>) => Promise<Task | undefined>,
  type: 'task' | 'note' = 'task'
): Promise<Task | undefined> {
  const { cleanTitle, description, isTop5, dueDate, tags } = parsedData

  return await createTask({
    title: cleanTitle,
    description,
    status: 'inbox',
    is_top5: isTop5,
    due_date: dueDate,
    tags,
    type
  })
}

/**
 * 사용자 입력으로부터 태스크를 생성하는 통합 함수
 * 
 * @param input - 사용자 입력 문자열
 * @param createTask - 태스크 생성 함수
 * @param type - 태스크 타입
 * @returns 생성된 태스크
 */
export async function createTaskFromInput(
  input: string,
  createTask: (task: Partial<Task>) => Promise<Task | undefined>,
  type: 'task' | 'note' = 'task'
): Promise<Task | undefined> {
  const parsedData = parseTaskInput(input)
  return await createTaskFromParsedData(parsedData, createTask, type)
}

/**
 * Drag & Drop 이벤트 처리 헬퍼
 */

/**
 * 드래그 ID에서 실제 ID 추출
 */
function extractRealId(id: string): string {
  return id.replace(/-inbox$/, '').replace(/-waiting$/, '').replace(/-note$/, '')
}

/**
 * 컨테이너로 드롭했을 때 태스크 업데이트 계산
 */
export function calculateContainerDropUpdates(
  containerId: string,
  task: Task,
  todayStr: string
): Partial<Task> | null {
  const updates: Partial<Task> = {}

  switch (containerId) {
    case 'the-focus-container':
      updates.is_the_focus = true
      updates.is_top5 = false
      updates.due_date = undefined
      updates.status = task.status === 'waiting' ? 'inbox' : task.status
      break

    case 'focus-container':
      updates.is_top5 = true
      updates.is_the_focus = false
      updates.status = task.status === 'waiting' ? 'inbox' : task.status
      break

    case 'today-container':
      updates.is_top5 = false
      updates.is_the_focus = false
      updates.due_date = todayStr
      updates.status = task.status === 'waiting' ? 'inbox' : task.status
      break

    case 'inbox-container':
      updates.is_top5 = false
      updates.is_the_focus = false
      updates.due_date = undefined
      updates.status = 'inbox'
      break

    case 'waiting-container':
      updates.status = 'waiting'
      updates.is_top5 = false
      updates.is_the_focus = false
      updates.due_date = null
      updates.start_time = null
      updates.duration = null
      break

    default:
      return null
  }

  return Object.keys(updates).length > 0 ? updates : null
}

/**
 * 태스크 간 드롭했을 때 업데이트 계산
 */
export function calculateTaskDropUpdates(
  activeTask: Task,
  overId: string,
  activeId: string,
  focusTasks: Task[],
  todayTasks: Task[],
  todayStr: string
): { updates: Partial<Task>; shouldUpdate: boolean } {
  const realOverId = extractRealId(overId)
  const isOverInboxList = overId.endsWith('-inbox')
  const isOverWaitingList = overId.endsWith('-waiting')
  const isOverFocusList = focusTasks.some(t => t.id === realOverId) && !isOverInboxList && !isOverWaitingList
  const isOverTodayList = todayTasks.some(t => t.id === realOverId) && !isOverInboxList && !isOverWaitingList

  const updates: Partial<Task> = {}
  let shouldUpdate = false

  if (isOverFocusList && (!activeTask.is_top5 || activeTask.status === 'waiting')) {
    updates.is_top5 = true
    if (activeTask.status === 'waiting') updates.status = 'inbox'
    shouldUpdate = true
  } else if (isOverTodayList && (activeTask.is_top5 || !activeTask.due_date || activeTask.status === 'waiting')) {
    updates.is_top5 = false
    updates.due_date = todayStr
    if (activeTask.status === 'waiting') updates.status = 'inbox'
    shouldUpdate = true
  } else if (isOverWaitingList && activeTask.status !== 'waiting') {
    updates.status = 'waiting'
    updates.is_top5 = false
    updates.due_date = null
    updates.start_time = null
    updates.duration = null
    shouldUpdate = true
  } else if (isOverInboxList) {
    if (activeTask.status === 'waiting') {
      updates.status = 'inbox'
      updates.is_top5 = false
      updates.due_date = undefined
      shouldUpdate = true
    } else if (!activeId.endsWith('-inbox')) {
      updates.is_top5 = false
      updates.due_date = undefined
      shouldUpdate = true
    }
  }

  return { updates, shouldUpdate }
}

/**
 * Drag End 이벤트 처리
 */
export async function handleTaskDragEnd(
  event: DragEndEvent,
  tasks: Task[],
  focusTasks: Task[],
  todayTasks: Task[],
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>,
  reorderTasks: (activeId: string, overId: string) => void,
  reorderLinks?: (activeId: string, overId: string) => Promise<void>
): Promise<void> {
  const { active, over } = event
  if (!over) return

  const activeId = active.id as string
  const overId = over.id as string

  // Notion Link 재정렬
  if (activeId.startsWith('notion-link-') && overId.startsWith('notion-link-')) {
    const realActiveId = activeId.replace('notion-link-', '')
    const realOverId = overId.replace('notion-link-', '')
    if (realActiveId !== realOverId && reorderLinks) {
      await reorderLinks(realActiveId, realOverId)
    }
    return
  }

  const realActiveId = extractRealId(activeId)
  const realOverId = extractRealId(overId)
  const { getKoreanToday } = require('./dateUtils')
  const todayStr = getKoreanToday().toISOString().split('T')[0]

  // 컨테이너로 드롭
  const containerIds = ['the-focus-container', 'focus-container', 'today-container', 'inbox-container', 'waiting-container']
  if (containerIds.includes(overId)) {
    const task = tasks.find(t => t.id === realActiveId)
    if (!task) return

    const updates = calculateContainerDropUpdates(overId, task, todayStr)
    if (updates) {
      await updateTask(realActiveId, updates)
    }
    return
  }

  // 태스크 간 드롭
  if (activeId !== overId) {
    const activeTask = tasks.find(t => t.id === realActiveId)
    const overTask = tasks.find(t => t.id === realOverId)

    if (activeTask && overTask) {
      const { updates, shouldUpdate } = calculateTaskDropUpdates(
        activeTask,
        overId,
        activeId,
        focusTasks,
        todayTasks,
        todayStr
      )

      if (shouldUpdate) {
        await updateTask(realActiveId, updates)
      } else {
        reorderTasks(realActiveId, realOverId)
      }
    }
  }
}
