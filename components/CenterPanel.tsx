'use client'

import { useState, useEffect, useMemo, useRef, memo } from 'react'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { format, isSameMinute, parseISO, isSameDay } from 'date-fns'
import { Check, X } from 'lucide-react'
import type { Task, Project } from '@/types/database'
import TaskDetailPopover from './TaskDetailPopover'
import { DailyNoteModal } from './DailyNoteModal'
import { useDailyNotes } from '@/hooks/useDailyNotes'

interface CenterPanelProps {
  tasks: Task[]
  createTask?: (task: Partial<Task>) => Promise<any>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  dragOverSlotId?: string | null
  draggingTask?: Task | undefined
  projects: Project[]
  makeupProject?: Project | null
  onClearMakeupMode?: () => void
  currentDate?: Date
  onDateChange?: (date: Date) => void
  pendingCancelTask?: {
    taskId: string
    projectId: string
    homeworkAssignments: any[]
  } | null
  setPendingCancelTask?: (task: any) => void
  onSelectMakeupProject?: (project: Project | null) => void
  onDateHeaderClick?: (date: Date) => void
}

const DroppableSlot = memo(function DroppableSlot({ date, hour, minute, children, onClick, isPreviewSlot, previewTask, makeupMode }: {
  date: Date,
  hour: number,
  minute: number,
  children: React.ReactNode,
  onClick?: () => void,
  isPreviewSlot?: boolean,
  previewTask?: Task,
  makeupMode?: boolean
}) {
  const slotId = `slot-${format(date, 'yyyy-MM-dd')}-${hour}-${minute}`

  const { setNodeRef, isOver } = useDroppable({
    id: slotId,
  })

  const previewHeight = previewTask ? (previewTask.duration || 60) * 1.4 : 0

  // 미리보기 박스 색상 계산
  const getPreviewBgColor = () => {
    if (!previewTask) return 'bg-yellow-200/50'

    // 학생 시간표인 경우
    if (previewTask.is_auto_generated || previewTask.is_makeup) {
      if (previewTask.is_cancelled) {
        return 'bg-gray-200/50' // 취소된 수업
      } else if (previewTask.is_makeup) {
        return 'bg-green-200/50' // 보충 수업
      } else {
        return 'bg-sky-200/50' // 정규 수업
      }
    }

    return 'bg-yellow-200/50' // 일반 태스크
  }

  const getPreviewBadgeBgColor = () => {
    if (!previewTask) return 'bg-yellow-600'

    // 학생 시간표인 경우
    if (previewTask.is_auto_generated || previewTask.is_makeup) {
      if (previewTask.is_cancelled) {
        return 'bg-gray-600' // 취소된 수업
      } else if (previewTask.is_makeup) {
        return 'bg-green-600' // 보충 수업
      } else {
        return 'bg-sky-600' // 정규 수업
      }
    }

    return 'bg-yellow-600' // 일반 태스크
  }

  return (
    <div
      ref={setNodeRef}
      onClick={makeupMode ? onClick : undefined}
      onDoubleClick={!makeupMode ? onClick : undefined}
      className={`h-[14px] border-r border-gray-100 last:border-r-0 transition-colors cursor-pointer relative group ${isOver ? 'bg-blue-50 border-blue-200 z-10' : 'hover:bg-gray-50'
        } ${minute === 0
          ? 'border-t border-gray-300'
          : minute === 30
            ? 'border-t border-gray-200'
            : 'border-t border-dashed border-gray-150'
        }`}
    >
      {children}

      {/* Preview Box - 드롭 예상 위치 표시 */}
      {isPreviewSlot && previewTask && (
        <div
          style={{ height: `${previewHeight}px` }}
          className={`absolute top-0 left-0 right-0 ${getPreviewBgColor()} rounded-sm z-[5] pointer-events-none flex items-start justify-center pt-0.5`}
        >
          <div className={`${getPreviewBadgeBgColor()} text-white text-[10px] font-bold px-1.5 py-0 rounded shadow-md`}>
            {format(new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute), 'HH:mm')}
          </div>
        </div>
      )}
    </div>
  )
})

