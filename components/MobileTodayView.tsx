'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import type { Task, Project } from '@/types/database'
import { extractTags, splitTitleAndDescription } from '@/utils/textParser'
import { parseChecklistFromMemo } from '@/utils/checklistParser'
import { moveTaskUp, moveTaskDown } from '@/utils/taskHierarchy'
import MobileTaskDetailView from './MobileTaskDetailView'
import SwipeableTaskItem from './SwipeableTaskItem'

// 애니메이션 체크박스 컴포넌트
interface AnimatedCheckboxProps {
  checked: boolean
  onChange: () => void
  color: 'orange' | 'red' | 'green'
}

function AnimatedCheckbox({ checked, onChange, color }: AnimatedCheckboxProps) {
  const [isAnimating, setIsAnimating] = useState(false)
  const [visualChecked, setVisualChecked] = useState(checked)
  
  // 외부 checked 상태와 동기화
  useEffect(() => {
    setVisualChecked(checked)
  }, [checked])
  
  const colorClasses = {
    orange: {
      border: 'border-orange-400',
      bg: 'bg-orange-500',
      ring: 'ring-orange-200'
    },
    red: {
      border: 'border-red-400',
      bg: 'bg-red-500',
      ring: 'ring-red-200'
    },
    green: {
      border: 'border-green-400',
      bg: 'bg-green-500',
      ring: 'ring-green-200'
    }
  }
  
  const colors = colorClasses[color]
  
  const handleClick = () => {
    if (isAnimating) return // 중복 클릭 방지
    
    setIsAnimating(true)
    // 먼저 시각적으로 체크 표시
    setVisualChecked(true)
    
    // 애니메이션 후 실제 상태 변경
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
        ${visualChecked ? `${colors.bg} border-transparent` : `bg-white ${colors.border}`}
        ${isAnimating ? `scale-110 ${colors.ring} ring-4` : 'scale-100'}
        active:scale-95
      `}
    >
      {/* 체크 아이콘 */}
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
      
      {/* 체크 시 퍼지는 효과 */}
      {isAnimating && (
        <span 
          className={`
            absolute inset-0 rounded-md ${colors.bg} opacity-40
            animate-ping
          `}
        />
      )}
    </button>
  )
}

interface MobileTodayViewProps {
  tasks: Task[]
  createTask: (task: Partial<Task>) => Promise<any>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  toggleTaskStatus: (id: string, currentStatus: string) => void
  projects: Project[]
  onNavigateToTab?: (tab: 'focus' | 'today' | 'inbox') => void
}

export default function MobileTodayView({
  tasks,
  createTask,
  updateTask,
  deleteTask,
  toggleTaskStatus,
  projects,
  onNavigateToTab
}: MobileTodayViewProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set())
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [swipingTaskId, setSwipingTaskId] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const todayStr = new Date().toISOString().split('T')[0]

  // 모바일에서 오늘 화면 진입 시 자동으로 입력창 포커스
  useEffect(() => {
    if (typeof window === 'undefined') return
    // 모바일/태블릿 좁은 화면에서만 자동 포커스
    if (window.innerWidth < 768) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 150)
    }
  }, [])

  // Focus Tasks (빨간색)
  // 투데이즈 포커스 (is_top5) - 노트 제외
  const focusTasks = tasks.filter(t =>
    t.is_top5 &&
    t.status !== 'completed' &&
    t.status !== 'waiting' &&
    !t.is_auto_generated &&
    !t.is_makeup &&
    t.type !== 'note'
  )

  // 투데이즈 테스크 (due_date가 오늘 또는 과거) - 노트 제외
  const todayTasks = tasks.filter(t =>
    !t.is_top5 &&
    t.due_date &&
    t.due_date.split('T')[0] <= todayStr &&
    t.status !== 'completed' &&
    t.status !== 'waiting' &&
    !t.is_auto_generated &&
    !t.is_makeup &&
    t.type !== 'note'
  )

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Shift+Enter: 노트 모달 열기
    if (e.key === 'Enter' && e.shiftKey) {
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

      // 긴 입력 자동 분리 (제목/메모)
      const { title: splitTitle, description } = splitTitleAndDescription(title)
      const { cleanTitle, tags } = extractTags(splitTitle)

      // 노트 타입으로 생성하고 바로 모달 열기
      const newTask = await createTask({
        title: cleanTitle,
        description: description,
        status: 'inbox',
        is_top5: isTop5,
        due_date: dueDate,
        tags: tags.length > 0 ? tags : undefined,
        type: 'note'  // 노트 타입으로 생성
      })
      
      setNewTaskTitle('')
      
      // 생성된 노트의 상세 화면 열기
      if (newTask) {
        setSelectedTask(newTask)
      }
      return
    }

    // Enter: 일반 테스크 저장
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

      // 긴 입력 자동 분리 (제목/메모)
      const { title: splitTitle, description } = splitTitleAndDescription(title)
      const { cleanTitle, tags } = extractTags(splitTitle)

      await createTask({
        title: cleanTitle,
        description: description,
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

  // 태스크 아이템 렌더링 헬퍼
  const renderTaskItem = (task: Task, color: 'red' | 'green') => {
    const checklistItems = parseChecklistFromMemo(task.description)
    const hasChecklist = checklistItems.length > 0
    const isExpanded = expandedTaskIds.has(task.id)
    const completedCount = checklistItems.filter(item => item.isCompleted).length

    return (
      <SwipeableTaskItem
        key={task.id}
        task={task}
        onSwipeLeft={() => moveTaskUp(task, updateTask)}
        onSwipeRight={() => moveTaskDown(task, updateTask)}
        isSwiping={swipingTaskId === task.id}
        onSwipingChange={(swiping) => setSwipingTaskId(swiping ? task.id : null)}
      >
        <div className="flex items-center gap-2 px-3 py-2 active:bg-gray-50">
          <AnimatedCheckbox
            checked={task.status === 'completed'}
            onChange={() => handleToggleComplete(task)}
            color={color}
          />
          
          {/* 체크리스트 토글 버튼 */}
          {hasChecklist && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleExpand(task.id)
              }}
              className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-gray-400"
            >
              <ChevronRight 
                size={14} 
                className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
              />
            </button>
          )}

          <div 
            className="flex-1 min-w-0 flex items-center gap-2"
            onClick={() => setSelectedTask(task)}
          >
            <div className={`text-sm truncate ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'} ${color === 'red' ? 'font-semibold' : ''}`}>
              {task.title}
            </div>
            {hasChecklist && (
              <span className="text-[10px] text-gray-400 flex-shrink-0">
                {completedCount}/{checklistItems.length}
              </span>
            )}
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

        {/* 체크리스트 항목 (펼쳐졌을 때) */}
        {hasChecklist && isExpanded && (
          <div className="ml-10 mr-3 mb-2 py-1 space-y-0.5 bg-gray-50 rounded-lg">
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
      </SwipeableTaskItem>
    )
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
        onNavigateToTab={onNavigateToTab}
      />
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto pb-32">
        {/* Today's Focus */}
        <div className="bg-white mb-2">
          <div className="px-3 py-2 border-b border-gray-100">
            <h2 className="text-sm font-bold text-red-600">Today's Focus ({focusTasks.length})</h2>
          </div>
          {focusTasks.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {focusTasks.map(task => renderTaskItem(task, 'red'))}
            </div>
          ) : (
            <div className="px-3 py-3 text-xs text-gray-400">
              * 표시로 포커스 태스크를 추가하세요
            </div>
          )}
        </div>

        {/* Today's Task */}
        <div className="bg-white mb-2">
          <div className="px-3 py-2 border-b border-gray-100">
            <h2 className="text-sm font-bold text-green-600">Today's Task ({todayTasks.length})</h2>
          </div>
          {todayTasks.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {todayTasks.map(task => renderTaskItem(task, 'green'))}
            </div>
          ) : (
            <div className="px-3 py-3 text-xs text-gray-400">
              / 표시로 오늘 할 태스크를 추가하세요
            </div>
          )}
        </div>

      </div>

      {/* 빠른 입력창 - 하단 고정 */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 p-3 z-40">
        <div className="flex gap-2">
          {/* 모바일에서만 표시되는 버튼 (세로 배치) */}
          <div className="md:hidden flex flex-col gap-2">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()} // 버튼이 포커스를 가져가지 않도록
              onClick={() => {
                if (newTaskTitle.startsWith('*')) {
                  setNewTaskTitle(newTaskTitle.substring(1).trim())
                } else {
                  setNewTaskTitle('*' + newTaskTitle.replace(/^\/\s*/, ''))
                }
                // 누른 후에도 입력창 포커스 유지
                inputRef.current?.focus()
              }}
              className={`px-3 py-2 text-sm font-bold rounded-lg transition-colors ${
                newTaskTitle.startsWith('*')
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 active:bg-gray-200'
              }`}
            >
              *
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (newTaskTitle.startsWith('/')) {
                  setNewTaskTitle(newTaskTitle.substring(1).trim())
                } else {
                  setNewTaskTitle('/' + newTaskTitle.replace(/^\*\s*/, ''))
                }
                inputRef.current?.focus()
              }}
              className={`px-3 py-2 text-sm font-bold rounded-lg transition-colors ${
                newTaskTitle.startsWith('/')
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 active:bg-gray-200'
              }`}
            >
              /
            </button>
          </div>
          <textarea
            ref={inputRef}
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="빠른 입력 (Enter: 테스크 | Shift+Enter: 노트)"
            className="flex-1 px-3 py-2 text-base border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={2}
          />
        </div>
      </div>
    </div>
  )
}

