'use client'

import { useMemo } from 'react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import type { Task, NotionLink } from '@/types/database'
import RoutineSection from '../RoutineSection'
import SortableTaskItem from './SortableTaskItem'
import SortableNotionLink from './SortableNotionLink'
import DroppableContainer from './DroppableContainer'
import { parseChecklistFromMemo } from '@/utils/checklistParser'

interface MainTabProps {
  focusTasks: Task[]
  todayTasks: Task[]
  recentTasks: Task[]
  notionLinks: NotionLink[]
  completingIds: Set<string>
  expandedTaskIds: Set<string>
  onTaskClick: (e: React.MouseEvent, task: Task) => void
  onToggleComplete: (task: Task) => void
  onChecklistToggle: (task: Task, lineIndex: number, newCompleted: boolean) => void
  onToggleExpand: (taskId: string) => void
  onConvertType: (task: Task, newType: 'task' | 'note') => void
  getSubtasks: (parentId: string) => Task[]
  toggleTaskStatus: (id: string, status: string) => void
  updateLink: (id: string, updates: Partial<NotionLink>) => void
  onDeleteNotionLink: (id: string) => void
  onShowNotionLinkModal: () => void
}

export default function MainTab({
  focusTasks,
  todayTasks,
  recentTasks,
  notionLinks,
  completingIds,
  expandedTaskIds,
  onTaskClick,
  onToggleComplete,
  onChecklistToggle,
  onToggleExpand,
  onConvertType,
  getSubtasks,
  toggleTaskStatus,
  updateLink,
  onDeleteNotionLink,
  onShowNotionLinkModal
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

  return (
    <>
      {/* PROJECT - 제일 위 */}
      <div className="border-b border-gray-200 flex-shrink-0">
        <h2 className="text-xs mb-1 px-4 pt-3 font-semibold text-gray-900 flex items-center justify-between">
          PROJECT
          <button
            onClick={onShowNotionLinkModal}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="프로젝트 링크 추가"
          >
            <Plus size={14} />
          </button>
        </h2>
        
        <div className="px-4 pb-2">
          <SortableContext items={notionLinks.map(l => `notion-link-${l.id}`)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {notionLinks.length === 0 && (
                <div className="text-xs text-gray-400 text-center py-2">
                  + 버튼을 눌러 프로젝트를 추가하세요
                </div>
              )}
              {notionLinks.map((link) => (
                <SortableNotionLink
                  key={link.id}
                  link={link}
                  onUpdate={updateLink}
                  onDelete={onDeleteNotionLink}
                />
              ))}
            </div>
          </SortableContext>
        </div>
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

      {/* ROUTINES */}
      <RoutineSection />

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
    </>
  )
}