const DraggableCalendarTask = memo(function DraggableCalendarTask({
  task,
  updateTask,
  deleteTask,
  onClick,
  projectColor,
  layout,
  project
}: {
  task: Task,
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>,
  deleteTask: (id: string) => Promise<void>,
  onClick: (e: React.MouseEvent) => void,
  projectColor?: string,
  layout?: { width: number, left: number },
  project?: Project
}) {
  const { attributes, setNodeRef } = useDraggable({
    id: task.id,
    data: { type: 'calendar-task', task },
    disabled: true  // 드래그 비활성화 (시간 수정은 모달 버튼 사용)
  })

  const [isResizing, setIsResizing] = useState(false)
  const [tempDuration, setTempDuration] = useState<number | null>(null)

  const displayDuration = tempDuration ?? task.duration ?? 60
  const height = displayDuration * 1.4

  // 완료 여부 확인
  const isCompleted = task.status === 'completed'

  // 색상 계산 로직
  const getBgColor = () => {
    // 완료된 태스크는 연한 회색
    if (isCompleted) {
      return 'bg-gray-100'
    }

    // 학생 시간표인 경우 - 배경색은 항상 동일
    if (task.is_auto_generated || task.is_makeup) {
      if (task.is_cancelled) {
        return 'bg-gray-100' // 취소된 수업
      } else if (task.is_makeup) {
        return 'bg-green-100' // 보충 수업
      } else {
        return 'bg-sky-100' // 정규 수업 - 배경은 항상 하늘색
      }
    }

    // 일반 프로젝트인 경우
    if (!projectColor) return 'rgba(253, 224, 71, 0.15)' // 아주 연한 투명한 노란색
    // hex to rgb then apply opacity
    const hex = projectColor.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, 0.15)`
  }

  const getTextColor = () => {
    // 완료된 태스크는 회색 텍스트
    if (isCompleted) {
      return 'text-gray-400'
    }

    // 학생 시간표인 경우
    if (task.is_auto_generated || task.is_makeup) {
      if (task.is_cancelled) {
        return 'text-gray-500' // 취소된 수업
      } else if (task.is_makeup) {
        return 'text-green-700' // 보충 수업
      } else {
        return 'text-sky-700' // 정규 수업 - 하늘색 텍스트
      }
    }

    // 일반 프로젝트인 경우
    if (!projectColor) return 'text-yellow-900'
    return 'text-gray-800'
  }

  const getBorderColor = () => {
    // 완료된 태스크는 회색 테두리
    if (isCompleted) {
      return 'border-gray-300'
    }

    // 학생 시간표인 경우
    if (task.is_auto_generated || task.is_makeup) {
      if (task.is_cancelled) {
        return 'border-gray-300' // 취소된 수업
      } else if (task.is_makeup) {
        return 'border-green-500 border-2' // 보충 수업
      } else {
        // 정규 수업: 프로젝트 색상을 테두리에 사용
        if (projectColor) {
          return `border-2` // 2px 두께
        }
        return 'border-sky-500 border-2' // 기본값
      }
    }

    // 일반 태스크인 경우 (프로젝트가 없는 경우)
    if (!projectColor) return 'border-red-300 border-2'
    // 일반 프로젝트가 있는 경우
    return 'border-2'
  }

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    setIsResizing(true)
    const startY = e.clientY
    const startDuration = task.duration || 60
    const pixelsPerMinute = 1.4

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault()
      const deltaY = moveEvent.clientY - startY
      const deltaMinutes = Math.round(deltaY / pixelsPerMinute / 10) * 10
      const newDuration = Math.max(10, startDuration + deltaMinutes)

      // 실시간으로 임시 높이 업데이트
      setTempDuration(newDuration)
    }

    const handleMouseUp = (upEvent: MouseEvent) => {
      const deltaY = upEvent.clientY - startY
      const deltaMinutes = Math.round(deltaY / pixelsPerMinute / 10) * 10
      const newDuration = Math.max(10, startDuration + deltaMinutes)

      if (newDuration !== startDuration) {
        updateTask(task.id, { duration: newDuration })
      }

      setTempDuration(null)
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const bgColor = getBgColor()
  const textColor = getTextColor()
  const borderColor = getBorderColor()

  // 너비와 위치 계산 (겹침 처리)
  const widthPercent = layout ? layout.width : 100
  const leftPercent = layout ? layout.left : 0

  // 학생 시간표의 정규 수업인 경우 프로젝트 색상을 테두리에 적용
  const shouldUseBorderColor = (task.is_auto_generated && !task.is_makeup && !task.is_cancelled) && projectColor

  return (
    <div
      ref={setNodeRef}
      style={{
        height: `${height}px`,
        width: `${widthPercent}%`,
        left: `${leftPercent}%`,
        backgroundColor: typeof bgColor === 'string' && bgColor.startsWith('rgba') ? bgColor : undefined,
        borderColor: shouldUseBorderColor ? projectColor : undefined,
        borderWidth: shouldUseBorderColor ? '2px' : undefined,
        borderStyle: shouldUseBorderColor ? 'solid' : undefined,
      }}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation()
        onClick(e)
      }}
      className={`absolute top-0 text-xs ${typeof bgColor === 'string' && bgColor.startsWith('bg-') ? bgColor : ''} ${textColor} ${!shouldUseBorderColor ? borderColor : ''} rounded-sm px-1.5 py-0.5 leading-snug hover:opacity-90 transition-all overflow-hidden group/task select-none flex flex-col cursor-pointer z-10 hover:z-20
        ${isResizing ? 'ring-2 ring-blue-400 shadow-lg' : ''}
      `}
    >
      <div className="flex items-start gap-1 min-w-0 relative">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            const newStatus = isCompleted ? 'scheduled' : 'completed'
            // 학생 수업이면 출석 처리도 함께 업데이트
            const updates: Partial<Task> = { status: newStatus }
            if (task.is_auto_generated || task.is_makeup) {
              updates.attendance = newStatus === 'completed' ? 'present' : undefined
            }
            updateTask(task.id, updates)
          }}
          className={`flex-shrink-0 w-4 h-4 mt-0.5 rounded-[3px] border transition-colors flex items-center justify-center
              ${isCompleted
              ? 'bg-gray-500 border-gray-500'
              : 'border-blue-300 bg-white/50 hover:bg-blue-500 hover:border-blue-500 group/check'
            }`}
        >
          <Check size={10} className={`text-white ${isCompleted ? 'opacity-100' : 'opacity-0 group-hover/check:opacity-100'}`} strokeWidth={4} />
        </button>
        <div className="flex-1 min-w-0">
          <div className={`line-clamp-2 font-medium break-words ${isCompleted ? 'line-through' : ''}`}>
            {task.title || '(제목 없음)'}
          </div>
          {/* 시작 시간 표시 */}
          {task.start_time && (
            <div className="text-[10px] text-gray-500 mt-0.5">
              {format(parseISO(task.start_time), 'HH:mm')}
            </div>
          )}
        </div>

        {/* Duration Display during resize */}
        {isResizing && (
          <div className="absolute right-1 top-0 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0 rounded shadow-md z-20">
            {displayDuration}분
          </div>
        )}

        {/* Delete Button - 우측 상단 X 표시 */}
        {!isResizing && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              if (confirm('정말 이 수업을 삭제하시겠습니까?')) {
                deleteTask(task.id)
              }
            }}
            className="absolute right-0.5 top-0.5 w-4 h-4 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-white/80 opacity-0 group-hover/task:opacity-100 transition-all z-10"
            title="삭제"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Resize Handle - Enhanced */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-4 cursor-ns-resize flex items-end justify-center transition-opacity
          ${isResizing ? 'opacity-100 bg-blue-200/30' : 'opacity-0 group-hover/task:opacity-100'}
        `}
        onMouseDown={handleResizeStart}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Visual Handle */}
        <div className={`w-12 h-1 rounded-full mb-0.5 mx-auto transition-colors ${isResizing ? 'bg-blue-500' : 'bg-blue-300'}`} />
      </div>
    </div>
  )
})

