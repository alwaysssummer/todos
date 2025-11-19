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
import { Check, FolderPlus, Folder, ChevronDown, ChevronRight, X, Trash2 } from 'lucide-react'
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
      className={`group flex items-start gap-2 p-1.5 text-sm transition-all bg-white cursor-grab active:cursor-grabbing border-b
        ${isCompleted
          ? 'text-gray-400 border-gray-100 bg-gray-50'
          : 'text-gray-700 border-gray-200 hover:border-blue-300'
        }`}
    >
      {/* Checkbox (Square) */}
      <button
        onClick={(e) => {
            e.stopPropagation() // 드래그나 클릭 방지
            onToggleComplete(e)
        }}
        onPointerDown={(e) => e.stopPropagation()} // 드래그 시작 방지
        className={`flex-shrink-0 w-4 h-4 mt-0.5 rounded-[4px] border flex items-center justify-center transition-colors
            ${isCompleted 
                ? 'bg-blue-500 border-blue-500 text-white' 
                : 'border-gray-300 hover:border-blue-400 text-transparent hover:bg-blue-50'
            }`}
      >
        <Check size={10} strokeWidth={4} />
      </button>

      {/* Content - 1줄 레이아웃 */}
      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
        {/* 제목 */}
        <div className={`text-sm font-medium text-gray-900 truncate ${isCompleted ? 'line-through' : ''}`}>
          {task.title}
        </div>
        
        {/* 우측 인디케이터들 */}
        <div className="flex items-center gap-1.5">
          {/* Scheduled - 노란색 동그라미 */}
          {isScheduled && !isCompleted && (
            <div 
              className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" 
              title="Scheduled"
            />
          )}
          
          {/* Top 5 - 빨간색 동그라미 */}
          {task.is_top5 && !isCompleted && (
            <div 
              className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" 
              title="Today's Top 5"
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default function LeftPanel({ tasks, createTask, updateTask, deleteTask, reorderTasks, projects, createProject, updateProject, deleteProject }: LeftPanelProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [popoverPosition, setPopoverPosition] = useState<{ x: number, y: number } | undefined>(undefined)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false)
  const [showAllCompletedModal, setShowAllCompletedModal] = useState(false)

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

      let title = newTaskTitle.trim()
      let isTop5 = false
      
      // 별표로 시작하는지 확인 (공백 포함)
      if (title.startsWith('*')) {
        isTop5 = true
        title = title.substring(1).trim() // * 제거하고 앞뒤 공백 제거
      }

      await createTask({
        title,
        status: 'inbox',
        is_top5: isTop5
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
  
  // 최근 10개만 표시용
  const recentCompletedTasks = completedTasks.slice(0, 10)
  const hasMoreCompleted = completedTasks.length > 10

  // 프로젝트 필터 적용
  if (selectedProjectId) {
    activeTasks = activeTasks.filter(t => t.project_id === selectedProjectId)
  }

  // Inbox 정렬: 노란색+빨간색 > 빨간색 > 노란색 > 나머지
  activeTasks = activeTasks.sort((a, b) => {
    const aScheduled = a.status === 'scheduled' ? 1 : 0
    const aTop5 = a.is_top5 ? 1 : 0
    const bScheduled = b.status === 'scheduled' ? 1 : 0
    const bTop5 = b.is_top5 ? 1 : 0
    
    // 우선순위 계산 (높을수록 위로)
    const aPriority = aScheduled + aTop5
    const bPriority = bScheduled + bTop5
    
    if (aPriority !== bPriority) {
      return bPriority - aPriority // 내림차순 (높은 우선순위가 위로)
    }
    
    // 우선순위가 같으면 order_index로 정렬
    return (a.order_index || 0) - (b.order_index || 0)
  })

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

      {/* Top: TODAY */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">TODAY</h2>
        <div className="space-y-0.5">
          {top5Tasks.length === 0 && (
            <div className="text-xs text-gray-400 text-center py-2">
              별표(★)를 눌러 중요한 태스크를 추가하세요
            </div>
          )}
          {top5Tasks.map((task) => {
            const isScheduled = task.status === 'scheduled'
            
            return (
              <div
                key={task.id}
                onClick={(e) => handleTaskClick(e, task)}
                className="flex items-center gap-2 p-2 text-sm text-gray-600 bg-gray-50 rounded border border-gray-100 hover:border-blue-300 transition-colors cursor-pointer group"
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
                
                {/* 우측 인디케이터들 */}
                <div className="flex items-center gap-1.5">
                  {/* Scheduled - 노란색 동그라미 */}
                  {isScheduled && (
                    <div 
                      className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" 
                      title="Scheduled"
                    />
                  )}
                  
                  {/* Top 5 - 빨간색 동그라미 (항상 표시) */}
                  <div 
                    className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" 
                    title="Today's Top 5"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>


      {/* Center: Inbox (Master List) */}
      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          {selectedProjectId ? projects.find(p => p.id === selectedProjectId)?.name || 'INBOX' : 'INBOX'}
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
        <div className="space-y-0.5">
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
        
        {/* Completed Tasks Section - Collapsible */}
        {completedTasks.length > 0 && (
          <div className="mt-8">
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
                <div className="space-y-0.5 opacity-75">
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
      </div>

      {/* Bottom: Quick Capture Input (Sticky) */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <textarea
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="빠른 입력... (Enter로 추가, *제목으로 Top 5 추가)"
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
