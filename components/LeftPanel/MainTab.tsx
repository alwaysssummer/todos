'use client'

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import type { Task, NotionLink } from '@/types/database'
import RoutineSection from '../RoutineSection'
import SortableTaskItem from './SortableTaskItem'
import SortableNotionLink from './SortableNotionLink'
import DroppableContainer from './DroppableContainer'

interface MainTabProps {
  focusTasks: Task[]
  todayTasks: Task[]
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
  return (
    <>
      <RoutineSection />
      
      {/* Today's Focus */}
      <div className="border-b border-gray-200">
        <DroppableContainer id="focus-container" title="Today's Focus">
          <SortableContext items={focusTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-0.5">
              {focusTasks.length === 0 && (
                <div className="text-xs text-gray-400 text-center py-2">
                  별표(★)를 눌러 중요한 태스크를 추가하세요
                </div>
              )}
              {focusTasks.map((task) => (
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
          <SortableContext items={todayTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-0.5">
              {todayTasks.length === 0 && (
                <div className="text-xs text-gray-400 text-center py-2">
                  오늘 할 일을 이곳으로 드래그하세요
                </div>
              )}
              {todayTasks.map((task) => (
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

      {/* PROJECT */}
      <div className="border-b border-gray-200 flex-shrink-0">
        <h2 className="text-sm mb-2 px-4 pt-4 font-semibold text-gray-900 flex items-center justify-between">
          PROJECT
          <button
            onClick={onShowNotionLinkModal}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="프로젝트 링크 추가"
          >
            <Plus size={16} />
          </button>
        </h2>
        
        <div className="px-4 pb-3">
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
    </>
  )
}

