'use client'

import { useMemo } from 'react'
import { Check, FileText } from 'lucide-react'
import type { Task } from '@/types/database'
import SortableTaskItem from './SortableTaskItem'

interface NotesTabProps {
  noteTasks: Task[]
  activeNotes: Task[]
  completedNotes: Task[]
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

export default function NotesTab({
  noteTasks,
  activeNotes,
  completedNotes,
  completingIds,
  expandedTaskIds,
  onTaskClick,
  onToggleComplete,
  onChecklistToggle,
  onToggleExpand,
  onConvertType,
  getSubtasks,
  toggleTaskStatus
}: NotesTabProps) {
  const todayStr = new Date().toISOString().split('T')[0]

  // 정렬: Focus(★) → Today's Task → 일반 노트
  const sortedActiveNotes = useMemo(() => {
    return [...activeNotes].sort((a, b) => {
      // 1. Focus(★) 우선
      if (a.is_top5 && !b.is_top5) return -1
      if (!a.is_top5 && b.is_top5) return 1
      
      // 2. Today's Task 우선
      const aIsToday = a.due_date?.split('T')[0] === todayStr
      const bIsToday = b.due_date?.split('T')[0] === todayStr
      if (aIsToday && !bIsToday) return -1
      if (!aIsToday && bIsToday) return 1
      
      // 3. 나머지는 생성일 기준 (최신순)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [activeNotes, todayStr])

  return (
    <div className="p-4">
      {noteTasks.length === 0 ? (
        <div className="text-center py-8">
          <FileText size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">노트가 없습니다</p>
          <p className="text-xs text-gray-300 mt-1">Shift+Enter로 노트를 생성하세요</p>
        </div>
      ) : (
        <>
          {/* Active Notes */}
          {activeNotes.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-amber-600 mb-2 flex items-center gap-1">
                <FileText size={12} />
                진행 중 ({activeNotes.length})
              </h3>
              <div className="space-y-0">
                {sortedActiveNotes.map((task) => (
                  <SortableTaskItem
                    key={`${task.id}-note`}
                    id={`${task.id}-note`}
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
            </div>
          )}
          
          {/* Completed Notes */}
          {completedNotes.length > 0 && (
            <div className="border-t border-amber-100 pt-4">
              <h3 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1">
                <Check size={12} />
                완료된 노트 ({completedNotes.length})
              </h3>
              <div className="space-y-0 opacity-75">
                {completedNotes.map((task) => (
                  <div
                    key={task.id}
                    onClick={(e) => onTaskClick(e, task)}
                    className="flex items-center gap-2 p-1.5 text-xs text-gray-400 bg-amber-50/30 border-b border-amber-100 cursor-pointer hover:bg-amber-50 rounded"
                  >
                    <div className="flex-shrink-0 w-3 h-3 flex items-center justify-center">
                      <FileText size={10} className="text-amber-400" />
                    </div>
                    <span className="flex-1 truncate line-through">{task.title}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleComplete(task) }}
                      className="text-[10px] text-amber-500 hover:underline px-1"
                    >
                      복구
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

