import { useMemo } from 'react'
import type { Task } from '@/types/database'
import { getKoreanToday } from '@/utils/dateUtils'

/**
 * 태스크 필터링 결과
 */
export interface TaskFilters {
  // THE FOCUS: 장기 집중 관리 태스크
  theFocusTasks: Task[]
  
  // Focus: Today's Top 5
  focusTasks: Task[]
  
  // Today's Task: 오늘 또는 과거 due_date
  todayTasks: Task[]
  
  // Waiting: 대기 중인 태스크
  waitingTasks: Task[]
  
  // Inbox: 미분류 태스크
  inboxTasks: Task[]
  
  // Completed: 완료된 태스크
  completedTasks: Task[]
  
  // Notes: 노트 타입
  noteTasks: Task[]
  activeNotes: Task[]
  completedNotes: Task[]
  archivedNotes: Task[]
  
  // Recent: 최근 생성된 태스크/노트 (Focus/Today 제외)
  recentTasks: Task[]
}

/**
 * 태스크 필터링을 위한 커스텀 훅
 * 
 * @param tasks - 전체 태스크 배열
 * @param selectedProjectId - 선택된 프로젝트 ID (Inbox 필터링용)
 * @returns 필터링된 태스크 그룹들
 */
export function useTaskFilters(
  tasks: Task[],
  selectedProjectId: string | null = null
): TaskFilters {
  const todayStr = useMemo(() => getKoreanToday().toISOString().split('T')[0], [])

  // THE FOCUS: 장기 집중 관리 태스크
  const theFocusTasks = useMemo(() => {
    return tasks.filter(t => 
      t.is_the_focus && 
      t.status !== 'completed' && 
      t.status !== 'waiting' && 
      !t.is_auto_generated && 
      !t.is_makeup && 
      !t.parent_id && 
      t.type !== 'note'
    )
  }, [tasks])

  // Focus: Today's Top 5
  const focusTasks = useMemo(() => {
    return tasks.filter(t => 
      t.is_top5 && 
      !t.is_the_focus && 
      t.status !== 'completed' && 
      t.status !== 'waiting' && 
      !t.is_auto_generated && 
      !t.is_makeup && 
      !t.parent_id && 
      t.type !== 'note'
    )
  }, [tasks])

  // Today's Task: due_date가 오늘 또는 과거인 태스크
  const todayTasks = useMemo(() => {
    return tasks.filter(t => 
      !t.is_top5 && 
      !t.is_the_focus && 
      t.due_date && 
      t.due_date.split('T')[0] <= todayStr && 
      t.status !== 'completed' && 
      t.status !== 'waiting' && 
      !t.is_auto_generated && 
      !t.is_makeup && 
      !t.parent_id && 
      t.type !== 'note'
    )
  }, [tasks, todayStr])

  // Waiting: 대기 중인 태스크
  const waitingTasks = useMemo(() => {
    return tasks.filter(t => 
      t.status === 'waiting' && 
      !t.is_the_focus && 
      !t.is_auto_generated && 
      !t.is_makeup && 
      !t.parent_id && 
      t.type !== 'note'
    )
  }, [tasks])

  // Inbox: due_date가 없는 태스크
  const inboxTasks = useMemo(() => {
    let filtered = tasks.filter(t => 
      t.status !== 'completed' && 
      t.status !== 'waiting' && 
      !t.is_auto_generated && 
      !t.is_makeup && 
      !t.is_top5 && 
      !t.is_the_focus &&
      !t.due_date && 
      !t.parent_id && 
      t.type !== 'note'
    )
    
    // 프로젝트 필터링
    if (selectedProjectId) {
      filtered = filtered.filter(t => t.project_id === selectedProjectId)
    }
    
    // 정렬: scheduled 상태가 먼저, 그 다음 order_index
    return filtered.sort((a, b) => {
      const isYellowA = a.status === 'scheduled'
      const isYellowB = b.status === 'scheduled'
      if (isYellowA && !isYellowB) return -1
      if (!isYellowA && isYellowB) return 1
      return (a.order_index || 0) - (b.order_index || 0)
    })
  }, [tasks, selectedProjectId])

  // Completed: 완료된 태스크
  const completedTasks = useMemo(() => {
    return tasks.filter(t => 
      t.status === 'completed' && 
      !t.is_auto_generated && 
      t.type !== 'note'
    )
  }, [tasks])

  // Notes: 노트 타입
  const noteTasks = useMemo(() => {
    return tasks.filter(t => 
      t.type === 'note' && 
      !t.is_auto_generated && 
      !t.is_archived
    )
  }, [tasks])

  const activeNotes = useMemo(() => {
    return noteTasks.filter(t => t.status !== 'completed')
  }, [noteTasks])

  const completedNotes = useMemo(() => {
    return noteTasks.filter(t => t.status === 'completed')
  }, [noteTasks])

  const archivedNotes = useMemo(() => {
    return tasks.filter(t => 
      t.type === 'note' && 
      !t.is_auto_generated && 
      t.is_archived
    )
  }, [tasks])

  // Recent: 최근 생성된 태스크/노트 5개 (Focus/Today/THE FOCUS 제외)
  const recentTasks = useMemo(() => {
    return [...tasks]
      .filter(t => 
        t.status !== 'completed' && 
        !t.is_auto_generated && 
        !t.is_makeup && 
        !t.parent_id &&
        !t.is_top5 &&
        !t.is_the_focus &&
        !t.due_date
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
  }, [tasks])

  return {
    theFocusTasks,
    focusTasks,
    todayTasks,
    waitingTasks,
    inboxTasks,
    completedTasks,
    noteTasks,
    activeNotes,
    completedNotes,
    archivedNotes,
    recentTasks
  }
}
