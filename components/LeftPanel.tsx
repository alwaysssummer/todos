'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
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
import { Check, FolderPlus, Folder, ChevronDown, ChevronRight, X, Trash2, Plus, ExternalLink, GripVertical, Pencil } from 'lucide-react'
import type { Task, Project, NotionLink } from '@/types/database'
import TaskDetailPopover from './TaskDetailPopover'
import ProjectCreateModal from './ProjectCreateModal'
import RoutineSection from './RoutineSection'
import { extractTags, splitTitleAndDescription } from '@/utils/textParser'
import { useNotionLinks } from '@/hooks/useNotionLinks'

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

// 메모에서 체크리스트 항목 파싱
interface ChecklistItem {
  text: string
  isCompleted: boolean
  lineIndex: number
}

function parseChecklistFromMemo(memo: string | undefined): ChecklistItem[] {
  if (!memo) return []
  
  const items: ChecklistItem[] = []
  const lines = memo.split('\n')
  
  lines.forEach((line, index) => {
    const trimmed = line.trim()
    
    if (trimmed.startsWith('[] ')) {
      items.push({
        text: trimmed.substring(3),
        isCompleted: false,
        lineIndex: index
      })
    } else if (trimmed.startsWith('[x] ') || trimmed.startsWith('[X] ')) {
      items.push({
        text: trimmed.substring(4),
        isCompleted: true,
        lineIndex: index
      })
    }
  })
  
  return items
}