// 겹치는 태스크 레이아웃 계산 함수
function calculateLayout(tasks: Task[]) {
  if (tasks.length === 0) return {}

  // 1. 시작 시간 순으로 정렬
  const sorted = [...tasks].sort((a, b) => {
    if (!a.start_time || !b.start_time) return 0
    return a.start_time.localeCompare(b.start_time)
  })

  const layoutMap: Record<string, { width: number, left: number }> = {}
  const clusters: Task[][] = []

  // 2. 클러스터링 (겹치는 그룹 찾기)
  for (const task of sorted) {
    if (!task.start_time) continue

    const taskStart = new Date(task.start_time).getTime()
    const taskEnd = taskStart + (task.duration || 60) * 60 * 1000

    let added = false

    if (clusters.length > 0) {
      const lastCluster = clusters[clusters.length - 1]
      // 클러스터의 마지막 종료 시간 확인
      const clusterEnd = Math.max(...lastCluster.map(t => {
        const tStart = new Date(t.start_time!).getTime()
        return tStart + (t.duration || 60) * 60 * 1000
      }))

      // 겹치면 같은 클러스터에 추가
      if (taskStart < clusterEnd) {
        lastCluster.push(task)
        added = true
      }
    }

    if (!added) {
      clusters.push([task])
    }
  }

  // 3. 각 클러스터별 레이아웃 계산 (컬럼 패킹)
  for (const cluster of clusters) {
    const columns: Task[][] = []

    for (const task of cluster) {
      let colIndex = 0
      const taskStart = new Date(task.start_time!).getTime()
      const taskEnd = taskStart + (task.duration || 60) * 60 * 1000

      while (true) {
        const colTasks = columns[colIndex] || []
        // 현재 컬럼의 태스크들과 겹치는지 확인
        const hasOverlap = colTasks.some(t => {
          const tStart = new Date(t.start_time!).getTime()
          const tEnd = tStart + (t.duration || 60) * 60 * 1000
          return taskStart < tEnd && tStart < taskEnd
        })

        if (!hasOverlap) {
          if (!columns[colIndex]) columns[colIndex] = []
          columns[colIndex].push(task)
          break
        }
        colIndex++
      }
    }

    const numCols = columns.length
    const width = 100 / numCols

    columns.forEach((colTasks, colIndex) => {
      colTasks.forEach(task => {
        layoutMap[task.id] = {
          width: width,
          left: colIndex * width
        }
      })
    })
  }

  return layoutMap
}

