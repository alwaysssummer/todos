'use client'

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Check, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import type { Task, Project } from '@/types/database'
import SortableTaskItem from './SortableTaskItem'
import DroppableContainer from './DroppableContainer'

interface TasksTabProps {
  inboxTasks: Task[]
  waitingTasks: Task[]
  completedTasks: Task[]
  projects: Project[]
  selectedProjectId: string | null
  completingIds: Set<string>
  expandedTaskIds: Set<string>
  isCompletedExpanded: boolean
  inboxScrollRef: React.RefObject<HTMLDivElement | null>
  onTaskClick: (e: React.MouseEvent, task: Task) => void
  onToggleComplete: (task: Task) => void
  onChecklistToggle: (task: Task, lineIndex: number, newCompleted: boolean) => void
  onToggleExpand: (taskId: string) => void
  onConvertType: (task: Task, newType: 'task' | 'note') => void
  getSubtasks: (parentId: string) => Task[]
  toggleTaskStatus: (id: string, status: string) => void
  setIsCompletedExpanded: (expanded: boolean) => void
  setShowAllCompletedModal: (show: boolean) => void
  deleteTask: (id: string) => Promise<void>
}

export default function TasksTab({
  inboxTasks,
  waitingTasks,
  completedTasks,
  projects,
  selectedProjectId,
  completingIds,
  expandedTaskIds,
  isCompletedExpanded,
  inboxScrollRef,
  onTaskClick,
  onToggleComplete,
  onChecklistToggle,
  onToggleExpand,
  onConvertType,
  getSubtasks,
  toggleTaskStatus,
  setIsCompletedExpanded,
  setShowAllCompletedModal,
  deleteTask
}: TasksTabProps) {
  return (
    <div className="p-4" ref={inboxScrollRef}>
      {/* INBOX */}
      <DroppableContainer
        id="inbox-container"
        title={selectedProjectId ? projects.find(p => p.id === selectedProjectId)?.name || 'INBOX' : 'INBOX'}
        className=""
      >
        <SortableContext items={inboxTasks.map(t => `${t.id}-inbox`)} strategy={verticalListSortingStrategy}>
          <div className="space-y-0">
            {inboxTasks.length === 0 && (
              <div className="text-xs text-gray-400 text-center py-4">할 일이 없습니다</div>
            )}
            {inboxTasks.map((task) => (
              <SortableTaskItem
                key={`${task.id}-inbox`}
                id={`${task.id}-inbox`}
                task={task}
                onClick={(e) => onTaskClick(e, task)}
                onToggleComplete={() => onToggleComplete(task)}
                isInbox={true}
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

      {/* Waiting */}
      <div className="mt-6 border-t border-gray-100 pt-4">
        <DroppableContainer id="waiting-container" title="Waiting" count={waitingTasks.length} className="min-h-[60px]">
          <SortableContext items={waitingTasks.map(t => `${t.id}-waiting`)} strategy={verticalListSortingStrategy}>
            <div className="space-y-0">
              {waitingTasks.length === 0 && (
                <div className="text-xs text-gray-400 text-center py-2">나중에 할 일을 이곳으로 보관하세요</div>
              )}
              {waitingTasks.map((task) => (
                <SortableTaskItem
                  key={`${task.id}-waiting`}
                  id={`${task.id}-waiting`}
                  task={task}
                  onClick={(e) => onTaskClick(e, task)}
                  onToggleComplete={() => onToggleComplete(task)}
                  isInbox={true}
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

      {/* Done */}
      {completedTasks.length > 0 && (
        <div className="mt-6 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors"
            >
              {isCompletedExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span>Done ({completedTasks.length})</span>
            </button>
            <button
              onClick={async () => {
                if (confirm(`완료된 할일 ${completedTasks.length}개를 모두 삭제하시겠습니까?`)) {
                  for (const task of completedTasks) {
                    await deleteTask(task.id)
                  }
                }
              }}
              className="text-gray-400 hover:text-red-500 transition-colors p-1"
              title="완료된 할일 비우기"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {isCompletedExpanded && (
            <>
              <div className="space-y-0 opacity-75">
                {completedTasks.slice(0, 10).map((task) => (
                  <div key={task.id} className="flex items-center gap-2 p-1 text-xs text-gray-400 bg-white border-b border-gray-100 line-through">
                    <div className="flex-shrink-0 w-3 h-3 flex items-center justify-center">
                      <Check size={10} className="text-blue-400" />
                    </div>
                    <span className="flex-1 truncate">{task.title}</span>
                    <button onClick={() => onToggleComplete(task)} className="text-xs text-blue-400 hover:underline px-1">복구</button>
                  </div>
                ))}
              </div>
              {completedTasks.length > 10 && (
                <button
                  onClick={() => setShowAllCompletedModal(true)}
                  className="mt-2 w-full text-center text-xs text-gray-500 hover:text-blue-500 py-2 hover:bg-blue-50 rounded transition-colors"
                >
                  More ({completedTasks.length - 10} more)
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

