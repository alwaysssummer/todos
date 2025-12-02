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
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Check, X, Trash2 } from 'lucide-react'
import type { Task, Project } from '@/types/database'
import TaskDetailPopover from '../DetailPopover'
import ProjectCreateModal from '../ProjectCreateModal'
import { extractTags, splitTitleAndDescription, extractAllTags } from '@/utils/textParser'
import { useNotionLinks } from '@/hooks/useNotionLinks'

// 분리된 컴포넌트들
import MainTab from './MainTab'
import TasksTab from './TasksTab'
import NotesTab from './NotesTab'
import TagsTab from './TagsTab'
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
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // ===== Effects =====
  
  // selectedTask를 tasks 배열과 동기화 (updateTask 후 UI 반영)
  useEffect(() => {
    if (selectedTask) {
      const updatedTask = tasks.find(t => t.id === selectedTask.id)
      if (updatedTask && updatedTask.updated_at !== selectedTask.updated_at) {
        setSelectedTask(updatedTask)
      }
    }
  }, [tasks, selectedTask])

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
  // THE FOCUS: 장기 집중 관리 태스크
  const theFocusTasks = tasks.filter(t => 
    t.is_the_focus && t.status !== 'completed' && t.status !== 'waiting' && 
    !t.is_auto_generated && !t.is_makeup && !t.parent_id && t.type !== 'note'
  )

  const focusTasks = tasks.filter(t => 
    t.is_top5 && !t.is_the_focus && t.status !== 'completed' && t.status !== 'waiting' && 
    !t.is_auto_generated && !t.is_makeup && !t.parent_id && t.type !== 'note'
  )

  // Today's Task: due_date가 오늘 또는 과거인 태스크 (자정이 지나도 유지됨)
  const todayTasks = tasks.filter(t => 
    !t.is_top5 && !t.is_the_focus && t.due_date && t.due_date.split('T')[0] <= todayStr && 
    t.status !== 'completed' && t.status !== 'waiting' && 
    !t.is_auto_generated && !t.is_makeup && !t.parent_id && t.type !== 'note'
  )

  const waitingTasks = tasks.filter(t => 
    t.status === 'waiting' && !t.is_the_focus && !t.is_auto_generated && !t.is_makeup && !t.parent_id && t.type !== 'note'
  )

  // Inbox: due_date가 없는 태스크
  const inboxTasks = useMemo(() => {
    let filtered = tasks.filter(t => 
      t.status !== 'completed' && t.status !== 'waiting' && 
      !t.is_auto_generated && !t.is_makeup && !t.is_top5 && !t.is_the_focus &&
      !t.due_date && !t.parent_id && t.type !== 'note'
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

  const noteTasks = tasks.filter(t => t.type === 'note' && !t.is_auto_generated && !t.is_archived)
  const activeNotes = noteTasks.filter(t => t.status !== 'completed')
  const completedNotes = noteTasks.filter(t => t.status === 'completed')
  const archivedNotes = tasks.filter(t => t.type === 'note' && !t.is_auto_generated && t.is_archived)

  // 태그 개수 계산
  const tagCount = useMemo(() => {
    const uniqueTags = new Set<string>()
    tasks.forEach(task => {
      if (!task.is_auto_generated) {
        task.tags?.forEach(tag => uniqueTags.add(tag))
      }
    })
    return uniqueTags.size
  }, [tasks])

  // 최근 생성된 태스크/노트 5개 (완료되지 않은 것, Focus/Today's Task/THE FOCUS 제외)
  const recentTasks = useMemo(() => {
    return [...tasks]
      .filter(t => 
        t.status !== 'completed' && 
        !t.is_auto_generated && 
        !t.is_makeup && 
        !t.parent_id &&
        !t.is_top5 &&       // Today's Focus 제외
        !t.is_the_focus &&  // THE FOCUS 제외
        !t.due_date         // Today's Task 제외
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
  }, [tasks])

  // ===== Helper Functions =====
  const getSubtasks = (parentId: string) => {
    return tasks.filter(t => t.parent_id === parentId).sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
  }

  // ===== Handlers =====
  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault()
      if (!newTaskTitle.trim()) return
      let title = newTaskTitle.trim()
      let isTop5 = false
      let dueDate: string | undefined = undefined
      if (title.startsWith('*')) { isTop5 = true; title = title.substring(1).trim() }
      else if (title.startsWith('/')) { dueDate = new Date().toISOString(); title = title.substring(1).trim() }
      const { title: splitTitle, description } = splitTitleAndDescription(title)
      const { cleanTitle } = extractTags(splitTitle)
      // 제목 + 메모 모두에서 태그 추출
      const allTags = extractAllTags(splitTitle, description)
      try {
        const newTask = await createTask({ title: cleanTitle, description, status: 'inbox', is_top5: isTop5, due_date: dueDate, tags: allTags.length > 0 ? allTags : undefined, type: 'note' })
        setNewTaskTitle('')
        if (newTask) { setSelectedTask(newTask); setPopoverPosition({ x: window.innerWidth / 2 - 450, y: 100 }) }
      } catch (err) { console.error('노트 생성 에러:', err) }
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!newTaskTitle.trim()) return
      let title = newTaskTitle.trim()
      let isTop5 = false
      let dueDate: string | undefined = undefined
      if (title.startsWith('*')) { isTop5 = true; title = title.substring(1).trim() }
      else if (title.startsWith('/')) { dueDate = new Date().toISOString(); title = title.substring(1).trim() }
      const { title: splitTitle, description } = splitTitleAndDescription(title)
      const { cleanTitle } = extractTags(splitTitle)
      // 제목 + 메모 모두에서 태그 추출
      const allTags = extractAllTags(splitTitle, description)
      await createTask({ title: cleanTitle, description, status: 'inbox', is_top5: isTop5, due_date: dueDate, tags: allTags.length > 0 ? allTags : undefined })
      setNewTaskTitle('')
    }
  }

  const handleTaskClick = (e: React.MouseEvent, task: Task) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setPopoverPosition({ x: rect.right + 10, y: rect.top })
    setSelectedTask(task)
  }

  const handleCreateNotionLink = async () => {
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) { alert('제목과 링크를 모두 입력해주세요.'); return }
    await createLink({ title: newLinkTitle, url: newLinkUrl, order_index: notionLinks.length })
    setNewLinkTitle(''); setNewLinkUrl(''); setShowNotionLinkModal(false)
  }

  const handleDeleteNotionLink = async (id: string) => {
    if (confirm('이 프로젝트 링크를 삭제하시겠습니까?')) { await deleteLink(id) }
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
        setCompletingIds(prev => { const next = new Set(prev); next.delete(task.id); return next })
      }, 150)
    } else {
      toggleTaskStatus(task.id, task.status)
    }
  }

  const handleCreateProject = async (project: Partial<Project>) => await createProject(project)
  const handleConvertType = async (task: Task, newType: 'task' | 'note') => await updateTask(task.id, { type: newType })
  const handleToggleExpand = (taskId: string) => {
    setExpandedTaskIds(prev => { const next = new Set(prev); next.has(taskId) ? next.delete(taskId) : next.add(taskId); return next })
  }
  const handleChecklistToggle = async (task: Task, lineIndex: number, newCompleted: boolean) => {
    if (!task.description) return
    const lines = task.description.split('\n')
    const line = lines[lineIndex]
    if (!line) return
    if (newCompleted && line.trim().startsWith('[] ')) lines[lineIndex] = line.replace('[] ', '[x] ')
    else if (!newCompleted && (line.trim().startsWith('[x] ') || line.trim().startsWith('[X] '))) lines[lineIndex] = line.replace(/\[[xX]\] /, '[] ')
    await updateTask(task.id, { description: lines.join('\n') })
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = active.id as string
    const overId = over.id as string

    if (activeId.startsWith('notion-link-') && overId.startsWith('notion-link-')) {
      const realActiveId = activeId.replace('notion-link-', '')
      const realOverId = overId.replace('notion-link-', '')
      if (realActiveId !== realOverId) await reorderLinks(realActiveId, realOverId)
      return
    }

    const realActiveId = activeId.replace(/-inbox$/, '').replace(/-waiting$/, '').replace(/-note$/, '')
    const realOverId = overId.replace(/-inbox$/, '').replace(/-waiting$/, '').replace(/-note$/, '')

    if (['the-focus-container', 'focus-container', 'today-container', 'inbox-container', 'waiting-container'].includes(overId)) {
      const task = tasks.find(t => t.id === realActiveId)
      if (!task) return
      const updates: Partial<Task> = {}
      if (overId === 'the-focus-container') { updates.is_the_focus = true; updates.is_top5 = false; updates.due_date = undefined; updates.status = task.status === 'waiting' ? 'inbox' : task.status }
      else if (overId === 'focus-container') { updates.is_top5 = true; updates.is_the_focus = false; updates.status = task.status === 'waiting' ? 'inbox' : task.status }
      else if (overId === 'today-container') { updates.is_top5 = false; updates.is_the_focus = false; updates.due_date = todayStr; updates.status = task.status === 'waiting' ? 'inbox' : task.status }
      else if (overId === 'inbox-container') { updates.is_top5 = false; updates.is_the_focus = false; updates.due_date = undefined; updates.status = 'inbox' }
      else if (overId === 'waiting-container') { updates.status = 'waiting'; updates.is_top5 = false; updates.is_the_focus = false; updates.due_date = null; updates.start_time = null; updates.duration = null }
      if (Object.keys(updates).length > 0) await updateTask(realActiveId, updates)
      return
    }

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
        if (isOverFocusList && (!activeTask.is_top5 || activeTask.status === 'waiting')) { updates.is_top5 = true; if (activeTask.status === 'waiting') updates.status = 'inbox'; shouldUpdate = true }
        else if (isOverTodayList && (activeTask.is_top5 || !activeTask.due_date || activeTask.status === 'waiting')) { updates.is_top5 = false; updates.due_date = todayStr; if (activeTask.status === 'waiting') updates.status = 'inbox'; shouldUpdate = true }
        else if (isOverWaitingList && activeTask.status !== 'waiting') { updates.status = 'waiting'; updates.is_top5 = false; updates.due_date = null; updates.start_time = null; updates.duration = null; shouldUpdate = true }
        else if (isOverInboxList) { if (activeTask.status === 'waiting') { updates.status = 'inbox'; updates.is_top5 = false; updates.due_date = undefined; shouldUpdate = true } else if (!activeId.endsWith('-inbox')) { updates.is_top5 = false; updates.due_date = undefined; shouldUpdate = true } }
        if (shouldUpdate) await updateTask(realActiveId, updates)
        else reorderTasks(realActiveId, realOverId)
      }
    }
  }

  // ===== Render =====
  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200 relative">
      {selectedTask && (
        <TaskDetailPopover
          task={selectedTask} updateTask={updateTask} deleteTask={deleteTask}
          onClose={() => setSelectedTask(null)} position={popoverPosition} projects={projects}
          tasks={tasks} createTask={createTask} toggleTaskStatus={toggleTaskStatus}
          onNavigateToTask={(task) => { setSelectedTask(task); setPopoverPosition(undefined) }}
        />
      )}

      {/* Tab Header - Compact */}
      <div className="flex border-b border-gray-200 flex-shrink-0">
        <button onClick={() => setActiveTab('main')} className={`flex-1 py-1.5 text-sm transition-colors relative ${activeTab === 'main' ? 'text-gray-900 font-semibold' : 'text-gray-400 hover:text-gray-600'}`}>
          Main
          {activeTab === 'main' && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-gray-900 rounded-full" />}
        </button>
        <button onClick={() => setActiveTab('tasks')} className={`flex-1 py-1.5 text-sm transition-colors relative ${activeTab === 'tasks' ? 'text-blue-600 font-semibold' : 'text-gray-400 hover:text-gray-600'}`}>
          Tasks <span className={activeTab === 'tasks' ? 'text-blue-400' : 'text-gray-300'}>{inboxTasks.length + waitingTasks.length}</span>
          {activeTab === 'tasks' && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" />}
        </button>
        <button onClick={() => setActiveTab('notes')} className={`flex-1 py-1.5 text-sm transition-colors relative ${activeTab === 'notes' ? 'text-amber-600 font-semibold' : 'text-gray-400 hover:text-gray-600'}`}>
          Notes <span className={activeTab === 'notes' ? 'text-amber-400' : 'text-gray-300'}>{noteTasks.length}</span>
          {activeTab === 'notes' && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-amber-600 rounded-full" />}
        </button>
        <button onClick={() => setActiveTab('tags')} className={`flex-1 py-1.5 text-sm transition-colors relative ${activeTab === 'tags' ? 'text-purple-600 font-semibold' : 'text-gray-400 hover:text-gray-600'}`}>
          Tags <span className={activeTab === 'tags' ? 'text-purple-400' : 'text-gray-300'}>{tagCount}</span>
          {activeTab === 'tags' && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-purple-600 rounded-full" />}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'main' && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <MainTab
              focusTasks={focusTasks} todayTasks={todayTasks} recentTasks={recentTasks}
              theFocusTasks={theFocusTasks}
              completingIds={completingIds} expandedTaskIds={expandedTaskIds}
              onTaskClick={handleTaskClick} onToggleComplete={handleToggleComplete}
              onChecklistToggle={handleChecklistToggle} onToggleExpand={handleToggleExpand}
              onConvertType={handleConvertType} getSubtasks={getSubtasks}
              toggleTaskStatus={toggleTaskStatus}
            />
          </DndContext>
        )}
        {activeTab === 'tasks' && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <TasksTab
              inboxTasks={inboxTasks} waitingTasks={waitingTasks} completedTasks={completedTasks}
              projects={projects} selectedProjectId={selectedProjectId}
              completingIds={completingIds} expandedTaskIds={expandedTaskIds}
              isCompletedExpanded={isCompletedExpanded} inboxScrollRef={inboxScrollRef}
              onTaskClick={handleTaskClick} onToggleComplete={handleToggleComplete}
              onChecklistToggle={handleChecklistToggle} onToggleExpand={handleToggleExpand}
              onConvertType={handleConvertType} getSubtasks={getSubtasks}
              toggleTaskStatus={toggleTaskStatus} setIsCompletedExpanded={setIsCompletedExpanded}
              setShowAllCompletedModal={setShowAllCompletedModal} deleteTask={deleteTask}
            />
          </DndContext>
        )}
        {activeTab === 'notes' && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <NotesTab
              noteTasks={noteTasks} activeNotes={activeNotes} completedNotes={completedNotes}
              archivedNotes={archivedNotes}
              completingIds={completingIds} expandedTaskIds={expandedTaskIds}
              onTaskClick={handleTaskClick} onToggleComplete={handleToggleComplete}
              onChecklistToggle={handleChecklistToggle} onToggleExpand={handleToggleExpand}
              onConvertType={handleConvertType} getSubtasks={getSubtasks} toggleTaskStatus={toggleTaskStatus}
              onUnarchive={(task) => updateTask(task.id, { is_archived: false })}
              onDelete={(task) => deleteTask(task.id)}
              onClearCompleted={() => {
                completedNotes.forEach(task => deleteTask(task.id))
              }}
            />
          </DndContext>
        )}
        {activeTab === 'tags' && (
          <TagsTab
            tasks={tasks}
            onTaskClick={handleTaskClick}
          />
        )}
      </div>

      {/* Quick Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <textarea value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} onKeyDown={handleKeyDown}
          placeholder="빠른 입력... (Enter: 테스크 | Shift+Enter: 노트)"
          className="w-full p-3 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent" rows={2}
        />
      </div>

      {/* Modals */}
      {showProjectModal && <ProjectCreateModal onClose={() => setShowProjectModal(false)} onCreateProject={handleCreateProject} />}

      {showAllCompletedModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAllCompletedModal(false)}>
          <div className="bg-white rounded-lg shadow-2xl w-[600px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">All Completed Tasks ({completedTasks.length})</h3>
              <div className="flex items-center gap-2">
                <button onClick={async () => { if (confirm(`완료된 할일 ${completedTasks.length}개를 모두 삭제하시겠습니까?`)) { for (const task of completedTasks) { await deleteTask(task.id) } setShowAllCompletedModal(false) } }} className="text-gray-400 hover:text-red-500 transition-colors p-1"><Trash2 size={18} /></button>
                <button onClick={() => setShowAllCompletedModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-0.5">
                {completedTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 p-1 text-xs text-gray-400 bg-white border-b border-gray-100 line-through">
                    <div className="flex-shrink-0 w-3 h-3 flex items-center justify-center"><Check size={10} className="text-blue-400" /></div>
                    <span className="flex-1 truncate">{task.title}</span>
                    <button onClick={() => { handleToggleComplete(task); if (completedTasks.length === 1) setShowAllCompletedModal(false) }} className="text-xs text-blue-500 hover:underline px-1 transition-colors">복구</button>
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
                <input type="text" value={newLinkTitle} onChange={e => setNewLinkTitle(e.target.value)} placeholder="논문 작성"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && newLinkTitle.trim() && newLinkUrl.trim()) handleCreateNotionLink() }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">링크</label>
                <input type="url" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} placeholder="https://notion.so/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => { if (e.key === 'Enter' && newLinkTitle.trim() && newLinkUrl.trim()) handleCreateNotionLink() }}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => { setShowNotionLinkModal(false); setNewLinkTitle(''); setNewLinkUrl('') }} className="flex-1 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">취소</button>
              <button onClick={handleCreateNotionLink} className="flex-1 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">추가</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
