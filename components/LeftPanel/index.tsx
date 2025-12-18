'use client'

import { useRef, useEffect, useMemo } from 'react'
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
import { useNotionLinks } from '@/hooks/useNotionLinks'
import { useTaskFilters } from '@/hooks/useTaskFilters'
import { createTaskFromInput, handleTaskDragEnd } from '@/utils/taskActions'
import { getSubtasks, toggleChecklistItem } from '@/utils/taskHelpers'

// 분리된 컴포넌트들
import MainTab from './MainTab'
import TasksTab from './TasksTab'
import NotesTab from './NotesTab'
import TagsTab from './TagsTab'
import { LeftPanelProps } from './types'

// 상태 관리
import { useUIState, useFormState } from './state'

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
  // ===== State Management =====
  const [uiState, uiDispatch] = useUIState()
  const [formState, formDispatch] = useFormState()
  
  // Refs
  const inboxScrollRef = useRef<HTMLDivElement>(null)
  const savedScrollPositionRef = useRef<number>(0)
  const shouldRestoreScrollRef = useRef<boolean>(false)

  // Notion Links 상태
  const { links: notionLinks, createLink, updateLink, deleteLink, reorderLinks } = useNotionLinks()
  
  // Task Filters
  const {
    theFocusTasks,
    focusTasks,
    todayTasks,
    waitingTasks,
    inboxTasks,
    completedTasks,
    noteTasks,
    activeNotes,
    completedNotes,
    archivedNotes,
    recentTasks
  } = useTaskFilters(tasks, uiState.selectedProjectId)

  // ===== Sensors =====
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // ===== Effects =====
  
  // selectedTask를 tasks 배열과 동기화 (updateTask 후 UI 반영)
  useEffect(() => {
    if (uiState.selectedTask) {
      const updatedTask = tasks.find(t => t.id === uiState.selectedTask!.id)
      if (updatedTask && updatedTask.updated_at !== uiState.selectedTask.updated_at) {
        uiDispatch({ type: 'SET_SELECTED_TASK', payload: updatedTask })
      }
    }
  }, [tasks, uiState.selectedTask, uiDispatch])

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

  // ===== Tag Count =====
  const tagCount = useMemo(() => {
    const uniqueTags = new Set<string>()
    tasks.forEach(task => {
      if (!task.is_auto_generated) {
        task.tags?.forEach(tag => uniqueTags.add(tag))
      }
    })
    return uniqueTags.size
  }, [tasks])

  // ===== Helper Functions =====
  const getTaskSubtasks = (parentId: string) => getSubtasks(tasks, parentId)

  // ===== Handlers =====
  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const input = formState.newTaskTitle.trim()
    if (!input) return

    // Shift+Enter: 노트 생성 후 상세 팝오버 열기
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault()
      try {
        const newTask = await createTaskFromInput(input, createTask, 'note')
        formDispatch({ type: 'RESET_TASK_FORM' })
        if (newTask) {
          uiDispatch({ type: 'SET_SELECTED_TASK', payload: newTask })
          uiDispatch({ type: 'SET_POPOVER_POSITION', payload: { x: window.innerWidth / 2 - 450, y: 100 } })
        }
      } catch (err) {
        console.error('노트 생성 에러:', err)
      }
      return
    }

    // Enter: 태스크 생성
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      await createTaskFromInput(input, createTask, 'task')
      formDispatch({ type: 'RESET_TASK_FORM' })
    }
  }

  const handleTaskClick = (e: React.MouseEvent, task: Task) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    uiDispatch({ type: 'SET_POPOVER_POSITION', payload: { x: rect.right + 10, y: rect.top } })
    uiDispatch({ type: 'SET_SELECTED_TASK', payload: task })
  }

  const handleCreateNotionLink = async () => {
    if (!formState.newLinkTitle.trim() || !formState.newLinkUrl.trim()) { alert('제목과 링크를 모두 입력해주세요.'); return }
    await createLink({ title: formState.newLinkTitle, url: formState.newLinkUrl, order_index: notionLinks.length })
    formDispatch({ type: 'RESET_LINK_FORM' })
    uiDispatch({ type: 'TOGGLE_NOTION_LINK_MODAL', payload: false })
  }

  const handleDeleteNotionLink = async (id: string) => {
    if (confirm('이 프로젝트 링크를 삭제하시겠습니까?')) { await deleteLink(id) }
  }

  const handleToggleComplete = (task: Task) => {
    savedScrollPositionRef.current = inboxScrollRef.current?.scrollTop || 0
    shouldRestoreScrollRef.current = true
    if (task.status !== 'completed') {
      uiDispatch({ type: 'ADD_COMPLETING_ID', payload: task.id })
      setTimeout(() => {
        savedScrollPositionRef.current = inboxScrollRef.current?.scrollTop || 0
        shouldRestoreScrollRef.current = true
        toggleTaskStatus(task.id, task.status)
        uiDispatch({ type: 'REMOVE_COMPLETING_ID', payload: task.id })
      }, 150)
    } else {
      toggleTaskStatus(task.id, task.status)
    }
  }

  const handleCreateProject = async (project: Partial<Project>) => await createProject(project)
  const handleConvertType = async (task: Task, newType: 'task' | 'note') => await updateTask(task.id, { type: newType })
  const handleToggleExpand = (taskId: string) => {
    uiDispatch({ type: 'TOGGLE_TASK_EXPAND', payload: taskId })
  }
  const handleChecklistToggle = async (task: Task, lineIndex: number, newCompleted: boolean) => {
    const updatedDescription = toggleChecklistItem(task, lineIndex, newCompleted)
    if (updatedDescription) {
      await updateTask(task.id, { description: updatedDescription })
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    await handleTaskDragEnd(
      event,
      tasks,
      focusTasks,
      todayTasks,
      updateTask,
      reorderTasks,
      reorderLinks
    )
  }

  // ===== Render =====
  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200 relative">
      {uiState.selectedTask && (
        <TaskDetailPopover
          task={uiState.selectedTask} updateTask={updateTask} deleteTask={deleteTask}
          onClose={() => uiDispatch({ type: 'SET_SELECTED_TASK', payload: null })} 
          position={uiState.popoverPosition} projects={projects}
          tasks={tasks} createTask={createTask} toggleTaskStatus={toggleTaskStatus}
          onNavigateToTask={(task) => { 
            uiDispatch({ type: 'SET_SELECTED_TASK', payload: task })
            uiDispatch({ type: 'SET_POPOVER_POSITION', payload: undefined })
          }}
        />
      )}

      {/* Tab Header - Compact */}
      <div className="flex border-b border-gray-200 flex-shrink-0">
        <button onClick={() => uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'main' })} className={`flex-1 py-1.5 text-sm transition-colors relative ${uiState.activeTab === 'main' ? 'text-gray-900 font-semibold' : 'text-gray-400 hover:text-gray-600'}`}>
          Main
          {uiState.activeTab === 'main' && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-gray-900 rounded-full" />}
        </button>
        <button onClick={() => uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'tasks' })} className={`flex-1 py-1.5 text-sm transition-colors relative ${uiState.activeTab === 'tasks' ? 'text-blue-600 font-semibold' : 'text-gray-400 hover:text-gray-600'}`}>
          Tasks <span className={uiState.activeTab === 'tasks' ? 'text-blue-400' : 'text-gray-300'}>{inboxTasks.length + waitingTasks.length}</span>
          {uiState.activeTab === 'tasks' && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" />}
        </button>
        <button onClick={() => uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'notes' })} className={`flex-1 py-1.5 text-sm transition-colors relative ${uiState.activeTab === 'notes' ? 'text-amber-600 font-semibold' : 'text-gray-400 hover:text-gray-600'}`}>
          Notes <span className={uiState.activeTab === 'notes' ? 'text-amber-400' : 'text-gray-300'}>{noteTasks.length}</span>
          {uiState.activeTab === 'notes' && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-amber-600 rounded-full" />}
        </button>
        <button onClick={() => uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'tags' })} className={`flex-1 py-1.5 text-sm transition-colors relative ${uiState.activeTab === 'tags' ? 'text-purple-600 font-semibold' : 'text-gray-400 hover:text-gray-600'}`}>
          Tags <span className={uiState.activeTab === 'tags' ? 'text-purple-400' : 'text-gray-300'}>{tagCount}</span>
          {uiState.activeTab === 'tags' && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-purple-600 rounded-full" />}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {uiState.activeTab === 'main' && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <MainTab
              focusTasks={focusTasks} todayTasks={todayTasks} recentTasks={recentTasks}
              theFocusTasks={theFocusTasks}
              completingIds={uiState.completingIds} expandedTaskIds={uiState.expandedTaskIds}
              onTaskClick={handleTaskClick} onToggleComplete={handleToggleComplete}
              onChecklistToggle={handleChecklistToggle} onToggleExpand={handleToggleExpand}
              onConvertType={handleConvertType} getSubtasks={getTaskSubtasks}
              toggleTaskStatus={toggleTaskStatus}
            />
          </DndContext>
        )}
        {uiState.activeTab === 'tasks' && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <TasksTab
              inboxTasks={inboxTasks} waitingTasks={waitingTasks} completedTasks={completedTasks}
              projects={projects} selectedProjectId={uiState.selectedProjectId}
              completingIds={uiState.completingIds} expandedTaskIds={uiState.expandedTaskIds}
              isCompletedExpanded={uiState.isCompletedExpanded} inboxScrollRef={inboxScrollRef}
              onTaskClick={handleTaskClick} onToggleComplete={handleToggleComplete}
              onChecklistToggle={handleChecklistToggle} onToggleExpand={handleToggleExpand}
              onConvertType={handleConvertType} getSubtasks={getTaskSubtasks}
              toggleTaskStatus={toggleTaskStatus} 
              setIsCompletedExpanded={(value) => uiDispatch({ type: 'TOGGLE_COMPLETED_EXPANDED', payload: value })}
              setShowAllCompletedModal={(value) => uiDispatch({ type: 'TOGGLE_ALL_COMPLETED_MODAL', payload: value })} 
              deleteTask={deleteTask}
            />
          </DndContext>
        )}
        {uiState.activeTab === 'notes' && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <NotesTab
              noteTasks={noteTasks} activeNotes={activeNotes} completedNotes={completedNotes}
              archivedNotes={archivedNotes}
              completingIds={uiState.completingIds} expandedTaskIds={uiState.expandedTaskIds}
              onTaskClick={handleTaskClick} onToggleComplete={handleToggleComplete}
              onChecklistToggle={handleChecklistToggle} onToggleExpand={handleToggleExpand}
              onConvertType={handleConvertType} getSubtasks={getTaskSubtasks} toggleTaskStatus={toggleTaskStatus}
              onUnarchive={(task) => updateTask(task.id, { is_archived: false })}
              onDelete={(task) => deleteTask(task.id)}
              onClearCompleted={() => {
                completedNotes.forEach(task => deleteTask(task.id))
              }}
            />
          </DndContext>
        )}
        {uiState.activeTab === 'tags' && (
          <TagsTab
            tasks={tasks}
            onTaskClick={handleTaskClick}
          />
        )}
      </div>

      {/* Quick Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <textarea value={formState.newTaskTitle} onChange={(e) => formDispatch({ type: 'SET_NEW_TASK_TITLE', payload: e.target.value })} onKeyDown={handleKeyDown}
          placeholder="빠른 입력... (Enter: 테스크 | Shift+Enter: 노트)"
          className="w-full p-3 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent" rows={2}
        />
      </div>

      {/* Modals */}
      {uiState.showProjectModal && <ProjectCreateModal onClose={() => uiDispatch({ type: 'TOGGLE_PROJECT_MODAL', payload: false })} onCreateProject={handleCreateProject} />}

      {uiState.showAllCompletedModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => uiDispatch({ type: 'TOGGLE_ALL_COMPLETED_MODAL', payload: false })}>
          <div className="bg-white rounded-lg shadow-2xl w-[600px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">All Completed Tasks ({completedTasks.length})</h3>
              <div className="flex items-center gap-2">
                <button onClick={async () => { if (confirm(`완료된 할일 ${completedTasks.length}개를 모두 삭제하시겠습니까?`)) { for (const task of completedTasks) { await deleteTask(task.id) } uiDispatch({ type: 'TOGGLE_ALL_COMPLETED_MODAL', payload: false }) } }} className="text-gray-400 hover:text-red-500 transition-colors p-1"><Trash2 size={18} /></button>
                <button onClick={() => uiDispatch({ type: 'TOGGLE_ALL_COMPLETED_MODAL', payload: false })} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-0.5">
                {completedTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 p-1 text-xs text-gray-400 bg-white border-b border-gray-100 line-through">
                    <div className="flex-shrink-0 w-3 h-3 flex items-center justify-center"><Check size={10} className="text-blue-400" /></div>
                    <span className="flex-1 truncate">{task.title}</span>
                    <button onClick={() => { handleToggleComplete(task); if (completedTasks.length === 1) uiDispatch({ type: 'TOGGLE_ALL_COMPLETED_MODAL', payload: false }) }} className="text-xs text-blue-500 hover:underline px-1 transition-colors">복구</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {uiState.showNotionLinkModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => uiDispatch({ type: 'TOGGLE_NOTION_LINK_MODAL', payload: false })}>
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">프로젝트 링크 추가</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                <input type="text" value={formState.newLinkTitle} onChange={e => formDispatch({ type: 'SET_NEW_LINK_TITLE', payload: e.target.value })} placeholder="논문 작성"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && formState.newLinkTitle.trim() && formState.newLinkUrl.trim()) handleCreateNotionLink() }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">링크</label>
                <input type="url" value={formState.newLinkUrl} onChange={e => formDispatch({ type: 'SET_NEW_LINK_URL', payload: e.target.value })} placeholder="https://notion.so/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => { if (e.key === 'Enter' && formState.newLinkTitle.trim() && formState.newLinkUrl.trim()) handleCreateNotionLink() }}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => { uiDispatch({ type: 'TOGGLE_NOTION_LINK_MODAL', payload: false }); formDispatch({ type: 'RESET_LINK_FORM' }) }} className="flex-1 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">취소</button>
              <button onClick={handleCreateNotionLink} className="flex-1 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">추가</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
