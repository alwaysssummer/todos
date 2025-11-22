'use client'

import { useState } from 'react'
import type { Task, Project } from '@/types/database'
import { extractTags } from '@/utils/textParser'

interface MobileTodayViewProps {
  tasks: Task[]
  createTask: (task: Partial<Task>) => Promise<any>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  toggleTaskStatus: (id: string, currentStatus: string) => void
  projects: Project[]
}

export default function MobileTodayView({
  tasks,
  createTask,
  updateTask,
  toggleTaskStatus,
  projects
}: MobileTodayViewProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const todayStr = new Date().toISOString().split('T')[0]

  // Focus Tasks (빨간색)
  const focusTasks = tasks.filter(t => 
    t.is_top5 && 
    t.status !== 'completed' && 
    t.status !== 'waiting' && 
    !t.is_auto_generated && 
    !t.is_makeup
  )

  // Today's Tasks (초록색)
  const todayTasks = tasks.filter(t => 
    !t.is_top5 && 
    t.due_date?.split('T')[0] === todayStr && 
    t.status !== 'completed' && 
    t.status !== 'waiting' && 
    !t.is_auto_generated && 
    !t.is_makeup
  )

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!newTaskTitle.trim()) return

      let title = newTaskTitle.trim()
      let isTop5 = false
      let dueDate: string | undefined = undefined

      if (title.startsWith('*')) {
        isTop5 = true
        title = title.substring(1).trim()
      } else if (title.startsWith('/')) {
        dueDate = new Date().toISOString()
        title = title.substring(1).trim()
      }

      const { cleanTitle, tags } = extractTags(title)

      await createTask({
        title: cleanTitle,
        status: 'inbox',
        is_top5: isTop5,
        due_date: dueDate,
        tags: tags.length > 0 ? tags : undefined
      })
      setNewTaskTitle('')
    }
  }

  const handleToggleComplete = (task: Task) => {
    toggleTaskStatus(task.id, task.status)
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto pb-32">
        {/* Today's Focus */}
        {focusTasks.length > 0 && (
          <div className="bg-red-50/30 mb-2">
            <div className="px-3 py-2 border-b border-red-200 bg-red-100/50">
              <h2 className="text-sm font-bold text-red-700">Today's Focus</h2>
            </div>
            <div className="divide-y divide-red-100/40">
              {focusTasks.map(task => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 px-3 py-2 active:bg-red-100/50"
                >
                  <input
                    type="checkbox"
                    checked={task.status === 'completed'}
                    onChange={() => handleToggleComplete(task)}
                    className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <div className={`text-sm font-semibold truncate ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {task.title}
                    </div>
                    {task.tags && task.tags.length > 0 && (
                      <div className="flex gap-1 flex-shrink-0">
                        {task.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-[11px] text-blue-600 bg-blue-50 px-1 py-0.5 rounded">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {task.status === 'scheduled' && (
                    <div className="w-2 h-2 bg-yellow-400 rounded-full flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's Task */}
        {todayTasks.length > 0 && (
          <div className="bg-green-50/30 mb-2">
            <div className="px-3 py-2 border-b border-green-200 bg-green-100/50">
              <h2 className="text-sm font-bold text-green-700">Today's Task</h2>
            </div>
            <div className="divide-y divide-green-100/40">
              {todayTasks.map(task => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 px-3 py-2 active:bg-green-100/50"
                >
                  <input
                    type="checkbox"
                    checked={task.status === 'completed'}
                    onChange={() => handleToggleComplete(task)}
                    className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <div className={`text-sm truncate ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {task.title}
                    </div>
                    {task.tags && task.tags.length > 0 && (
                      <div className="flex gap-1 flex-shrink-0">
                        {task.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-[11px] text-blue-600 bg-blue-50 px-1 py-0.5 rounded">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {task.status === 'scheduled' && (
                    <div className="w-2 h-2 bg-yellow-400 rounded-full flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 빈 상태 */}
        {focusTasks.length === 0 && todayTasks.length === 0 && (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            오늘 할 일이 없습니다 ✨
          </div>
        )}
      </div>

      {/* 빠른 입력창 - 하단 고정 */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 p-3 z-40">
        <textarea
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="* Focus, / 오늘, [[태그]]"
          className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={2}
        />
      </div>
    </div>
  )
}

