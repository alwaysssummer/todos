'use client'

import { useMemo, useState } from 'react'
import { Check, FileText, Archive, ChevronDown, ChevronRight, X, Trash2 } from 'lucide-react'
import type { Task } from '@/types/database'
import SortableTaskItem from './SortableTaskItem'

interface NotesTabProps {
  noteTasks: Task[]
  activeNotes: Task[]
  completedNotes: Task[]
  archivedNotes: Task[]
  completingIds: Set<string>
  expandedTaskIds: Set<string>
  onTaskClick: (e: React.MouseEvent, task: Task) => void
  onToggleComplete: (task: Task) => void
  onChecklistToggle: (task: Task, lineIndex: number, newCompleted: boolean) => void
  onToggleExpand: (taskId: string) => void
  onConvertType: (task: Task, newType: 'task' | 'note') => void
  getSubtasks: (parentId: string) => Task[]
  toggleTaskStatus: (id: string, status: string) => void
  onUnarchive?: (task: Task) => void
  onDelete?: (task: Task) => void
  onClearCompleted?: () => void
}

export default function NotesTab({
  noteTasks,
  activeNotes,
  completedNotes,
  archivedNotes,
  completingIds,
  expandedTaskIds,
  onTaskClick,
  onToggleComplete,
  onChecklistToggle,
  onToggleExpand,
  onConvertType,
  getSubtasks,
  toggleTaskStatus,
  onUnarchive,
  onDelete,
  onClearCompleted
}: NotesTabProps) {
  const todayStr = new Date().toISOString().split('T')[0]
  const [showCompleted, setShowCompleted] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

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
          
          {/* Archived Notes - 진행 중 바로 아래 */}
          {archivedNotes.length > 0 && (
            <div className="border-t border-purple-100 pt-4">
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="w-full text-xs font-semibold text-purple-500 mb-2 flex items-center gap-1 hover:text-purple-600"
              >
                {showArchived ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <Archive size={12} />
                보관된 노트 ({archivedNotes.length})
              </button>
              {showArchived && (
                <div className="space-y-0 opacity-75">
                  {archivedNotes.map((task) => (
                    <div
                      key={task.id}
                      onClick={(e) => onTaskClick(e, task)}
                      className="flex items-center gap-2 p-1.5 text-xs text-purple-400 bg-purple-50/30 border-b border-purple-100 cursor-pointer hover:bg-purple-50 rounded"
                    >
                      <div className="flex-shrink-0 w-3 h-3 flex items-center justify-center">
                        <Archive size={10} className="text-purple-400" />
                      </div>
                      <span className="flex-1 truncate">{task.title}</span>
                      {onUnarchive && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onUnarchive(task) }}
                          className="text-[10px] text-purple-500 hover:underline px-1"
                        >
                          복원
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Completed Notes - 맨 아래 */}
          {completedNotes.length > 0 && (
            <div className="border-t border-amber-100 pt-4 mt-4">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="text-xs font-semibold text-gray-400 flex items-center gap-1 hover:text-gray-500"
                >
                  {showCompleted ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <Check size={12} />
                  완료된 노트 ({completedNotes.length})
                </button>
                {showCompleted && onClearCompleted && (
                  <button
                    onClick={() => {
                      if (confirm(`완료된 노트 ${completedNotes.length}개를 모두 삭제하시겠습니까?`)) {
                        onClearCompleted()
                      }
                    }}
                    className="text-[10px] text-red-400 hover:text-red-500 flex items-center gap-0.5 px-1.5 py-0.5 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={10} />
                    비우기
                  </button>
                )}
              </div>
              {showCompleted && (
                <div className="space-y-0 opacity-75">
                  {completedNotes.map((task) => (
                    <div
                      key={task.id}
                      onClick={(e) => onTaskClick(e, task)}
                      className="group flex items-center gap-2 p-1.5 text-xs text-gray-400 bg-amber-50/30 border-b border-amber-100 cursor-pointer hover:bg-amber-50 rounded"
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
                      {onDelete && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(task) }}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-0.5 transition-opacity"
                          title="삭제"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

