'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDroppable
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, FolderPlus, Folder, ChevronDown, ChevronRight, X, Trash2 } from 'lucide-react'
import type { Task, Project } from '@/types/database'
import TaskDetailPopover from './TaskDetailPopover'
import ProjectCreateModal from './ProjectCreateModal'
import { extractTags } from '@/utils/textParser'

interface LeftPanelProps {
  tasks: Task[]
  createTask: (task: Partial<Task>) => Promise<any>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  reorderTasks: (activeId: string, overId: string) => void
  toggleTaskStatus: (id: string, currentStatus: string) => void
  projects: Project[]
  createProject: (project: Partial<Project>) => Promise<Project>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
}

function SortableTaskItem({ id, task, onClick, onToggleComplete, isInbox = false, isCompleting = false }: { id?: string, task: Task, onClick: (e: React.MouseEvent) => void, onToggleComplete: (e: React.MouseEvent) => void, isInbox?: boolean, isCompleting?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: id || task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  }

  const isCompleted = task.status === 'completed'
  const isScheduled = task.status === 'scheduled'

  // 오늘 날짜인지 확인
  const isToday = task.due_date && new Date(task.due_date).toDateString() === new Date().toDateString()

  // 제목에서 #태그 부분을 연하게 표시
  const renderTitle = (title: string) => {
    const parts = title.split(/(#[\w가-힣]+)/g)
    return parts.map((part, i) => {
      if (part.startsWith('#')) {
        return <span key={i} className="text-gray-400">{part}</span>
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`group flex items-start gap-2 transition-all duration-300 ease-out cursor-grab active:cursor-grabbing border-b
        ${isInbox ? 'p-1 text-xs' : 'p-1.5 text-sm'}
        ${isCompleting ? 'opacity-0 scale-95 -translate-x-4' : 'opacity-100 scale-100 translate-x-0'}
        ${isCompleting
          ? 'text-gray-400 border-gray-100 bg-gray-50/50'
          : isCompleted
            ? 'text-gray-400 border-gray-100 bg-gray-50'
            : task.is_top5
              ? 'bg-red-50/40 border-gray-100'
              : isToday
                ? 'bg-green-50/40 border-gray-100'
                : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
        }`}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation() // 드래그나 클릭 방지
          onToggleComplete(e)
        }}
        onPointerDown={(e) => e.stopPropagation()} // 드래그 시작 방지
        className={`flex-shrink-0 w-4 h-4 mt-0.5 rounded-[4px] border flex items-center justify-center transition-all duration-200
            ${isCompleting || isCompleted
            ? 'bg-blue-500 border-blue-500 text-white'
            : task.is_top5
              ? 'border-red-300 hover:border-red-400 bg-white text-transparent hover:bg-red-50'
              : isToday
                ? 'border-green-400 hover:border-green-500 bg-white text-transparent hover:bg-green-50'
                : 'border-gray-300 hover:border-blue-400 text-transparent hover:bg-blue-50'
          }`}
      >
        <Check size={10} strokeWidth={4} />
      </button>

      {/* Content - 1줄 레이아웃 */}
      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
        {/* 제목 */}
        <div className={`truncate ${isInbox ? 'text-xs' : 'text-sm'} ${isCompleting || isCompleted ? 'line-through' : ''} ${task.is_top5 ? 'font-semibold text-gray-900' : 'font-medium text-gray-900'}`}>
          {renderTitle(task.title)}
        </div>

        {/* 우측 인디케이터들 */}
        <div className="flex items-center gap-1.5">
          {/* Today's Task - 초록색 동그라미 */}
          {isToday && !isCompleting && !isCompleted && !task.is_top5 && (
            <div className="w-2 h-2 rounded-full bg-green-500" title="오늘 할 일" />
          )}

          {/* Scheduled - 노란색 동그라미 */}
          {isScheduled && !isCompleting && !isCompleted && (
            <div className="w-2 h-2 rounded-full bg-yellow-400" title="예정된 일정" />
          )}

          {/* Top 5 - 빨간색 동그라미 */}
          {task.is_top5 && !isCompleting && !isCompleted && (
            <div className="w-2 h-2 rounded-full bg-red-500" title="중요" />
          )}
        </div>
      </div>
    </div>
  )
}

export default function LeftPanel({ tasks, createTask, updateTask, deleteTask, reorderTasks, toggleTaskStatus, projects, createProject, updateProject, deleteProject }: LeftPanelProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [popoverPosition, setPopoverPosition] = useState<{ x: number, y: number } | undefined>(undefined)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false)
  const [showAllCompletedModal, setShowAllCompletedModal] = useState(false)
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set())

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px 이상 움직여야 드래그 시작 (단순 클릭과 구분)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 태그 추출 함수는 utils/textParser.ts로 이동 (공통 사용)

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!newTaskTitle.trim()) return

      let title = newTaskTitle.trim()
      let isTop5 = false
      let dueDate: string | undefined = undefined

      // 별표(*)로 시작하면 Today's Focus (Top 5)
      if (title.startsWith('*')) {
        isTop5 = true
        title = title.substring(1).trim()
      }
      // 캐럿(^) 대신 슬래시(/)로 시작하면 Today's Task (오늘 할 일)
      else if (title.startsWith('/')) {
        dueDate = new Date().toISOString()
        title = title.substring(1).trim()
      }

      // 태그 추출
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

  const handleTaskClick = (e: React.MouseEvent, task: Task) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setPopoverPosition({ x: rect.right + 10, y: rect.top })
    setSelectedTask(task)
  }

  const handleToggleComplete = (task: Task) => {
    if (task.status !== 'completed') {
      // 완료로 전환하는 경우 - 애니메이션 후 상태 변경
      setCompletingIds(prev => new Set(prev).add(task.id))
      
      // 300ms 후 실제 상태 변경
      setTimeout(() => {
        toggleTaskStatus(task.id, task.status)
        setCompletingIds(prev => {
          const next = new Set(prev)
          next.delete(task.id)
          return next
        })
      }, 300)
    } else {
      // 완료 취소는 즉시
      toggleTaskStatus(task.id, task.status)
    }
  }

  const handleCreateProject = async (project: Partial<Project>) => {
    const newProject = await createProject(project)
    return newProject
  }

  // 날짜 포맷팅을 위한 import 필요 (상단에 추가해야 함, 여기서는 로직만 수정)
  const todayStr = new Date().toISOString().split('T')[0]

  // 필터링 로직
  // 1. Today's Focus: is_top5 (가장 높은 우선순위)
  const focusTasks = tasks.filter(t => t.is_top5 && t.status !== 'completed' && t.status !== 'waiting' && !t.is_auto_generated && !t.is_makeup)

  // 2. Today's Task: !is_top5 && due_date === today
  const todayTasks = tasks.filter(t => !t.is_top5 && t.due_date?.split('T')[0] === todayStr && t.status !== 'completed' && t.status !== 'waiting' && !t.is_auto_generated && !t.is_makeup)

  // 3. Waiting: status === 'waiting'
  const waitingTasks = tasks.filter(t => t.status === 'waiting' && !t.is_auto_generated && !t.is_makeup)

  // 4. Inbox: ALL active tasks EXCEPT waiting (One Source of Truth)
  // Inbox에는 Waiting이 아닌 모든 활성 태스크가 포함됨 (Focus, Today 포함)
  // 보충수업(is_makeup)과 정규수업(is_auto_generated)은 INBOX에서 제외
  let inboxTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'waiting' && !t.is_auto_generated && !t.is_makeup)

  // 프로젝트 필터 적용
  if (selectedProjectId) {
    inboxTasks = inboxTasks.filter(t => t.project_id === selectedProjectId)
    // Waiting도 프로젝트 필터 적용? 요구사항엔 없지만 일반적인 동작
    // waitingTasks = waitingTasks.filter(t => t.project_id === selectedProjectId) -> const라 재할당 불가, 위에서 처리하거나 여기서 무시.
    // 일단 Inbox만 필터링하는 기존 로직 유지. Waiting은 전역적으로 보일 수 있음.
    // 하지만 "Inbox와 원소스를 보관하는 곳"이므로 필터링 되는게 맞을듯.
  }

  // Inbox 정렬
  inboxTasks = inboxTasks.sort((a, b) => {
    const getScore = (task: Task) => {
      const isRed = task.is_top5
      const isGreen = task.due_date?.split('T')[0] === todayStr
      const isYellow = task.status === 'scheduled'

      if (isRed && isYellow) return 5               // 1. 빨간색 + 노란색
      if (isRed) return 4                           // 2. 빨간색
      if (isGreen && isYellow) return 3             // 3. 초록색 + 노란색
      if (isGreen) return 2                         // 4. 초록색
      if (isYellow) return 1                        // 5. 노란색
      return 0                                      // 6. 나머지
    }

    const scoreA = getScore(a)
    const scoreB = getScore(b)

    if (scoreA !== scoreB) {
      return scoreB - scoreA
    }

    return (a.order_index || 0) - (b.order_index || 0)
  })

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // ID에서 접미사 제거
    const realActiveId = activeId.replace(/-inbox$/, '').replace(/-waiting$/, '')
    const realOverId = overId.replace(/-inbox$/, '').replace(/-waiting$/, '')

    // 컨테이너로 드롭된 경우 처리
    if (overId === 'focus-container' || overId === 'today-container' || overId === 'inbox-container' || overId === 'waiting-container') {
      const task = tasks.find(t => t.id === realActiveId)
      if (!task) return

      const updates: Partial<Task> = {}

      if (overId === 'focus-container') {
        updates.is_top5 = true
        updates.status = task.status === 'waiting' ? 'inbox' : task.status
        // Focus로 가면 날짜는 유지하거나 제거? 일단 유지.
      } else if (overId === 'today-container') {
        updates.is_top5 = false
        updates.due_date = todayStr
        updates.status = task.status === 'waiting' ? 'inbox' : task.status
      } else if (overId === 'inbox-container') {
        updates.is_top5 = false
        updates.due_date = undefined
        updates.status = 'inbox' // Waiting에서 왔다면 inbox로 변경
      } else if (overId === 'waiting-container') {
        updates.status = 'waiting'
        updates.is_top5 = false
        updates.due_date = null // Waiting으로 가면 날짜/중요도 해제
        updates.start_time = null // 일정 배정 해제
        updates.duration = null
      }

      if (Object.keys(updates).length > 0) {
        await updateTask(realActiveId, updates)
      }
      return
    }

    // 아이템 간 재정렬 (같은 컨테이너 내)
    if (activeId !== overId) {
      // 다른 컨테이너의 아이템 위로 드롭된 경우
      const activeTask = tasks.find(t => t.id === realActiveId)
      const overTask = tasks.find(t => t.id === realOverId)

      if (activeTask && overTask) {
        // 드롭된 위치의 컨테이너 확인
        const isOverInboxList = overId.endsWith('-inbox')
        const isOverWaitingList = overId.endsWith('-waiting')
        const isOverFocusList = focusTasks.some(t => t.id === realOverId) && !isOverInboxList && !isOverWaitingList
        const isOverTodayList = todayTasks.some(t => t.id === realOverId) && !isOverInboxList && !isOverWaitingList

        // 속성 업데이트 로직
        const updates: Partial<Task> = {}
        let shouldUpdate = false

        if (isOverFocusList) {
          if (!activeTask.is_top5 || activeTask.status === 'waiting') {
            updates.is_top5 = true
            if (activeTask.status === 'waiting') updates.status = 'inbox'
            shouldUpdate = true
          }
        } else if (isOverTodayList) {
          if (activeTask.is_top5 || activeTask.due_date?.split('T')[0] !== todayStr || activeTask.status === 'waiting') {
            updates.is_top5 = false
            updates.due_date = todayStr
            if (activeTask.status === 'waiting') updates.status = 'inbox'
            shouldUpdate = true
          }
        } else if (isOverWaitingList) {
          if (activeTask.status !== 'waiting') {
            updates.status = 'waiting'
            updates.is_top5 = false
            updates.due_date = null
            updates.start_time = null
            updates.duration = null
            shouldUpdate = true
          }
        } else if (isOverInboxList) {
          // Inbox 리스트 내에서의 이동
          // Waiting에서 왔다면 Inbox로 변경
          if (activeTask.status === 'waiting') {
            updates.status = 'inbox'
            updates.is_top5 = false
            updates.due_date = undefined
            shouldUpdate = true
          } else if (!activeId.endsWith('-inbox')) {
            // Focus/Today에서 Inbox로 드래그 -> 속성 해제
            updates.is_top5 = false
            updates.due_date = undefined
            shouldUpdate = true
          }
        }

        if (shouldUpdate) {
          await updateTask(realActiveId, updates)
        } else {
          // 같은 컨테이너 내 재정렬
          reorderTasks(realActiveId, realOverId)
        }
      }
    }
  }

  // Droppable Container Component
  function DroppableContainer({ id, title, count, children, className }: { id: string, title: string, count?: number, children: React.ReactNode, className?: string }) {
    const { setNodeRef, isOver } = useDroppable({ id })

    return (
      <div ref={setNodeRef} className={`flex-1 flex flex-col ${className} ${isOver ? 'bg-blue-50/50' : ''}`}>
        <h2 className={`text-sm mb-3 px-4 pt-4 ${title === "Today's Focus" ? 'text-red-600 font-extrabold' : 'font-semibold text-gray-900'}`}>
          {title} {count !== undefined && <span className="text-gray-400 font-normal">({count})</span>}
        </h2>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {children}
        </div>
      </div>
    )
  }

  // Completed tasks filtering (remains the same)
  const completedTasks = tasks.filter(t => t.status === 'completed' && !t.is_auto_generated)
  const recentCompletedTasks = completedTasks.slice(0, 10)
  const hasMoreCompleted = completedTasks.length > 10

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200 relative">
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
          toggleTaskStatus={toggleTaskStatus}
          onNavigateToTask={(task) => {
            setSelectedTask(task)
            setPopoverPosition(undefined)
          }}
        />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        {/* Top: Today's Focus */}
        <div className="border-b border-gray-200">
          <DroppableContainer id="focus-container" title="Today's Focus">
            <SortableContext items={focusTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5">
                {focusTasks.length === 0 && (
                  <div className="text-xs text-gray-400 text-center py-2">
                    별표(★)를 눌러 중요한 태스크를 추가하세요
                  </div>
                )}
                {focusTasks.map((task) => (
                  <SortableTaskItem
                    key={task.id}
                    task={task}
                    onClick={(e) => handleTaskClick(e, task)}
                    onToggleComplete={() => handleToggleComplete(task)}
                    isCompleting={completingIds.has(task.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DroppableContainer>
        </div>

        {/* Middle: Today's Task */}
        <div className="border-b border-gray-200 flex-shrink-0 max-h-[30%] flex flex-col">
          <DroppableContainer id="today-container" title="Today's Task">
            <SortableContext items={todayTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5">
                {todayTasks.length === 0 && (
                  <div className="text-xs text-gray-400 text-center py-2">
                    오늘 할 일을 이곳으로 드래그하세요
                  </div>
                )}
                {todayTasks.map((task) => (
                  <SortableTaskItem
                    key={task.id}
                    task={task}
                    onClick={(e) => handleTaskClick(e, task)}
                    onToggleComplete={() => handleToggleComplete(task)}
                    isCompleting={completingIds.has(task.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DroppableContainer>
        </div>

        {/* Bottom: Inbox (Master List) */}
        <div className="flex-1 flex flex-col min-h-0">
          <DroppableContainer
            id="inbox-container"
            title={selectedProjectId ? projects.find(p => p.id === selectedProjectId)?.name || 'INBOX' : 'INBOX'}
            className="h-full"
          >
            <SortableContext items={inboxTasks.map(t => `${t.id}-inbox`)} strategy={verticalListSortingStrategy}>
              <div className="space-y-0">
                {inboxTasks.map((task) => (
                  <SortableTaskItem
                    key={`${task.id}-inbox`}
                    id={`${task.id}-inbox`}
                    task={task}
                    onClick={(e) => handleTaskClick(e, task)}
                    onToggleComplete={() => handleToggleComplete(task)}
                    isInbox={true}
                    isCompleting={completingIds.has(task.id)}
                  />
                ))}
              </div>
            </SortableContext>

            {/* Waiting Section */}
            <div className="mt-8 border-t border-gray-100 pt-4">
              <DroppableContainer id="waiting-container" title="Waiting" count={waitingTasks.length} className="min-h-[100px]">
                <SortableContext items={waitingTasks.map(t => `${t.id}-waiting`)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-0">
                    {waitingTasks.length === 0 && (
                      <div className="text-xs text-gray-400 text-center py-2">
                        나중에 할 일을 이곳으로 보관하세요
                      </div>
                    )}
                    {waitingTasks.map((task) => (
                      <SortableTaskItem
                        key={`${task.id}-waiting`}
                        id={`${task.id}-waiting`}
                        task={task}
                        onClick={(e) => handleTaskClick(e, task)}
                        onToggleComplete={() => handleToggleComplete(task)}
                        isInbox={true}
                        isCompleting={completingIds.has(task.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DroppableContainer>
            </div>

            {/* Completed Tasks Section */}
            {completedTasks.length > 0 && (
              <div className="mt-8 border-t border-gray-100 pt-4">
                {/* ... Completed tasks UI ... */}
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
                    className="flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {isCompletedExpanded ? (
                      <ChevronDown size={16} className="flex-shrink-0" />
                    ) : (
                      <ChevronRight size={16} className="flex-shrink-0" />
                    )}
                    <span>Completed ({completedTasks.length})</span>
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
                      {recentCompletedTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-2 p-1 text-xs text-gray-400 bg-white border-b border-gray-100 line-through"
                        >
                          <div className="flex-shrink-0 w-3 h-3 flex items-center justify-center">
                            <Check size={10} className="text-blue-400" />
                          </div>
                          <span className="flex-1 truncate">{task.title}</span>
                          <button
                            onClick={() => handleToggleComplete(task)}
                            className="text-xs text-blue-400 hover:underline px-1"
                          >
                            복구
                          </button>
                        </div>
                      ))}
                    </div>
                    {/* More 버튼 */}
                    {hasMoreCompleted && (
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
          </DroppableContainer>
        </div>
      </DndContext>

      {/* Bottom: Quick Capture Input (Sticky) */}
      <div className="p-4 border-t border-gray-200 bg-white">
        {/* 빠른 입력 버튼 */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => {
              if (newTaskTitle.startsWith('*')) {
                setNewTaskTitle(newTaskTitle.substring(1).trim())
              } else {
                setNewTaskTitle('*' + newTaskTitle.replace(/^\/\s*/, ''))
              }
            }}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors border ${
              newTaskTitle.startsWith('*')
                ? 'text-white bg-red-500 border-red-600'
                : 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100 active:bg-red-200'
            }`}
          >
            ⭐ Focus
          </button>
          <button
            onClick={() => {
              if (newTaskTitle.startsWith('/')) {
                setNewTaskTitle(newTaskTitle.substring(1).trim())
              } else {
                setNewTaskTitle('/' + newTaskTitle.replace(/^\*\s*/, ''))
              }
            }}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors border ${
              newTaskTitle.startsWith('/')
                ? 'text-white bg-green-500 border-green-600'
                : 'text-green-600 bg-green-50 border-green-200 hover:bg-green-100 active:bg-green-200'
            }`}
          >
            📅 Today
          </button>
        </div>
        
        <textarea
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="빠른 입력... (Enter로 추가)"
          className="w-full p-3 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent"
          rows={2}
        />
      </div>

      {/* Project Create Modal */}
      {showProjectModal && (
        <ProjectCreateModal
          onClose={() => setShowProjectModal(false)}
          onCreateProject={handleCreateProject}
        />
      )}

      {/* All Completed Tasks Modal */}
      {showAllCompletedModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowAllCompletedModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-2xl w-[600px] max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                All Completed Tasks ({completedTasks.length})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (confirm(`완료된 할일 ${completedTasks.length}개를 모두 삭제하시겠습니까?`)) {
                      for (const task of completedTasks) {
                        await deleteTask(task.id)
                      }
                      setShowAllCompletedModal(false)
                    }
                  }}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  title="완료된 할일 비우기"
                >
                  <Trash2 size={18} />
                </button>
                <button
                  onClick={() => setShowAllCompletedModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* 모달 내용 (스크롤 가능) */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-0.5">
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 p-1 text-xs text-gray-400 bg-white border-b border-gray-100 line-through"
                  >
                    <div className="flex-shrink-0 w-3 h-3 flex items-center justify-center">
                      <Check size={10} className="text-blue-400" />
                    </div>
                    <span className="flex-1 truncate">{task.title}</span>
                    <button
                      onClick={() => {
                        handleToggleComplete(task)
                        // 복구 후 모달이 비어있으면 자동으로 닫기
                        if (completedTasks.length === 1) {
                          setShowAllCompletedModal(false)
                        }
                      }}
                      className="text-xs text-blue-500 hover:underline px-1 transition-colors"
                    >
                      복구
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