function SortableTaskItem({ id, task, onClick, onToggleComplete, isInbox = false, isCompleting = false, subtasks = [], onSubtaskToggle, onChecklistToggle, isExpanded = false, onToggleExpand }: { id?: string, task: Task, onClick: (e: React.MouseEvent) => void, onToggleComplete: (e: React.MouseEvent) => void, isInbox?: boolean, isCompleting?: boolean, subtasks?: Task[], onSubtaskToggle?: (subtask: Task) => void, onChecklistToggle?: (task: Task, lineIndex: number, newCompleted: boolean) => void, isExpanded?: boolean, onToggleExpand?: (taskId: string) => void }) {
  
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

  // 오늘 날짜인지 확인 (todayTasks 필터링과 동일한 방식 사용)
  const todayStr = new Date().toISOString().split('T')[0]
  const isToday = task.due_date?.split('T')[0] === todayStr
  
  // 메모에서 체크리스트 파싱
  const checklistItems = parseChecklistFromMemo(task.description)
  const hasChecklist = checklistItems.length > 0
  const completedCount = checklistItems.filter(item => item.isCompleted).length

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
    <div className="flex flex-col">
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={onClick}
        className={`group flex items-start gap-2 transition-all duration-150 ease-in-out cursor-grab active:cursor-grabbing border-b
          ${isInbox ? 'p-1 text-xs' : 'p-1.5 text-sm'}
          ${isCompleting ? 'opacity-0 scale-98 -translate-x-2' : 'opacity-100 scale-100 translate-x-0'}
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
            e.preventDefault()
            e.stopPropagation()
            onToggleComplete(e)
          }}
          onPointerDown={(e) => e.stopPropagation()}
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
        
        {/* 토글 버튼 (체크박스와 제목 사이) */}
        {hasChecklist && (
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onToggleExpand?.(task.id)
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex-shrink-0 w-4 h-4 mt-0.5 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg 
              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Content - 1줄 레이아웃 */}
        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
          {/* 제목 + 체크리스트 진행률 */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`truncate ${isInbox ? 'text-xs' : 'text-sm'} ${isCompleting || isCompleted ? 'line-through' : ''} ${task.is_top5 ? 'font-semibold text-gray-900' : 'font-medium text-gray-900'}`}>
              {renderTitle(task.title)}
            </span>
            {/* 체크리스트 진행률 - 제목 바로 우측 */}
            {hasChecklist && (
              <span className="flex-shrink-0 text-[10px] text-gray-400">
                {completedCount}/{checklistItems.length}
              </span>
            )}
          </div>

          {/* 우측 인디케이터들 */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
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
      
      {/* 체크리스트 항목 (펼쳐졌을 때) */}
      {hasChecklist && isExpanded && (
        <div className="ml-8 py-1 space-y-0.5 bg-gray-50/50 border-b border-gray-100">
          {checklistItems.map((item, idx) => (
            <div 
              key={idx}
              className="flex items-center gap-1.5 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onChecklistToggle?.(task, item.lineIndex, !item.isCompleted)
                }}
                className={`flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center transition-all
                  ${item.isCompleted
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                  }`}
              >
                {item.isCompleted && (
                  <Check size={8} strokeWidth={3} />
                )}
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
}

// Sortable Notion Link 컴포넌트
function SortableNotionLink({ link, onUpdate, onDelete }: { link: NotionLink, onUpdate: (id: string, updates: Partial<NotionLink>) => void, onDelete: (id: string) => void }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(link.title)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: `notion-link-${link.id}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms ease',
    zIndex: isDragging ? 999 : 1,
    opacity: isDragging ? 0.6 : 1,
  }

  // 편집 모드 진입
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleLinkClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // 화면 중앙에 팝업 창 열기
    const width = 1200
    const height = 800
    const left = (window.screen.width - width) / 2
    const top = (window.screen.height - height) / 2
    
    window.open(
      link.url,
      '_blank',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    )
  }

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsEditing(true)
    setEditTitle(link.title)
  }

  const handleSave = async () => {
    const trimmedTitle = editTitle.trim()
    if (trimmedTitle && trimmedTitle !== link.title) {
      await onUpdate(link.id, { title: trimmedTitle })
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditTitle(link.title)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 p-2 text-sm font-semibold bg-white border rounded-md transition-all shadow-sm ${
        isDragging 
          ? 'border-blue-400 shadow-xl' 
          : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/50 hover:shadow-md'
      }`}
    >
      {/* 드래그 핸들 */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors p-0.5"
      >
        <GripVertical size={16} />
      </div>

      {isEditing ? (
        // 편집 모드
        <>
          <ExternalLink size={14} className="flex-shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className="flex-1 px-2 py-0.5 text-sm font-semibold border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleSave()
            }}
            className="flex-shrink-0 text-green-600 hover:text-green-700 p-0.5"
          >
            <Check size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleCancel()
            }}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 p-0.5"
          >
            <X size={14} />
          </button>
        </>
      ) : (
        // 일반 모드
        <>
          {/* 링크 */}
          <a
            href={link.url}
            className="flex-1 flex items-center gap-1.5 text-gray-800 hover:text-blue-600 truncate cursor-pointer"
            onClick={handleLinkClick}
          >
            <ExternalLink size={14} className="flex-shrink-0" />
            <span className="truncate font-semibold">{link.title}</span>
          </a>

          {/* 편집 버튼 */}
          <button
            onClick={handleEditClick}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity flex-shrink-0 p-0.5"
            title="이름 수정"
          >
            <Pencil size={14} />
          </button>

          {/* 삭제 버튼 */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(link.id)
            }}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity flex-shrink-0 p-0.5"
            title="삭제"
          >
            <X size={14} />
          </button>
        </>
      )}
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
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set())
  const inboxScrollRef = useRef<HTMLDivElement>(null)
  const savedScrollPositionRef = useRef<number>(0)
  const shouldRestoreScrollRef = useRef<boolean>(false)

  // Notion Links 상태
  const { links: notionLinks, createLink, updateLink, deleteLink, reorderLinks } = useNotionLinks()
  const [showNotionLinkModal, setShowNotionLinkModal] = useState(false)
  const [newLinkTitle, setNewLinkTitle] = useState('')
  const [newLinkUrl, setNewLinkUrl] = useState('')

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

  // 스크롤 위치 복원
  useEffect(() => {
    if (shouldRestoreScrollRef.current && inboxScrollRef.current) {
      const scrollPos = savedScrollPositionRef.current
      // 삼중 requestAnimationFrame으로 확실히 리렌더링 후 실행
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

  // 태그 추출 함수는 utils/textParser.ts로 이동 (공통 사용)

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Shift+Enter: 노트 모달 열기
    if (e.key === 'Enter' && e.shiftKey) {
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
      // 슬래시(/)로 시작하면 Today's Task (오늘 할 일)
      else if (title.startsWith('/')) {
        dueDate = new Date().toISOString()
        title = title.substring(1).trim()
      }

      // 긴 입력 자동 분리 (제목/메모)
      const { title: splitTitle, description } = splitTitleAndDescription(title)
      const { cleanTitle, tags } = extractTags(splitTitle)

      // 노트 타입으로 생성하고 바로 모달 열기
      try {
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
        
        // 생성된 노트의 상세 모달 열기
        if (newTask) {
          console.log('📝 노트 생성 완료:', newTask)
          setSelectedTask(newTask)
          setPopoverPosition({ x: window.innerWidth / 2 - 450, y: 100 })
        } else {
          console.log('❌ newTask가 null입니다')
        }
      } catch (err) {
        console.error('❌ 노트 생성 에러:', err)
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

  const handleTaskClick = (e: React.MouseEvent, task: Task) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setPopoverPosition({ x: rect.right + 10, y: rect.top })
    setSelectedTask(task)
  }

  // Notion Link 관련 핸들러
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
    // 현재 스크롤 위치 저장
    savedScrollPositionRef.current = inboxScrollRef.current?.scrollTop || 0
    shouldRestoreScrollRef.current = true
    
    if (task.status !== 'completed') {
      // 완료로 전환하는 경우 - 애니메이션 후 상태 변경
      setCompletingIds(prev => new Set(prev).add(task.id))
      
      // 150ms 후 실제 상태 변경 (애니메이션 시간과 동일)
      setTimeout(() => {
        // 다시 스크롤 위치 저장 (애니메이션 중 스크롤이 변경되었을 수 있음)
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
  // 하위 테스크(parent_id가 있는 것)는 각 섹션에서 제외 - 부모 테스크 아래에 표시됨
  const focusTasks = tasks.filter(t => t.is_top5 && t.status !== 'completed' && t.status !== 'waiting' && !t.is_auto_generated && !t.is_makeup && !t.parent_id)

  // 2. Today's Task: !is_top5 && due_date === today
  const todayTasks = tasks.filter(t => !t.is_top5 && t.due_date?.split('T')[0] === todayStr && t.status !== 'completed' && t.status !== 'waiting' && !t.is_auto_generated && !t.is_makeup && !t.parent_id)

  // 3. Waiting: status === 'waiting'
  const waitingTasks = tasks.filter(t => t.status === 'waiting' && !t.is_auto_generated && !t.is_makeup && !t.parent_id)

  // 4. Inbox: Focus와 Today's Task에 표시된 것은 제외 (중복 방지)
  // 보충수업(is_makeup)과 정규수업(is_auto_generated)은 INBOX에서 제외
  // 하위 테스크(parent_id가 있는 것)도 제외 - 부모 테스크 아래에 표시됨
  const inboxTasks = useMemo(() => {
    let filtered = tasks.filter(t => 
      t.status !== 'completed' && 
      t.status !== 'waiting' && 
      !t.is_auto_generated && 
      !t.is_makeup &&
      !t.is_top5 &&  // Today's Focus에 있는 것 제외
      t.due_date?.split('T')[0] !== todayStr &&  // Today's Task에 있는 것 제외
      !t.parent_id  // 하위 테스크 제외
    )

    // 프로젝트 필터 적용
    if (selectedProjectId) {
      filtered = filtered.filter(t => t.project_id === selectedProjectId)
    }

    // Inbox 정렬 (order_index 기준)
    return filtered.sort((a, b) => {
      const isYellowA = a.status === 'scheduled'
      const isYellowB = b.status === 'scheduled'

      // 노란색(scheduled)이 위로
      if (isYellowA && !isYellowB) return -1
      if (!isYellowA && isYellowB) return 1

      return (a.order_index || 0) - (b.order_index || 0)
    })
  }, [tasks, selectedProjectId, todayStr])
  
  // 특정 부모 테스크의 하위 테스크 가져오기
  const getSubtasks = (parentId: string) => {
    return tasks
      .filter(t => t.parent_id === parentId)
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
  }
  
  // 체크리스트 펼침/접힘 토글
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
  
  // 메모 내 체크리스트 토글 핸들러
  const handleChecklistToggle = async (task: Task, lineIndex: number, newCompleted: boolean) => {
    if (!task.description) return
    
    const lines = task.description.split('\n')
    const line = lines[lineIndex]
    
    if (!line) return
    
    // [] → [x] 또는 [x] → []
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
  function DroppableContainer({ id, title, count, children, className, scrollRef }: { id: string, title: string, count?: number, children: React.ReactNode, className?: string, scrollRef?: React.RefObject<HTMLDivElement | null> }) {
    const { setNodeRef, isOver } = useDroppable({ id })

    return (
      <div ref={setNodeRef} className={`flex-1 flex flex-col ${className} ${isOver ? 'bg-blue-50/50' : ''}`}>
        <h2 className={`text-sm mb-3 px-4 pt-4 ${
          title === "Today's Focus" 
            ? 'text-red-600 font-extrabold' 
            : title === "Today's Task"
              ? 'text-green-600 font-extrabold'
              : 'font-semibold text-gray-900'
        }`}>
          {title} {count !== undefined && <span className="text-gray-400 font-normal">({count})</span>}
        </h2>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-4">
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

      {/* ROUTINES 섹션 - Today's Focus 위에 독립적으로 배치 */}
      <RoutineSection />

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
                    subtasks={getSubtasks(task.id)}
                    onSubtaskToggle={(subtask) => toggleTaskStatus(subtask.id, subtask.status)}
                    onChecklistToggle={handleChecklistToggle}
                    isExpanded={expandedTaskIds.has(task.id)}
                    onToggleExpand={handleToggleExpand}
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
                    subtasks={getSubtasks(task.id)}
                    onSubtaskToggle={(subtask) => toggleTaskStatus(subtask.id, subtask.status)}
                    onChecklistToggle={handleChecklistToggle}
                    isExpanded={expandedTaskIds.has(task.id)}
                    onToggleExpand={handleToggleExpand}
                  />
                ))}
              </div>
            </SortableContext>
          </DroppableContainer>
        </div>

        {/* PROJECT 섹션 */}
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

        {/* Bottom: Inbox (Master List) */}
        <div className="flex-1 flex flex-col min-h-0">
          <DroppableContainer
            id="inbox-container"
            title={selectedProjectId ? projects.find(p => p.id === selectedProjectId)?.name || 'INBOX' : 'INBOX'}
            className="h-full"
            scrollRef={inboxScrollRef}
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
                    subtasks={getSubtasks(task.id)}
                    onSubtaskToggle={(subtask) => toggleTaskStatus(subtask.id, subtask.status)}
                    onChecklistToggle={handleChecklistToggle}
                    isExpanded={expandedTaskIds.has(task.id)}
                    onToggleExpand={handleToggleExpand}
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
                        subtasks={getSubtasks(task.id)}
                        onSubtaskToggle={(subtask) => toggleTaskStatus(subtask.id, subtask.status)}
                        onChecklistToggle={handleChecklistToggle}
                        isExpanded={expandedTaskIds.has(task.id)}
                        onToggleExpand={handleToggleExpand}
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
        <textarea
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="빠른 입력... (Enter: 테스크 | Shift+Enter: 노트)"
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

      {/* Notion Link 추가 모달 */}
      {showNotionLinkModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowNotionLinkModal(false)}>
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">프로젝트 링크 추가</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  제목
                </label>
                <input
                  type="text"
                  value={newLinkTitle}
                  onChange={e => setNewLinkTitle(e.target.value)}
                  placeholder="논문 작성"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newLinkTitle.trim() && newLinkUrl.trim()) {
                      handleCreateNotionLink()
                    }
                  }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  링크
                </label>
                <input
                  type="url"
                  value={newLinkUrl}
                  onChange={e => setNewLinkUrl(e.target.value)}
                  placeholder="https://notion.so/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newLinkTitle.trim() && newLinkUrl.trim()) {
                      handleCreateNotionLink()
                    }
                  }}
                />
              </div>
            </div>
            
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => {
                  setShowNotionLinkModal(false)
                  setNewLinkTitle('')
                  setNewLinkUrl('')
                }}
                className="flex-1 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleCreateNotionLink}
                className="flex-1 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
