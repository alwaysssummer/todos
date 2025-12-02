'use client'

import { useMemo } from 'react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Task } from '@/types/database'
import SortableTaskItem from './SortableTaskItem'
import DroppableContainer from './DroppableContainer'
import { parseChecklistFromMemo } from '@/utils/checklistParser'

interface MainTabProps {
  focusTasks: Task[]
  todayTasks: Task[]
  recentTasks: Task[]
  theFocusTasks: Task[]  // THE FOCUS 태스크
  completingIds: Set<string>
  expandedTaskIds: Set<string>
  onTaskClick: (e: React.MouseEvent, task: Task) => void
  onToggleComplete: (task: Task) => void
  onChecklistToggle: (task: Task, lineIndex: number, newCompleted: boolean) => void
  onToggleExpand: (taskId: string) => void
  onConvertType: (task: Task, newType: 'task' | 'note') => void
  getSubtasks: (parentId: string) => Task[]
  toggleTaskStatus: (id: string, status: string) => void
}

export default function MainTab({
  focusTasks,
  todayTasks,
  recentTasks,
  theFocusTasks,
  completingIds,
  expandedTaskIds,
  onTaskClick,
  onToggleComplete,
  onChecklistToggle,
  onToggleExpand,
  onConvertType,
  getSubtasks,
  toggleTaskStatus,
}: MainTabProps) {
  // 체크리스트 개수(분모) 기준으로 정렬 (많은 순)
  const sortedFocusTasks = useMemo(() => {
    return [...focusTasks].sort((a, b) => {
      const aCount = parseChecklistFromMemo(a.description).length
      const bCount = parseChecklistFromMemo(b.description).length
      return bCount - aCount
    })
  }, [focusTasks])

  const sortedTodayTasks = useMemo(() => {
    return [...todayTasks].sort((a, b) => {
      const aCount = parseChecklistFromMemo(a.description).length
      const bCount = parseChecklistFromMemo(b.description).length
      return bCount - aCount
    })
  }, [todayTasks])

  // THE FOCUS 태스크 정렬
  const sortedTheFocusTasks = useMemo(() => {
    return [...theFocusTasks].sort((a, b) => {
      const aCount = parseChecklistFromMemo(a.description).length
      const bCount = parseChecklistFromMemo(b.description).length
      return bCount - aCount
    })
  }, [theFocusTasks])

  return (
    <div className="space-y-0">
      {/* THE FOCUS - 장기 집중 관리 영역 */}
      <div className="border-b border-gray-200">
        <DroppableContainer id="the-focus-container" title="THE FOCUS" titleColor="text-gray-900">
          <SortableContext items={sortedTheFocusTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {sortedTheFocusTasks.length === 0 && (
                <div className="text-xs text-gray-400 text-center py-2">
                  장기 집중 태스크를 이곳으로 드래그하세요
                </div>
              )}
              {sortedTheFocusTasks.map((task) => (
                <div 
                  key={task.id}
                  className="border-b-2 border-gray-900 [&_.task-title]:font-black [&_.task-title]:text-gray-900"
                >
                  <SortableTaskItem
                    task={task}
                    isCompleting={completingIds.has(task.id)}
                    isExpanded={expandedTaskIds.has(task.id)}
                    onClick={(e) => onTaskClick(e, task)}
                    onToggleComplete={() => onToggleComplete(task)}
                    onChecklistToggle={onChecklistToggle}
                    onToggleExpand={onToggleExpand}
                    onConvertType={onConvertType}
                    subtasks={getSubtasks(task.id)}
                    onSubtaskToggle={(subtask) => toggleTaskStatus(subtask.id, subtask.status)}
                  />
                </div>
              ))}
            </div>
          </SortableContext>
        </DroppableContainer>
      </div>

      {/* Today's Focus */}
      <div className="border-b border-gray-200">
        <DroppableContainer id="focus-container" title="Today's Focus">
          <SortableContext items={sortedFocusTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-0.5">
              {sortedFocusTasks.length === 0 && (
                <div className="text-xs text-gray-400 text-center py-2">
                  별표(★)를 눌러 중요한 태스크를 추가하세요
                </div>
              )}
              {sortedFocusTasks.map((task) => (
                <SortableTaskItem
                  key={task.id}
                  task={task}
                  onClick={(e) => onTaskClick(e, task)}
                  onToggleComplete={() => onToggleComplete(task)}
                  isCompleting={completingIds.has(task.id)}
                  subtasks={getSubtasks(task.id)}
                  onSubtaskToggle={(subtask) => toggleTaskStatus(subtask.id, subtask.status)}
                  onChecklistToggle={onChecklistToggle}
                  isExpanded={expandedTaskIds.has(task.id)}
                  onToggleExpand={onToggleExpand}
                  onConvertType={onConvertType}
                />
              ))}
            </div>
          </SortableContext>
        </DroppableContainer>
      </div>

      {/* Today's Task */}
      <div className="border-b border-gray-200 flex-shrink-0 max-h-[30%] flex flex-col">
        <DroppableContainer id="today-container" title="Today's Task">
          <SortableContext items={sortedTodayTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-0.5">
              {sortedTodayTasks.length === 0 && (
                <div className="text-xs text-gray-400 text-center py-2">
                  오늘 할 일을 이곳으로 드래그하세요
                </div>
              )}
              {sortedTodayTasks.map((task) => (
                <SortableTaskItem
                  key={task.id}
                  task={task}
                  onClick={(e) => onTaskClick(e, task)}
                  onToggleComplete={() => onToggleComplete(task)}
                  isCompleting={completingIds.has(task.id)}
                  subtasks={getSubtasks(task.id)}
                  onSubtaskToggle={(subtask) => toggleTaskStatus(subtask.id, subtask.status)}
                  onChecklistToggle={onChecklistToggle}
                  isExpanded={expandedTaskIds.has(task.id)}
                  onToggleExpand={onToggleExpand}
                  onConvertType={onConvertType}
                />
              ))}
            </div>
          </SortableContext>
        </DroppableContainer>
      </div>

      {/* 최근 항목 - 제일 아래 */}
      {recentTasks.length > 0 && (
        <div className="border-t border-gray-200 flex-shrink-0 px-2 py-1">
          <div className="space-y-0">
            {recentTasks.map((task) => (
              <SortableTaskItem
                key={task.id}
                task={task}
                onClick={(e) => onTaskClick(e, task)}
                onToggleComplete={() => onToggleComplete(task)}
                isCompleting={completingIds.has(task.id)}
                subtasks={getSubtasks(task.id)}
                onSubtaskToggle={(subtask) => toggleTaskStatus(subtask.id, subtask.status)}
                onChecklistToggle={onChecklistToggle}
                isExpanded={expandedTaskIds.has(task.id)}
                onToggleExpand={onToggleExpand}
                onConvertType={onConvertType}
                compact={true}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