export default function CenterPanel({ tasks = [], createTask, updateTask, deleteTask, dragOverSlotId, draggingTask, projects, makeupProject, onClearMakeupMode, currentDate: propCurrentDate = new Date(), onDateChange, pendingCancelTask, setPendingCancelTask, onSelectMakeupProject, onDateHeaderClick }: CenterPanelProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [popoverPosition, setPopoverPosition] = useState<{ x: number, y: number } | undefined>(undefined)
  const [now, setNow] = useState(new Date())
  const [showDailyNoteModal, setShowDailyNoteModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const { getNoteByDate, createNote, updateNote, deleteNote } = useDailyNotes()

  // prop으로 받은 currentDate 사용
  const currentDate = propCurrentDate

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // 프로젝트 색상 맵
  const projectColorMap = projects.reduce((acc, project) => {
    acc[project.id] = project.color
    return acc
  }, {} as Record<string, string>)

  // 프로젝트 맵
  const projectMap = projects.reduce((acc, project) => {
    acc[project.id] = project
    return acc
  }, {} as Record<string, Project>)

  // 06:30부터 새벽 01:00까지 표시
  // 6시 30분부터 시작, 다음날 1시까지 (총 19시간 = 6:30~23:50 + 00:00~01:00)
  const hours = [
    ...Array.from({ length: 18 }, (_, i) => i + 6), // 6~23시
    0, 1 // 0시, 1시
  ]
  const minutes = [0, 10, 20, 30, 40, 50]
  const days = ['월', '화', '수', '목', '금', '토', '일']

  const getWeekStart = (date: Date) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return d
  }

  const today = new Date()
  const weekStart = getWeekStart(currentDate)
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  const handlePrevWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() - 7)
    if (onDateChange) {
      onDateChange(newDate)
    }
  }

  const handleNextWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + 7)
    if (onDateChange) {
      onDateChange(newDate)
    }
  }

  const handleToday = () => {
    if (onDateChange) {
      onDateChange(new Date())
    }
  }

  const weekRangeText = `${format(weekDates[0], 'yyyy년 M월 d일')} - ${format(weekDates[6], 'd일')}`

  const getTasksForSlot = (date: Date, hour: number, minute: number) => {
    return tasks.filter(task => {
      if (!task.start_time) return false
      // status가 completed여도 표시해야 함
      if (task.status !== 'scheduled' && task.status !== 'completed') return false
      const taskDate = parseISO(task.start_time)
      const slotDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute)
      return isSameMinute(taskDate, slotDate)
    })
  }

  const handleSlotClick = async (date: Date, hour: number, minute: number) => {
    if (!createTask) return

    const startTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute)

    let taskData: Partial<Task>

    // 보충 수업 모드인 경우
    if (makeupProject && makeupProject.type === 'student') {
      taskData = {
        title: makeupProject.name,
        project_id: makeupProject.id,
        start_time: startTime.toISOString(),
        duration: makeupProject.schedule_template?.[0]?.duration || 40,
        status: 'scheduled',
        is_makeup: true,
        is_auto_generated: false, // 수동 추가된 보충
        is_top5: false
      }

      // Phase 8: 취소 대기 중인 수업이 있으면 과제 이전
      if (pendingCancelTask && pendingCancelTask.projectId === makeupProject.id) {
        // 과제 배정 → 과제 체크로 변환
        const transferredChecks = pendingCancelTask.homeworkAssignments.flatMap(
          (assignment: any) => assignment.chapters.map((chapter: string) => ({
            textbook_id: assignment.textbook_id,
            textbook_name: assignment.textbook_name,
            chapter: chapter,
            is_completed: false,
            note: '(취소된 수업에서 이전)'
          }))
        )

        taskData.homework_checks = transferredChecks

        // 원래 수업 취소 처리
        try {
          await updateTask(pendingCancelTask.taskId, {
            is_cancelled: true,
            status: 'cancelled',
            homework_assignments: []
          })
          
          // 대기 상태 초기화
          if (setPendingCancelTask) {
            setPendingCancelTask(null)
          }

          alert(
            '보충 수업이 추가되었습니다.\n' +
            '취소된 수업의 과제가 자동으로 배정되었습니다.'
          )
        } catch (error) {
          console.error('Error canceling original lesson:', error)
          alert('원래 수업 취소 중 오류가 발생했습니다.')
        }
      }

      // 보충 수업 생성 후 모드 해제
      if (onClearMakeupMode) {
        onClearMakeupMode()
      }
    } else {
      // 일반 태스크 생성
      taskData = {
        title: '',
        start_time: startTime.toISOString(),
        status: 'scheduled',
        is_top5: false,
        duration: 30
      }
    }

    const newTask = await createTask(taskData)

    if (newTask) {
      setSelectedTask(newTask)
      setPopoverPosition(undefined)
    }
  }

  const handleTaskClick = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation()
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setPopoverPosition({ x: rect.right + 10, y: rect.top })
    setSelectedTask(task)
  }

  // 레이아웃 계산 최적화 (Memoization) - 성능 개선
  const dailyLayouts = useMemo(() => {
    const layouts: Record<string, ReturnType<typeof calculateLayout>> = {}

    weekDates.forEach(date => {
      const dateKey = format(date, 'yyyy-MM-dd')
      const dayTasks = tasks.filter(t => {
        if (!t.start_time) return false
        if (t.status !== 'scheduled' && t.status !== 'completed') return false
        return isSameDay(parseISO(t.start_time), date)
      })
      layouts[dateKey] = calculateLayout(dayTasks)
    })

    return layouts
  }, [
    tasks.length, 
    tasks.filter(t => t.status === 'scheduled' || t.status === 'completed')
         .map(t => `${t.id}:${t.start_time}:${t.duration}`).join('|'),
    currentDate
  ]) // 더 세밀한 의존성으로 불필요한 재계산 방지

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // 초기 스크롤 위치 설정
  useEffect(() => {
    if (scrollContainerRef.current) {
      const day = now.getDay()
      const isWeekend = day === 0 || day === 6 // 0: 일요일, 6: 토요일

      // 평일은 12시(오후 12시), 주말은 9시부터 보이도록 설정
      const targetHour = isWeekend ? 9 : 12

      // 6시 30분부터 시작하므로, 6시 이전은 계산에서 제외
      // 각 시간 슬롯의 높이는 14px * 6 = 84px (1시간)
      // 6시 30분부터 시작하므로 첫 30분(42px)은 제외됨

      // targetHour까지의 시간 차이 계산
      const startHour = 6
      const hourDiff = targetHour - startHour

      if (hourDiff > 0) {
        // 시간당 84px
        const scrollPosition = (hourDiff * 84) - 42 // 30분 보정
        scrollContainerRef.current.scrollTop = scrollPosition
      }
    }
  }, []) // 컴포넌트 마운트 시 한 번만 실행

  return (
    <div className="h-full flex flex-col bg-white relative select-none">
      {selectedTask && (
        <TaskDetailPopover
          task={selectedTask}
          updateTask={updateTask}
          deleteTask={deleteTask}
          onClose={() => setSelectedTask(null)}
          position={popoverPosition}
          projects={projects}
          tasks={tasks}
          createTask={createTask}
          setPendingCancelTask={setPendingCancelTask}
          onSelectMakeupProject={onSelectMakeupProject}
          onNavigateToTask={(task) => {
            setSelectedTask(task)
            setPopoverPosition(undefined)
          }}
        />
      )}

      {/* 보충 수업 추가 모드 배너 */}
      {makeupProject && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-b-2 border-green-300 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✨</span>
              <div>
                <div className="text-sm font-semibold text-green-900">
                  보충 수업 추가: {makeupProject.name}
                </div>
                <div className="text-xs text-green-700 mt-0.5">
                  시간표에서 원하는 시간을 클릭하세요 ({makeupProject.schedule_template?.[0]?.duration || 40}분)
                </div>
              </div>
            </div>
            <button
              onClick={onClearMakeupMode}
              className="px-3 py-1.5 text-sm font-medium text-green-700 bg-white border border-green-300 rounded-lg hover:bg-green-50 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {weekRangeText}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handleToday}
              className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50"
            >
              오늘
            </button>
            <button
              onClick={handlePrevWeek}
              className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50"
            >
              ←
            </button>
            <button
              onClick={handleNextWeek}
              className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50"
            >
              →
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto" ref={scrollContainerRef}>
        <div className="min-w-[800px]">
          <div className="sticky top-0 bg-white border-b border-gray-200 z-30">
            <div className="grid grid-cols-[3rem_repeat(7,1fr)] gap-0">
              <div className="w-12 border-r border-gray-100 bg-gray-50"></div>
              {days.map((day, i) => {
                const isToday = isSameDay(weekDates[i], now)
                const dailyNote = getNoteByDate(weekDates[i])
                const isWeekend = i >= 5 // 토(5), 일(6)
                return (
                  <div
                    key={day}
                    onClick={() => {
                      setSelectedDate(weekDates[i])
                      setShowDailyNoteModal(true)
                      onDateHeaderClick?.(weekDates[i])
                    }}
                    className={`py-1 text-center text-sm font-bold border-r border-gray-200 last:border-r-0 cursor-pointer hover:bg-gray-50 transition-colors
                      ${isToday ? 'bg-blue-50/20 border-l-2 border-r-2 border-l-blue-600/30 border-r-blue-600/30 text-blue-900' : isWeekend ? 'text-red-600' : 'text-gray-900'}`}
                  >
                    {day}
                    <div className={`text-xs font-normal ${isToday ? 'text-blue-700' : isWeekend ? 'text-red-400' : 'text-gray-400'}`}>
                      {format(weekDates[i], 'd')}
                    </div>
                    {dailyNote && (
                      <div className="text-xs mt-0.5 px-1 truncate text-gray-600">
                        <span className="mr-0.5">{dailyNote.emoji}</span>
                        {dailyNote.title}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="relative">
            {hours.map((hour) => (
              <div key={hour} className="grid grid-cols-[3rem_repeat(7,1fr)] gap-0 relative">
                <div className="w-12 text-base text-right border-r border-gray-100 bg-gray-50 relative">
                  <span className={`absolute top-0 right-1.5 -translate-y-1/2 bg-gray-50 px-0.5 ${hour >= 12 ? 'text-gray-900 font-bold' : 'text-gray-500'}`}>
                    {(hour % 12 || 12).toString().padStart(2, '0')}
                  </span>
                </div>

                {/* Current Time Line - Only render in the correct hour row */}
                {hour === now.getHours() && (
                  <div
                    className="absolute left-[4rem] right-0 border-t border-red-300 z-20 pointer-events-none flex items-center"
                    style={{ top: `${(now.getMinutes() / 60) * 100}%` }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-red-300 -ml-[3px]" />
                  </div>
                )}

                {weekDates.map((date, i) => {
                  const dateKey = format(date, 'yyyy-MM-dd')
                  const layoutMap = dailyLayouts[dateKey] || {}

                  return (
                    <div key={i} className={`border-r border-gray-100 last:border-r-0 relative ${isSameDay(date, now) ? 'border-l-2 border-r-2 border-l-blue-600/30 border-r-blue-600/30 bg-blue-50/10' : ''}`}>
                      {minutes
                        .filter(minute => {
                          // 6시는 30분부터만, 1시는 00분까지만 (06:30 ~ 01:00)
                          if (hour === 6 && minute < 30) return false
                          if (hour === 1 && minute > 0) return false
                          return true
                        })
                        .map((minute) => {
                          const slotTasks = getTasksForSlot(date, hour, minute)
                          const slotId = `slot-${format(date, 'yyyy-MM-dd')}-${hour}-${minute}`
                          const isPreviewSlot = dragOverSlotId === slotId

                          return (
                            <DroppableSlot
                              key={minute}
                              date={date}
                              hour={hour}
                              minute={minute}
                              onClick={() => handleSlotClick(date, hour, minute)}
                              makeupMode={!!makeupProject}
                              isPreviewSlot={isPreviewSlot}
                              previewTask={draggingTask}
                            >
                              {slotTasks.map((task) => (
                                <DraggableCalendarTask
                                  key={task.id}
                                  task={task}
                                  updateTask={updateTask}
                                  deleteTask={deleteTask}
                                  onClick={(e) => handleTaskClick(e, task)}
                                  projectColor={task.project_id ? projectColorMap[task.project_id] : undefined}
                                  layout={layoutMap[task.id]}
                                  project={task.project_id ? projectMap[task.project_id] : undefined}
                                />
                              ))}
                            </DroppableSlot>
                          )
                        })}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily Note Modal */}
      {showDailyNoteModal && selectedDate && (
        <DailyNoteModal
          date={selectedDate}
          existingNote={getNoteByDate(selectedDate)}
          onSave={createNote}
          onUpdate={updateNote}
          onDelete={deleteNote}
          onClose={() => {
            setShowDailyNoteModal(false)
            setSelectedDate(null)
          }}
        />
      )}
    </div>
  )
}
