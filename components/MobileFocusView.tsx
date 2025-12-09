'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import type { Task, Project } from '@/types/database'
import { extractTags, splitTitleAndDescription } from '@/utils/textParser'
import { parseChecklistFromMemo } from '@/utils/checklistParser'
import MobileTaskDetailView from './MobileTaskDetailView'

// 애니메이션 체크박스 컴포넌트
interface AnimatedCheckboxProps {
  checked: boolean
  onChange: () => void
}

function AnimatedCheckbox({ checked, onChange }: AnimatedCheckboxProps) {
  const [isAnimating, setIsAnimating] = useState(false)
  const [visualChecked, setVisualChecked] = useState(checked)
  
  useEffect(() => {
    setVisualChecked(checked)
  }, [checked])
  
  const handleClick = () => {
    if (isAnimating) return
    
    setIsAnimating(true)
    setVisualChecked(true)
    
    setTimeout(() => {
      onChange()
      setIsAnimating(false)
    }, 300)
  }
  
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isAnimating}
      className={`
        relative w-5 h-5 rounded-md border-2 flex-shrink-0
        transition-all duration-200 ease-out
        ${visualChecked ? 'bg-blue-600 border-transparent' : 'bg-white border-blue-400'}
        ${isAnimating ? 'scale-110 ring-blue-200 ring-4' : 'scale-100'}
        active:scale-95
      `}
    >
      <svg
        className={`
          absolute inset-0 w-full h-full p-0.5 text-white
          transition-all duration-200 ease-out
          ${visualChecked ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}
        `}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={3}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 13l4 4L19 7"
        />
      </svg>
      
      {isAnimating && (
        <span 
          className="absolute inset-0 rounded-md bg-blue-500 opacity-40 animate-ping"
        />
      )}
    </button>
  )
}

interface MobileFocusViewProps {
  tasks: Task[]
  createTask: (task: Partial<Task>) => Promise<any>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  toggleTaskStatus: (id: string, currentStatus: string) => void
  projects: Project[]
}

export default function MobileFocusView({
  tasks,
  createTask,
  updateTask,
  deleteTask,
  toggleTaskStatus,
  projects
}: MobileFocusViewProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set())
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  // 화면 진입 시 자동 포커스
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.innerWidth < 768) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 150)
    }
  }, [])

  // THE FOCUS 태스크 (is_the_focus = true)
  const focusTasks = tasks.filter(t => 
    t.is_the_focus && 
    t.status !== 'completed' && 
    !t.is_auto_generated && 
    !t.is_makeup
  )

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!newTaskTitle.trim()) return

      let title = newTaskTitle.trim()

      const { title: splitTitle, description } = splitTitleAndDescription(title)
      const { cleanTitle, tags } = extractTags(splitTitle)

      // THE FOCUS로 바로 추가
      await createTask({
        title: cleanTitle,
        description: description,
        status: 'inbox',
        is_the_focus: true,
        tags: tags.length > 0 ? tags : undefined
      })
      setNewTaskTitle('')
    }
  }

  const handleToggleComplete = (task: Task) => {
    toggleTaskStatus(task.id, task.status)
  }

  const handleRemoveFromFocus = async (task: Task) => {
    await updateTask(task.id, { is_the_focus: false })
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

  // 태스크 상세 화면
  if (selectedTask) {
    return (
      <MobileTaskDetailView
        task={selectedTask}
        onBack={() => setSelectedTask(null)}
        updateTask={updateTask}
        deleteTask={deleteTask}
        projects={projects}
      />
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto pb-32">
        {/* THE FOCUS 헤더 */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            THE FOCUS
          </h1>
          <p className="text-xs text-blue-100 mt-0.5">장기간 집중해서 처리할 태스크</p>
        </div>

        {/* Focus 태스크 목록 */}
        <div className="bg-white">
          {focusTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="text-sm">집중할 태스크가 없습니다</p>
              <p className="text-xs mt-1">아래에서 새 태스크를 추가하세요</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {focusTasks.map(task => {
                const checklistItems = parseChecklistFromMemo(task.description)
                const hasChecklist = checklistItems.length > 0
                const isExpanded = expandedTaskIds.has(task.id)
                const completedCount = checklistItems.filter(item => item.isCompleted).length

                return (
                  <div key={task.id}>
                    <div
                      className="flex items-center gap-3 px-4 py-3 active:bg-gray-50"
                      onClick={() => setSelectedTask(task)}
                    >
                      <AnimatedCheckbox
                        checked={task.status === 'completed'}
                        onChange={() => handleToggleComplete(task)}
                      />
                      
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
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900 truncate">
                            {task.title}
                          </span>
                          {hasChecklist && (
                            <span className="text-[10px] text-gray-400 flex-shrink-0">
                              {completedCount}/{checklistItems.length}
                            </span>
                          )}
                        </div>
                        {task.tags && task.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {task.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveFromFocus(task)
                        }}
                        className="text-xs text-gray-400 hover:text-red-500 px-2 py-1"
                      >
                        제외
                      </button>
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
          )}
        </div>
      </div>

      {/* 빠른 입력창 - 하단 고정 */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 p-3 z-40">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="THE FOCUS에 추가할 태스크 입력..."
            className="flex-1 px-3 py-2 text-base border border-blue-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={2}
          />
        </div>
        <p className="text-[10px] text-gray-400 mt-1 text-center">
          Enter를 눌러 THE FOCUS에 바로 추가
        </p>
      </div>
    </div>
  )
}
