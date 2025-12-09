'use client'

import { useState } from 'react'
import { format, addDays, subDays, isSameDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Check, ChevronRight } from 'lucide-react'
import type { Task, Project } from '@/types/database'
import { parseChecklistFromMemo } from '@/utils/checklistParser'
import TaskDetailPopover from './DetailPopover'

interface MobileScheduleViewProps {
  tasks: Task[]
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  projects: Project[]
  createTask?: (task: Partial<Task>) => Promise<any>
}

export default function MobileScheduleView({
  tasks,
  updateTask,
  deleteTask,
  projects,
  createTask
}: MobileScheduleViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set())

  // 오늘 수업만 필터링 (학생 수업)
  const todayLessons = tasks.filter(task => 
    task.start_time &&
    isSameDay(new Date(task.start_time), currentDate) &&
    (task.is_auto_generated || task.is_makeup) &&
    !task.is_cancelled
  ).sort((a, b) => 
    new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime()
  )

  const goToPrevDay = () => setCurrentDate(prev => subDays(prev, 1))
  const goToNextDay = () => setCurrentDate(prev => addDays(prev, 1))
  const goToToday = () => setCurrentDate(new Date())

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return format(date, 'HH:mm')
  }

  const getTaskBgColor = (task: Task) => {
    if (task.is_cancelled) return 'bg-gray-100'
    if (task.is_makeup) return 'bg-yellow-50'
    return 'bg-sky-50'
  }

  const getTaskBorderColor = (task: Task) => {
    if (task.is_cancelled) return 'border-gray-300'
    if (task.is_makeup) return 'border-yellow-300'
    return 'border-sky-300'
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
      {/* 날짜 네비게이션 */}
      <div className="bg-white border-b border-gray-200 p-3">
        <div className="flex items-center justify-between">
          <button
            onClick={goToPrevDay}
            className="p-2 hover:bg-gray-100 rounded-lg active:bg-gray-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">
              {format(currentDate, 'M월 d일', { locale: ko })}
            </div>
            <div className="text-xs text-gray-500">
              {format(currentDate, 'EEEE', { locale: ko })} ({todayLessons.length})
            </div>
          </div>

          <button
            onClick={goToNextDay}
            className="p-2 hover:bg-gray-100 rounded-lg active:bg-gray-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {!isSameDay(currentDate, new Date()) && (
          <button
            onClick={goToToday}
            className="w-full mt-2 py-1.5 text-xs text-blue-600 bg-blue-50 rounded-lg active:bg-blue-100"
          >
            오늘로 이동
          </button>
        )}
      </div>

      {/* 수업 목록 */}
      <div className="flex-1 overflow-y-auto pb-20">
        {todayLessons.length > 0 ? (
          <div className="p-3 space-y-2">
            {todayLessons.map(lesson => {
              const project = projects.find(p => p.id === lesson.project_id)
              const checklistItems = parseChecklistFromMemo(lesson.description)
              const hasChecklist = checklistItems.length > 0
              const isExpanded = expandedTaskIds.has(lesson.id)
              const completedCount = checklistItems.filter(item => item.isCompleted).length

              return (
                <div key={lesson.id}>
                  <div
                    className={`${getTaskBgColor(lesson)} ${getTaskBorderColor(lesson)} border-l-4 rounded-lg px-3 py-2 active:opacity-70`}
                  >
                    <div className="flex items-center gap-2">
                      {/* 체크리스트 토글 버튼 */}
                      {hasChecklist && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleExpand(lesson.id)
                          }}
                          className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-400"
                        >
                          <ChevronRight 
                            size={16} 
                            className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                          />
                        </button>
                      )}

                      <span className="text-xs font-semibold text-gray-700 flex-shrink-0">
                        {formatTime(lesson.start_time!)}
                      </span>
                      <div 
                        className="flex-1 min-w-0 flex items-center gap-2"
                        onClick={() => setSelectedTask(lesson)}
                      >
                        <span className="text-sm font-bold text-gray-900 truncate">
                          {lesson.title}
                        </span>
                        {hasChecklist && (
                          <span className="text-[10px] text-gray-400 flex-shrink-0">
                            {completedCount}/{checklistItems.length}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500 flex-shrink-0">
                        {lesson.duration}분
                      </span>
                    </div>
                  </div>

                  {/* 체크리스트 항목 (펼쳐졌을 때) */}
                  {hasChecklist && isExpanded && (
                    <div className="ml-4 mt-1 py-1 space-y-0.5 bg-white rounded-lg border border-gray-100">
                      {checklistItems.map((item, idx) => (
                        <div 
                          key={idx}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm"
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleChecklistToggle(lesson, item.lineIndex, !item.isCompleted)
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
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <div className="text-sm">수업이 없습니다</div>
          </div>
        )}
      </div>

      {/* Task Detail Popover */}
      {selectedTask && (
        <TaskDetailPopover
          task={selectedTask}
          updateTask={updateTask}
          deleteTask={deleteTask}
          onClose={() => setSelectedTask(null)}
          projects={projects}
          tasks={tasks}
          createTask={createTask}
        />
      )}
    </div>
  )
}
