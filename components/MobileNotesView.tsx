'use client'

import { useState, useMemo } from 'react'
import { FileText, Check, Archive, ChevronDown, ChevronRight } from 'lucide-react'
import type { Task, Project } from '@/types/database'
import { parseChecklistFromMemo } from '@/utils/checklistParser'

interface MobileNotesViewProps {
  tasks: Task[]
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  toggleTaskStatus: (id: string, currentStatus: string) => void
  projects: Project[]
  onSelectTask?: (task: Task) => void
}

export default function MobileNotesView({
  tasks,
  updateTask,
  deleteTask,
  toggleTaskStatus,
  projects,
  onSelectTask
}: MobileNotesViewProps) {
  const [showCompleted, setShowCompleted] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set())
  const todayStr = new Date().toISOString().split('T')[0]

  // 노트 타입 필터링
  const noteTasks = tasks.filter(t => t.type === 'note')
  
  const activeNotes = useMemo(() => 
    noteTasks.filter(t => t.status !== 'completed' && !t.is_archived),
    [noteTasks]
  )
  
  const completedNotes = useMemo(() => 
    noteTasks.filter(t => t.status === 'completed' && !t.is_archived),
    [noteTasks]
  )
  
  const archivedNotes = useMemo(() => 
    noteTasks.filter(t => t.is_archived),
    [noteTasks]
  )

  // 정렬: Focus(★) → Today's Task → 일반 노트
  const sortedActiveNotes = useMemo(() => {
    return [...activeNotes].sort((a, b) => {
      if (a.is_top5 && !b.is_top5) return -1
      if (!a.is_top5 && b.is_top5) return 1
      
      const aIsToday = a.due_date?.split('T')[0] === todayStr
      const bIsToday = b.due_date?.split('T')[0] === todayStr
      if (aIsToday && !bIsToday) return -1
      if (!aIsToday && bIsToday) return 1
      
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [activeNotes, todayStr])

  const handleToggleComplete = (task: Task) => {
    toggleTaskStatus(task.id, task.status)
  }

  const handleUnarchive = async (task: Task) => {
    await updateTask(task.id, { is_archived: false })
  }

  const toggleExpand = (taskId: string) => {
    setExpandedTaskIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }

  // 체크리스트 토글
  const handleChecklistToggle = async (task: Task, lineIndex: number, newCompleted: boolean) => {
    if (!task.description) return
    
    const lines = task.description.split('\n')
    const line = lines[lineIndex]
    
    if (newCompleted) {
      lines[lineIndex] = line.replace(/^\[\]\s/, '[x] ')
    } else {
      lines[lineIndex] = line.replace(/^\[x\]\s/i, '[] ')
    }
    
    await updateTask(task.id, { description: lines.join('\n') })
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <FileText className="w-5 h-5" />
          노트
        </h1>
        <p className="text-xs text-amber-100 mt-0.5">
          {activeNotes.length}개 진행 중 · {completedNotes.length}개 완료
        </p>
      </div>

      {/* 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto pb-20">
        {noteTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <FileText className="w-12 h-12 mb-3 text-gray-300" />
            <p className="text-sm">노트가 없습니다</p>
            <p className="text-xs mt-1">Shift+Enter로 노트를 생성하세요</p>
          </div>
        ) : (
          <>
            {/* 진행 중 노트 */}
            {activeNotes.length > 0 && (
              <div className="bg-white mb-2">
                <div className="px-4 py-2 border-b border-amber-100">
                  <h2 className="text-sm font-bold text-amber-600 flex items-center gap-1">
                    <FileText size={14} />
                    진행 중 ({activeNotes.length})
                  </h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {sortedActiveNotes.map(task => {
                    const checklistItems = parseChecklistFromMemo(task.description)
                    const hasChecklist = checklistItems.length > 0
                    const isExpanded = expandedTaskIds.has(task.id)
                    const completedCount = checklistItems.filter(item => item.isCompleted).length

                    return (
                      <div key={task.id}>
                        <div
                          onClick={() => onSelectTask?.(task)}
                          className="flex items-center gap-3 px-4 py-3 active:bg-gray-50"
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleToggleComplete(task)
                            }}
                            className="w-5 h-5 rounded-md border-2 border-amber-400 flex items-center justify-center flex-shrink-0"
                          >
                            {task.status === 'completed' && (
                              <Check size={14} className="text-amber-500" />
                            )}
                          </button>

                          {/* 체크리스트 토글 버튼 */}
                          {hasChecklist && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpand(task.id)
                              }}
                              className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-400"
                            >
                              <ChevronRight 
                                size={16} 
                                className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                              />
                            </button>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-900 truncate flex items-center gap-2">
                              {task.is_top5 && (
                                <span className="text-red-500">★</span>
                              )}
                              {task.title}
                              {hasChecklist && (
                                <span className="text-[10px] text-gray-400">
                                  {completedCount}/{checklistItems.length}
                                </span>
                              )}
                            </div>
                            {task.description && !hasChecklist && (
                              <p className="text-xs text-gray-400 truncate mt-0.5">
                                {task.description.substring(0, 50)}...
                              </p>
                            )}
                            {task.tags && task.tags.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {task.tags.slice(0, 2).map(tag => (
                                  <span key={tag} className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 체크리스트 항목 (펼쳐졌을 때) */}
                        {hasChecklist && isExpanded && (
                          <div className="ml-12 mr-4 mb-2 py-1 space-y-0.5 bg-gray-50 rounded-lg">
                            {checklistItems.map((item, idx) => (
                              <div 
                                key={idx}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm"
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleChecklistToggle(task, item.lineIndex, !item.isCompleted)
                                  }}
                                  className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all
                                    ${item.isCompleted
                                      ? 'bg-blue-500 border-blue-500 text-white'
                                      : 'border-gray-300 bg-white'
                                    }`}
                                >
                                  {item.isCompleted && <Check size={10} strokeWidth={3} />}
                                </button>
                                <span className={item.isCompleted ? 'line-through text-gray-400' : 'text-gray-700'}>
                                  {item.text}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 보관된 노트 */}
            {archivedNotes.length > 0 && (
              <div className="bg-white mb-2">
                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className="w-full px-4 py-2 border-b border-purple-100 flex items-center justify-between"
                >
                  <span className="text-sm font-semibold text-purple-500 flex items-center gap-1">
                    {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <Archive size={14} />
                    보관된 노트 ({archivedNotes.length})
                  </span>
                </button>
                {showArchived && (
                  <div className="divide-y divide-purple-100">
                    {archivedNotes.map(task => (
                      <div
                        key={task.id}
                        onClick={() => onSelectTask?.(task)}
                        className="flex items-center gap-3 px-4 py-3 bg-purple-50/50 active:bg-purple-100"
                      >
                        <Archive size={16} className="text-purple-400 flex-shrink-0" />
                        <span className="flex-1 text-sm text-purple-600 truncate">
                          {task.title}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleUnarchive(task)
                          }}
                          className="text-xs text-purple-500 px-2 py-1"
                        >
                          복원
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 완료된 노트 */}
            {completedNotes.length > 0 && (
              <div className="bg-white">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="w-full px-4 py-2 border-b border-gray-100 flex items-center justify-between"
                >
                  <span className="text-sm font-semibold text-gray-400 flex items-center gap-1">
                    {showCompleted ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <Check size={14} />
                    완료된 노트 ({completedNotes.length})
                  </span>
                </button>
                {showCompleted && (
                  <div className="divide-y divide-gray-100">
                    {completedNotes.map(task => (
                      <div
                        key={task.id}
                        onClick={() => onSelectTask?.(task)}
                        className="flex items-center gap-3 px-4 py-3 bg-gray-50/50 active:bg-gray-100"
                      >
                        <div className="w-5 h-5 rounded-md bg-gray-300 flex items-center justify-center flex-shrink-0">
                          <Check size={14} className="text-white" />
                        </div>
                        <span className="flex-1 text-sm text-gray-400 line-through truncate">
                          {task.title}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleComplete(task)
                          }}
                          className="text-xs text-gray-500 px-2 py-1"
                        >
                          복구
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

