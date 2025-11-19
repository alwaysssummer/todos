'use client'

import { useState } from 'react'
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
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, FolderPlus, Folder } from 'lucide-react'
import type { Task, Project } from '@/types/database'
import TaskDetailPopover from './TaskDetailPopover'
import ProjectCreateModal from './ProjectCreateModal'

interface LeftPanelProps {
  tasks: Task[]
  createTask: (task: Partial<Task>) => Promise<any>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  reorderTasks: (activeId: string, overId: string) => void
  projects: Project[]
  createProject: (project: Partial<Project>) => Promise<Project>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
}

function SortableTaskItem({ task, onClick, onToggleComplete }: { task: Task, onClick: (e: React.MouseEvent) => void, onToggleComplete: (e: React.MouseEvent) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  }

  const isCompleted = task.status === 'completed'
  const isScheduled = task.status === 'scheduled'

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`group flex items-center gap-3 p-3 text-sm rounded border transition-all bg-white cursor-grab active:cursor-grabbing
        ${isCompleted
          ? 'text-gray-400 border-gray-100 bg-gray-50'
          : 'text-gray-700 border-gray-200 hover:border-blue-300 hover:shadow-sm'
        }`}
    >
      {/* Checkbox (Square) */}
      <button
        onClick={(e) => {
            e.stopPropagation() // 드래그나 클릭 방지
            onToggleComplete(e)
        }}
        onPointerDown={(e) => e.stopPropagation()} // 드래그 시작 방지
        className={`flex-shrink-0 w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors
            ${isCompleted 
                ? 'bg-blue-500 border-blue-500 text-white' 
                : 'border-gray-300 hover:border-blue-400 text-transparent hover:bg-blue-50'
            }`}
      >
        <Check size={10} strokeWidth={4} />
      </button>

      {/* Content */}
      <div className={`flex-1 truncate ${isCompleted ? 'line-through' : ''}`}>
        {task.title}
      </div>

      {/* Scheduled Badge */}
      {isScheduled && !isCompleted && (
        <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 whitespace-nowrap">
          Scheduled
        </span>
      )}
    </div>
  )
}

export default function LeftPanel({ tasks, createTask, updateTask, deleteTask, reorderTasks, projects, createProject, updateProject, deleteProject }: LeftPanelProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [popoverPosition, setPopoverPosition] = useState<{ x: number, y: number } | undefined>(undefined)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [showProjectModal, setShowProjectModal] = useState(false)

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

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!newTaskTitle.trim()) return

      await createTask({
        title: newTaskTitle,
        status: 'inbox',
        is_top5: false
      })
      setNewTaskTitle('')
    }
  }

  const handleTaskClick = (e: React.MouseEvent, task: Task) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setPopoverPosition({ x: rect.right + 10, y: rect.top })
    setSelectedTask(task)
  }

  const handleToggleComplete = async (task: Task) => {
      await updateTask(task.id, { status: task.status === 'completed' ? 'inbox' : 'completed' })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (active.id !== over?.id) {
      reorderTasks(active.id as string, over?.id as string)
    }
  }

  const handleCreateProject = async (project: Partial<Project>) => {
    const newProject = await createProject(project)
    return newProject
  }

  // 필터링 로직
  // 자동 생성 태스크 제외 (학생 시간표, 루틴/습관은 인박스에 표시하지 않음)
  const top5Tasks = tasks.filter(t => t.is_top5 && t.status !== 'completed' && !t.is_auto_generated)
  let activeTasks = tasks.filter(t => t.status !== 'completed' && !t.is_auto_generated) // Inbox (All Active)
  const completedTasks = tasks.filter(t => t.status === 'completed' && !t.is_auto_generated) // Completed

  // 프로젝트 필터 적용
  if (selectedProjectId) {
    activeTasks = activeTasks.filter(t => t.project_id === selectedProjectId)
  }

  // 각 프로젝트의 태스크 개수 계산
  const projectTaskCounts = projects.reduce((acc, project) => {
    acc[project.id] = tasks.filter(t => t.project_id === project.id && t.status !== 'completed').length
    return acc
  }, {} as Record<string, number>)

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
        />
      )}

      {/* Top: Today's Top 5 */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Today&apos;s Top 5</h2>
        <div className="space-y-2">
          {top5Tasks.length === 0 && (
            <div className="text-xs text-gray-400 text-center py-2">
              별표(★)를 눌러 중요한 태스크를 추가하세요
            </div>
          )}
          {top5Tasks.map((task) => (
            <div
              key={task.id}
              onClick={(e) => handleTaskClick(e, task)}
              className="flex items-center gap-3 p-2 text-sm text-gray-600 bg-gray-50 rounded border border-gray-100 hover:border-blue-300 transition-colors cursor-pointer group"
            >
               <button
                onClick={(e) => {
                    e.stopPropagation()
                    handleToggleComplete(task)
                }}
                className="flex-shrink-0 w-4 h-4 rounded-[4px] border border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center justify-center text-transparent hover:text-blue-400"
              >
                <Check size={10} strokeWidth={4} />
              </button>
              <span className="flex-1 truncate">{task.title}</span>
            </div>
          ))}
        </div>
      </div>


      {/* Center: Inbox (Master List) */}
      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          {selectedProjectId ? projects.find(p => p.id === selectedProjectId)?.name || 'Inbox' : 'Inbox (All Tasks)'}
        </h2>
        
        <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext 
                items={activeTasks.map(t => t.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="space-y-2">
                {activeTasks.map((task) => (
                    <SortableTaskItem
                        key={task.id}
                        task={task}
                        onClick={(e) => handleTaskClick(e, task)}
                        onToggleComplete={() => handleToggleComplete(task)}
                    />
                ))}
                </div>
            </SortableContext>
        </DndContext>
        
        {/* Completed Tasks Section */}
        {completedTasks.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">Completed</h2>
            <div className="space-y-2 opacity-75">
              {completedTasks.map((task) => (
                 <div
                    key={task.id}
                    className="flex items-center gap-3 p-2 text-sm text-gray-400 bg-gray-50 rounded border border-gray-100 line-through"
                 >
                    <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                        <Check size={12} className="text-blue-400" />
                    </div>
                    <span className="flex-1 truncate">{task.title}</span>
                    <button 
                        onClick={() => handleToggleComplete(task)}
                        className="text-xs text-blue-400 hover:underline px-2"
                    >
                        복구
                    </button>
                 </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom: Quick Capture Input (Sticky) */}
      <div className="p-4 border-t border-gray-200 bg-white">
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
    </div>
  )
}
