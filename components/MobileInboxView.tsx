'use client'

import { useState, useRef, useEffect } from 'react'
import type { Task, Project } from '@/types/database'

interface MobileInboxViewProps {
  tasks: Task[]
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  toggleTaskStatus: (id: string, currentStatus: string) => void
  projects: Project[]
}

export default function MobileInboxView({
  tasks,
  updateTask,
  toggleTaskStatus,
}: MobileInboxViewProps) {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const todayStr = new Date().toISOString().split('T')[0]

  // INBOX 필터링 (LeftPanel과 동일)
  let inboxTasks = tasks.filter(t => 
    t.status !== 'completed' && 
    t.status !== 'waiting' && 
    !t.is_auto_generated && 
    !t.is_makeup
  )

  // INBOX 정렬 (LeftPanel과 동일)
  inboxTasks = inboxTasks.sort((a, b) => {
    const getScore = (task: Task) => {
      const isRed = task.is_top5
      const isGreen = task.due_date?.split('T')[0] === todayStr
      const isYellow = task.status === 'scheduled'

      if (isRed && isYellow) return 5
      if (isRed) return 4
      if (isGreen && isYellow) return 3
      if (isGreen) return 2
      if (isYellow) return 1
      return 0
    }

    const scoreA = getScore(a)
    const scoreB = getScore(b)

    if (scoreA !== scoreB) {
      return scoreB - scoreA
    }

    return (a.order_index || 0) - (b.order_index || 0)
  })

  const handleToggleComplete = (task: Task) => {
    toggleTaskStatus(task.id, task.status)
  }

  const handleTaskClick = (task: Task) => {
    setEditingTaskId(task.id)
    setEditValue(task.title)
  }

  useEffect(() => {
    if (editingTaskId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.setSelectionRange(0, 0) // 커서 맨 앞
    }
  }, [editingTaskId])

  const handleEdit = async (task: Task, newTitle: string) => {
    let title = newTitle.trim()
    if (!title) {
      setEditingTaskId(null)
      return
    }

    const updates: Partial<Task> = {}
    
    // * 로 시작하면 Focus
    if (title.startsWith('*')) {
      updates.is_top5 = true
      title = title.substring(1).trim()
    } else if (task.is_top5) {
      // * 제거하면 Focus 해제
      updates.is_top5 = false
    }
    
    // / 로 시작하면 Today
    if (title.startsWith('/')) {
      updates.due_date = new Date().toISOString()
      title = title.substring(1).trim()
    }
    
    updates.title = title
    await updateTask(task.id, updates)
    setEditingTaskId(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, task: Task) => {
    if (e.key === 'Enter') {
      handleEdit(task, editValue)
    } else if (e.key === 'Escape') {
      setEditingTaskId(null)
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* INBOX 헤더 */}
      <div className="bg-white border-b border-gray-200 px-3 py-2">
        <div className="flex items-baseline gap-2">
          <h1 className="text-base font-bold text-gray-900">INBOX</h1>
          <span className="text-xs text-gray-500">{inboxTasks.length}개</span>
        </div>
      </div>

      {/* INBOX 목록 */}
      <div className="flex-1 overflow-y-auto pb-20">
        {inboxTasks.length > 0 ? (
          <div className="bg-white divide-y divide-gray-100">
            {inboxTasks.map(task => {
              const isRed = task.is_top5
              const isGreen = task.due_date?.split('T')[0] === todayStr
              const isYellow = task.status === 'scheduled'

              return (
                <div
                  key={task.id}
                  className="flex items-center gap-2 px-3 py-1.5 active:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={task.status === 'completed'}
                    onChange={(e) => {
                      e.stopPropagation()
                      handleToggleComplete(task)
                    }}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    {editingTaskId === task.id ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleEdit(task, editValue)}
                        onKeyDown={(e) => handleKeyDown(e, task)}
                        className="flex-1 text-xs border-b-2 border-blue-500 bg-blue-50 px-1 py-0.5 focus:outline-none"
                        placeholder="* Focus | / 오늘"
                      />
                    ) : (
                      <div 
                        onClick={() => handleTaskClick(task)}
                        className={`text-xs truncate ${
                          task.status === 'completed' 
                            ? 'line-through text-gray-400' 
                            : isRed 
                              ? 'text-gray-900 font-semibold' 
                              : 'text-gray-900'
                        }`}
                      >
                        {task.title}
                      </div>
                    )}
                    {task.tags && task.tags.length > 0 && (
                      <div className="flex gap-0.5 flex-shrink-0">
                        {task.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-[9px] text-blue-600 bg-blue-50 px-1 py-0.5 rounded">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {isRed && (
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full" title="Focus" />
                    )}
                    {isGreen && (
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full" title="Today" />
                    )}
                    {isYellow && (
                      <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full" title="Scheduled" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <div className="text-sm">INBOX가 비어있습니다</div>
          </div>
        )}
      </div>
    </div>
  )
}

