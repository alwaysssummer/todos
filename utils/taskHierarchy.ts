import type { Task } from '@/types/database'

// 태스크 계층 올리기
export async function moveTaskUp(
  task: Task,
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
) {
  const todayStr = new Date().toISOString().split('T')[0]
  const updates: Partial<Task> = {}
  
  // 더 포커스에서는 올릴 수 없음
  if (task.is_the_focus) return
  
  if (!task.is_top5 && (!task.due_date || task.due_date.split('T')[0] > todayStr)) {
    // 인박스 → 투데이즈 테스크
    updates.due_date = todayStr
  } else if (!task.is_top5 && task.due_date && task.due_date.split('T')[0] <= todayStr) {
    // 투데이즈 테스크 → 투데이즈 포커스
    updates.is_top5 = true
  } else if (task.is_top5) {
    // 투데이즈 포커스 → 더 포커스
    updates.is_the_focus = true
    updates.is_top5 = false
  }
  
  await updateTask(task.id, updates)
}

// 태스크 계층 내리기
export async function moveTaskDown(
  task: Task,
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
) {
  const updates: Partial<Task> = {}
  
  // 인박스에서는 내릴 수 없음
  const todayStr = new Date().toISOString().split('T')[0]
  const isInbox = !task.is_the_focus && !task.is_top5 && (!task.due_date || task.due_date.split('T')[0] > todayStr)
  if (isInbox) return
  
  if (task.is_the_focus) {
    // 더 포커스 → 투데이즈 포커스
    updates.is_the_focus = false
    updates.is_top5 = true
  } else if (task.is_top5) {
    // 투데이즈 포커스 → 투데이즈 테스크
    updates.is_top5 = false
  } else if (task.due_date && task.due_date.split('T')[0] <= todayStr) {
    // 투데이즈 테스크 → 인박스
    updates.due_date = null
  }
  
  await updateTask(task.id, updates)
}
