'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { Check, ChevronDown, ChevronRight, X, Trash2, Plus, FileText } from 'lucide-react'
import type { Task, Project } from '@/types/database'
import TaskDetailPopover from '../TaskDetailPopover'
import ProjectCreateModal from '../ProjectCreateModal'
import RoutineSection from '../RoutineSection'
import { extractTags, splitTitleAndDescription } from '@/utils/textParser'
import { useNotionLinks } from '@/hooks/useNotionLinks'

// 분리된 컴포넌트들
import SortableTaskItem from './SortableTaskItem'
import SortableNotionLink from './SortableNotionLink'
import DroppableContainer from './DroppableContainer'
import { LeftPanelProps, PanelTab } from './types'

export default function LeftPanel({ 
  tasks, 
  createTask, 
  updateTask, 
  deleteTask, 
  reorderTasks, 
  toggleTaskStatus, 
  projects, 
  createProject, 
  updateProject, 
  deleteProject 
}: LeftPanelProps) {
  // ===== State =====
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [popoverPosition, setPopoverPosition] = useState<{ x: number, y: number } | undefined>(undefined)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false)
  const [showAllCompletedModal, setShowAllCompletedModal] = useState(false)
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set())
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<PanelTab>('main')
  const inboxScrollRef = useRef<HTMLDivElement>(null)
  const savedScrollPositionRef = useRef<number>(0)
  const shouldRestoreScrollRef = useRef<boolean>(false)

  // Notion Links 상태
  const { links: notionLinks, createLink, updateLink, deleteLink, reorderLinks } = useNotionLinks()
  const [showNotionLinkModal, setShowNotionLinkModal] = useState(false)
  const [newLinkTitle, setNewLinkTitle] = useState('')
  const [newLinkUrl, setNewLinkUrl] = useState('')

  // ===== Sensors =====
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // ===== Effects =====
  useEffect(() => {
    if (shouldRestoreScrollRef.current && inboxScrollRef.current) {
      const scrollPos = savedScrollPositionRef.current
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (inboxScrollRef.current) {
              inboxScrollRef.current.scrollTop = scrollPos
              shouldRestoreScrollRef.current = false
            }
          })
        })
      })
    }
  })

  // ===== Constants =====
  const todayStr = new Date().toISOString().split('T')[0]

  // ===== Task Filters =====
  const focusTasks = tasks.filter(t => 
    t.is_top5 && t.status !== 'completed' && t.status !== 'waiting' && 
    !t.is_auto_generated && !t.is_makeup && !t.parent_id && t.type !== 'note'
  )

  const todayTasks = tasks.filter(t => 
    !t.is_top5 && t.due_date?.split('T')[0] === todayStr && 
    t.status !== 'completed' && t.status !== 'waiting' && 
    !t.is_auto_generated && !t.is_makeup && !t.parent_id && t.type !== 'note'
  )

  const waitingTasks = tasks.filter(t => 
    t.status === 'waiting' && !t.is_auto_generated && !t.is_makeup && !t.parent_id && t.type !== 'note'
  )

  const inboxTasks = useMemo(() => {
    let filtered = tasks.filter(t => 
      t.status !== 'completed' && 
      t.status !== 'waiting' && 
      !t.is_auto_generated && 
      !t.is_makeup &&
      !t.is_top5 &&
      t.due_date?.split('T')[0] !== todayStr &&
      !t.parent_id &&
      t.type !== 'note'
    )

    if (selectedProjectId) {
      filtered = filtered.filter(t => t.project_id === selectedProjectId)
    }

    return filtered.sort((a, b) => {
      const isYellowA = a.status === 'scheduled'
      const isYellowB = b.status === 'scheduled'
      if (isYellowA && !isYellowB) return -1
      if (!isYellowA && isYellowB) return 1
      return (a.order_index || 0) - (b.order_index || 0)
    })
  }, [tasks, selectedProjectId, todayStr])

  const completedTasks = tasks.filter(t => 
    t.status === 'completed' && !t.is_auto_generated && t.type !== 'note'
  )

  const noteTasks = tasks.filter(t => t.type === 'note' && !t.is_auto_generated)
  const activeNotes = noteTasks.filter(t => t.status !== 'completed')
  const completedNotes = noteTasks.filter(t => t.status === 'completed')

  // ===== Helper Functions =====
  const getSubtasks = (parentId: string) => {
    return tasks
      .filter(t => t.parent_id === parentId)
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
  }

  // ===== Handlers =====
  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

      const { title: splitTitle, description } = splitTitleAndDescription(title)
      const { cleanTitle, tags } = extractTags(splitTitle)

      try {
        const newTask = await createTask({
          title: cleanTitle,
          description: description,
          status: 'inbox',
          is_top5: isTop5,
          due_date: dueDate,
          tags: tags.length > 0 ? tags : undefined,
          type: 'note'
        })
        
        setNewTaskTitle('')
        
        if (newTask) {
          setSelectedTask(newTask)
          setPopoverPosition({ x: window.innerWidth / 2 - 450, y: 100 })
        }
      } catch (err) {
        console.error('노트 생성 에러:', err)
      }
      return
    }

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

  const handleTaskClick = (e: React.MouseEvent, task: Task) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setPopoverPosition({ x: rect.right + 10, y: rect.top })
    setSelectedTask(task)
  }

  const handleCreateNotionLink = async () => {
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) {
      alert('제목과 링크를 모두 입력해주세요.')
      return
    }

    await createLink({
      title: newLinkTitle,
      url: newLinkUrl,
      order_index: notionLinks.length
    })

    setNewLinkTitle('')
    setNewLinkUrl('')
    setShowNotionLinkModal(false)
  }

  const handleDeleteNotionLink = async (id: string) => {
    if (confirm('이 프로젝트 링크를 삭제하시겠습니까?')) {
      await deleteLink(id)
    }
  }

  const handleToggleComplete = (task: Task) => {
    savedScrollPositionRef.current = inboxScrollRef.current?.scrollTop || 0
    shouldRestoreScrollRef.current = true
    
    if (task.status !== 'completed') {
      setCompletingIds(prev => new Set(prev).add(task.id))
      
      setTimeout(() => {
        savedScrollPositionRef.current = inboxScrollRef.current?.scrollTop || 0
        shouldRestoreScrollRef.current = true
        
        toggleTaskStatus(task.id, task.status)
        setCompletingIds(prev => {
          const next = new Set(prev)
          next.delete(task.id)
          return next
        })
      }, 150)
    } else {
      toggleTaskStatus(task.id, task.status)
    }
  }

  const handleCreateProject = async (project: Partial<Project>) => {
    const newProject = await createProject(project)
    return newProject
  }

  const handleConvertType = async (task: Task, newType: 'task' | 'note') => {
    await updateTask(task.id, { type: newType })
  }

  const handleToggleExpand = (taskId: string) => {
    setExpandedTaskIds(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  const handleChecklistToggle = async (task: Task, lineIndex: number, newCompleted: boolean) => {
    if (!task.description) return
    
    const lines = task.description.split('\n')
    const line = lines[lineIndex]
    
    if (!line) return
    
    if (newCompleted && line.trim().startsWith('[] ')) {
      lines[lineIndex] = line.replace('[] ', '[x] ')
    } else if (!newCompleted && (line.trim().startsWith('[x] ') || line.trim().startsWith('[X] '))) {
      lines[lineIndex] = line.replace(/\[[xX]\] /, '[] ')
    }
    
    const newDescription = lines.join('\n')
    await updateTask(task.id, { description: newDescription })
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Notion Link 드래그 처리
    if (activeId.startsWith('notion-link-') && overId.startsWith('notion-link-')) {
      const realActiveId = activeId.replace('notion-link-', '')
      const realOverId = overId.replace('notion-link-', '')
      if (realActiveId !== realOverId) {
        await reorderLinks(realActiveId, realOverId)
      }
      return
    }

    const realActiveId = activeId.replace(/-inbox$/, '').replace(/-waiting$/, '').replace(/-note$/, '')
    const realOverId = overId.replace(/-inbox$/, '').replace(/-waiting$/, '').replace(/-note$/, '')

    // 컨테이너로 드롭된 경우
    if (['focus-container', 'today-container', 'inbox-container', 'waiting-container'].includes(overId)) {
      const task = tasks.find(t => t.id === realActiveId)
      if (!task) return

      const updates: Partial<Task> = {}

      if (overId === 'focus-container') {
        updates.is_top5 = true
        updates.status = task.status === 'waiting' ? 'inbox' : task.status
      } else if (overId === 'today-container') {
        updates.is_top5 = false
        updates.due_date = todayStr
        updates.status = task.status === 'waiting' ? 'inbox' : task.status
      } else if (overId === 'inbox-container') {
        updates.is_top5 = false
        updates.due_date = undefined
        updates.status = 'inbox'
      } else if (overId === 'waiting-container') {
        updates.status = 'waiting'
        updates.is_top5 = false
        updates.due_date = null
        updates.start_time = null
        updates.duration = null
      }

      if (Object.keys(updates).length > 0) {
        await updateTask(realActiveId, updates)
      }
      return
    }

    // 아이템 간 재정렬
    if (activeId !== overId) {
      const activeTask = tasks.find(t => t.id === realActiveId)
      const overTask = tasks.find(t => t.id === realOverId)

      if (activeTask && overTask) {
        const isOverInboxList = overId.endsWith('-inbox')
        const isOverWaitingList = overId.endsWith('-waiting')
        const isOverFocusList = focusTasks.some(t => t.id === realOverId) && !isOverInboxList && !isOverWaitingList
        const isOverTodayList = todayTasks.some(t => t.id === realOverId) && !isOverInboxList && !isOverWaitingList

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
          if (activeTask.status === 'waiting') {
            updates.status = 'inbox'
            updates.is_top5 = false
            updates.due_date = undefined
            shouldUpdate = true
          } else if (!activeId.endsWith('-inbox')) {
            updates.is_top5 = false
            updates.due_date = undefined
            shouldUpdate = true
          }
        }

        if (shouldUpdate) {
          await updateTask(realActiveId, updates)
        } else {
          reorderTasks(realActiveId, realOverId)
        }
      }
    }
  }

  // ===== Render =====
  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200 relative">
      {/* Task Detail Popover */}
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

      {/* Tab Header */}
      <div className="flex border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <button
          onClick={() => setActiveTab('main')}
          className={`flex-1 py-2.5 px-3 text-sm font-medium transition-colors relative
            ${activeTab === 'main' ? 'text-gray-900 bg-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
        >
          🏠 Main
          {activeTab === 'main' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />}
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex-1 py-2.5 px-3 text-sm font-medium transition-colors relative
            ${activeTab === 'tasks' ? 'text-blue-600 bg-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
        >
          📋 Tasks
          <span className="ml-1 text-xs text-gray-400">({inboxTasks.length + waitingTasks.length})</span>
          {activeTab === 'tasks' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`flex-1 py-2.5 px-3 text-sm font-medium transition-colors relative
            ${activeTab === 'notes' ? 'text-amber-600 bg-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
        >
          📝 Notes
          <span className="ml-1 text-xs text-gray-400">({noteTasks.length})</span>
          {activeTab === 'notes' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600" />}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {/* ===== Main Tab ===== */}
        {activeTab === 'main' && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <RoutineSection />
            
            {/* Today's Focus */}
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
                        subtasks={getSubtasks(task.id)}
                        onSubtaskToggle={(subtask) => toggleTaskStatus(subtask.id, subtask.status)}
                        onChecklistToggle={handleChecklistToggle}
                        isExpanded={expandedTaskIds.has(task.id)}
                        onToggleExpand={handleToggleExpand}
                        onConvertType={handleConvertType}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DroppableContainer>
            </div>

            {/* Today's Task */}
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
                        subtasks={getSubtasks(task.id)}
                        onSubtaskToggle={(subtask) => toggleTaskStatus(subtask.id, subtask.status)}
                        onChecklistToggle={handleChecklistToggle}
                        isExpanded={expandedTaskIds.has(task.id)}
                        onToggleExpand={handleToggleExpand}
                        onConvertType={handleConvertType}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DroppableContainer>
            </div>

            {/* PROJECT */}
            <div className="border-b border-gray-200 flex-shrink-0">
              <h2 className="text-sm mb-2 px-4 pt-4 font-semibold text-gray-900 flex items-center justify-between">
                PROJECT
                <button
                  onClick={() => setShowNotionLinkModal(true)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="프로젝트 링크 추가"
                >
                  <Plus size={16} />
                </button>
              </h2>
              
              <div className="px-4 pb-3">
                <SortableContext items={notionLinks.map(l => `notion-link-${l.id}`)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1">
                    {notionLinks.length === 0 && (
                      <div className="text-xs text-gray-400 text-center py-2">
                        + 버튼을 눌러 프로젝트를 추가하세요
                      </div>
                    )}
                    {notionLinks.map((link) => (
                      <SortableNotionLink
                        key={link.id}
                        link={link}
                        onUpdate={updateLink}
                        onDelete={handleDeleteNotionLink}
                      />
                    ))}
                  </div>
                </SortableContext>
              </div>
            </div>
          </DndContext>
        )}

        {/* ===== Tasks Tab ===== */}
        {activeTab === 'tasks' && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="p-4" ref={inboxScrollRef}>
              {/* INBOX */}
              <DroppableContainer
                id="inbox-container"
                title={selectedProjectId ? projects.find(p => p.id === selectedProjectId)?.name || 'INBOX' : 'INBOX'}
                className=""
              >
                <SortableContext items={inboxTasks.map(t => `${t.id}-inbox`)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-0">
                    {inboxTasks.length === 0 && (
                      <div className="text-xs text-gray-400 text-center py-4">할 일이 없습니다</div>
                    )}
                    {inboxTasks.map((task) => (
                      <SortableTaskItem
                        key={`${task.id}-inbox`}
                        id={`${task.id}-inbox`}
                        task={task}
                        onClick={(e) => handleTaskClick(e, task)}
                        onToggleComplete={() => handleToggleComplete(task)}
                        isInbox={true}
                        isCompleting={completingIds.has(task.id)}
                        subtasks={getSubtasks(task.id)}
                        onSubtaskToggle={(subtask) => toggleTaskStatus(subtask.id, subtask.status)}
                        onChecklistToggle={handleChecklistToggle}
                        isExpanded={expandedTaskIds.has(task.id)}
                        onToggleExpand={handleToggleExpand}
                        onConvertType={handleConvertType}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DroppableContainer>

              {/* Waiting */}
              <div className="mt-6 border-t border-gray-100 pt-4">
                <DroppableContainer id="waiting-container" title="Waiting" count={waitingTasks.length} className="min-h-[60px]">
                  <SortableContext items={waitingTasks.map(t => `${t.id}-waiting`)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-0">
                      {waitingTasks.length === 0 && (
                        <div className="text-xs text-gray-400 text-center py-2">나중에 할 일을 이곳으로 보관하세요</div>
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
                          subtasks={getSubtasks(task.id)}
                          onSubtaskToggle={(subtask) => toggleTaskStatus(subtask.id, subtask.status)}
                          onChecklistToggle={handleChecklistToggle}
                          isExpanded={expandedTaskIds.has(task.id)}
                          onToggleExpand={handleToggleExpand}
                          onConvertType={handleConvertType}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DroppableContainer>
              </div>

              {/* Done */}
              {completedTasks.length > 0 && (
                <div className="mt-6 border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <button
                      onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
                      className="flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {isCompletedExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <span>Done ({completedTasks.length})</span>
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
                        {completedTasks.slice(0, 10).map((task) => (
                          <div key={task.id} className="flex items-center gap-2 p-1 text-xs text-gray-400 bg-white border-b border-gray-100 line-through">
                            <div className="flex-shrink-0 w-3 h-3 flex items-center justify-center">
                              <Check size={10} className="text-blue-400" />
                            </div>
                            <span className="flex-1 truncate">{task.title}</span>
                            <button onClick={() => handleToggleComplete(task)} className="text-xs text-blue-400 hover:underline px-1">복구</button>
                          </div>
                        ))}
                      </div>
                      {completedTasks.length > 10 && (
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
            </div>
          </DndContext>
        )}

        {/* ===== Notes Tab ===== */}
        {activeTab === 'notes' && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
                        {activeNotes.map((task) => (
                          <SortableTaskItem
                            key={`${task.id}-note`}
                            id={`${task.id}-note`}
                            task={task}
                            onClick={(e) => handleTaskClick(e, task)}
                            onToggleComplete={() => handleToggleComplete(task)}
                            isInbox={true}
                            isCompleting={completingIds.has(task.id)}
                            subtasks={getSubtasks(task.id)}
                            onSubtaskToggle={(subtask) => toggleTaskStatus(subtask.id, subtask.status)}
                            onChecklistToggle={handleChecklistToggle}
                            isExpanded={expandedTaskIds.has(task.id)}
                            onToggleExpand={handleToggleExpand}
                            onConvertType={handleConvertType}
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
                            onClick={(e) => handleTaskClick(e, task)}
                            className="flex items-center gap-2 p-1.5 text-xs text-gray-400 bg-amber-50/30 border-b border-amber-100 cursor-pointer hover:bg-amber-50 rounded"
                          >
                            <div className="flex-shrink-0 w-3 h-3 flex items-center justify-center">
                              <FileText size={10} className="text-amber-400" />
                            </div>
                            <span className="flex-1 truncate line-through">{task.title}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleToggleComplete(task) }}
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
          </DndContext>
        )}
      </div>

      {/* Quick Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <textarea
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="빠른 입력... (Enter: 테스크 | Shift+Enter: 노트)"
          className="w-full p-3 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent"
          rows={2}
        />
      </div>

      {/* Modals */}
      {showProjectModal && (
        <ProjectCreateModal
          onClose={() => setShowProjectModal(false)}
          onCreateProject={handleCreateProject}
        />
      )}

      {showAllCompletedModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAllCompletedModal(false)}>
          <div className="bg-white rounded-lg shadow-2xl w-[600px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">All Completed Tasks ({completedTasks.length})</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (confirm(`완료된 할일 ${completedTasks.length}개를 모두 삭제하시겠습니까?`)) {
                      for (const task of completedTasks) { await deleteTask(task.id) }
                      setShowAllCompletedModal(false)
                    }
                  }}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 size={18} />
                </button>
                <button onClick={() => setShowAllCompletedModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-0.5">
                {completedTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 p-1 text-xs text-gray-400 bg-white border-b border-gray-100 line-through">
                    <div className="flex-shrink-0 w-3 h-3 flex items-center justify-center">
                      <Check size={10} className="text-blue-400" />
                    </div>
                    <span className="flex-1 truncate">{task.title}</span>
                    <button
                      onClick={() => {
                        handleToggleComplete(task)
                        if (completedTasks.length === 1) setShowAllCompletedModal(false)
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

      {showNotionLinkModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowNotionLinkModal(false)}>
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">프로젝트 링크 추가</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                <input
                  type="text"
                  value={newLinkTitle}
                  onChange={e => setNewLinkTitle(e.target.value)}
                  placeholder="논문 작성"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && newLinkTitle.trim() && newLinkUrl.trim()) handleCreateNotionLink() }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">링크</label>
                <input
                  type="url"
                  value={newLinkUrl}
                  onChange={e => setNewLinkUrl(e.target.value)}
                  placeholder="https://notion.so/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => { if (e.key === 'Enter' && newLinkTitle.trim() && newLinkUrl.trim()) handleCreateNotionLink() }}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setShowNotionLinkModal(false); setNewLinkTitle(''); setNewLinkUrl('') }}
                className="flex-1 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button onClick={handleCreateNotionLink} className="flex-1 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

