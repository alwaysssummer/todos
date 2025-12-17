'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { ChevronLeft, Check, Trash2, Star, Calendar, ChevronUp, ChevronDown } from 'lucide-react'
import type { Task, Project } from '@/types/database'
import { parseChecklistFromMemo } from '@/utils/checklistParser'

interface MobileTaskDetailViewProps {
  task: Task
  onBack: () => void
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  projects: Project[]
  onNavigateToTab?: (tab: 'focus' | 'today' | 'inbox') => void
}

export default function MobileTaskDetailView({
  task,
  onBack,
  updateTask,
  deleteTask,
  projects,
  onNavigateToTab
}: MobileTaskDetailViewProps) {
  const [title, setTitle] = useState(task.title)
  const [memo, setMemo] = useState(task.description || '')
  const [isDeleting, setIsDeleting] = useState(false)

  const project = projects.find(p => p.id === task.project_id)
  const isNote = task.type === 'note'
  const checklistItems = parseChecklistFromMemo(memo)
  const hasChecklist = checklistItems.length > 0
  const completedCount = checklistItems.filter(item => item.isCompleted).length

  // 제목 저장
  const saveTitle = () => {
    if (title.trim() && title !== task.title) {
      updateTask(task.id, { title: title.trim() })
    }
  }

  // 메모 저장
  const saveMemo = () => {
    if (memo !== task.description) {
      updateTask(task.id, { description: memo })
    }
  }

  // 완료 토글
  const toggleComplete = () => {
    const newStatus = task.status === 'completed' ? 'inbox' : 'completed'
    updateTask(task.id, { status: newStatus })
  }

  // Focus 토글
  const toggleFocus = () => {
    updateTask(task.id, { is_top5: !task.is_top5 })
  }

  // Today 토글
  const toggleToday = () => {
    const newDueDate = task.due_date ? undefined : new Date().toISOString()
    updateTask(task.id, { due_date: newDueDate })
  }

  // 현재 위계 파악 (0: 인박스, 1: 투데이즈 테스크, 2: 투데이즈 포커스, 3: 더 포커스)
  const getCurrentHierarchy = (): number => {
    const todayStr = new Date().toISOString().split('T')[0]
    if (task.is_the_focus) return 3
    if (task.is_top5) return 2
    if (task.due_date && task.due_date.split('T')[0] <= todayStr) return 1
    return 0
  }

  // 위계 상승
  const moveUp = async () => {
    const todayStr = new Date().toISOString().split('T')[0]
    const current = getCurrentHierarchy()
    if (current >= 3) return

    const updates: Partial<Task> = {}
    let targetTab: 'focus' | 'today' | 'inbox' | null = null
    
    if (current === 0) { // 인박스 → 투데이즈 테스크
      updates.due_date = todayStr
      targetTab = 'today'
    } else if (current === 1) { // 투데이즈 테스크 → 투데이즈 포커스
      updates.is_top5 = true
      targetTab = 'today'
    } else if (current === 2) { // 투데이즈 포커스 → 더 포커스
      updates.is_the_focus = true
      updates.is_top5 = false
      targetTab = 'focus'
    }

    await updateTask(task.id, updates)
    
    // 탭 전환
    if (targetTab && onNavigateToTab) {
      setTimeout(() => {
        onNavigateToTab(targetTab!)
        onBack()
      }, 300)
    }
  }

  // 위계 하강
  const moveDown = async () => {
    const current = getCurrentHierarchy()
    if (current <= 0) return

    const updates: Partial<Task> = {}
    let targetTab: 'focus' | 'today' | 'inbox' | null = null
    
    if (current === 3) { // 더 포커스 → 투데이즈 포커스
      updates.is_the_focus = false
      updates.is_top5 = true
      targetTab = 'today'
    } else if (current === 2) { // 투데이즈 포커스 → 투데이즈 테스크
      updates.is_top5 = false
      targetTab = 'today'
    } else if (current === 1) { // 투데이즈 테스크 → 인박스
      updates.due_date = null
      targetTab = 'inbox'
    }

    await updateTask(task.id, updates)
    
    // 탭 전환
    if (targetTab && onNavigateToTab) {
      setTimeout(() => {
        onNavigateToTab(targetTab!)
        onBack()
      }, 300)
    }
  }

  // 체크리스트 토글
  const toggleChecklist = (lineIndex: number, newCompleted: boolean) => {
    const lines = memo.split('\n')
    const line = lines[lineIndex]
    
    if (newCompleted) {
      lines[lineIndex] = line.replace(/^\[\]\s/, '[x] ')
    } else {
      lines[lineIndex] = line.replace(/^\[x\]\s/i, '[] ')
    }
    
    const newMemo = lines.join('\n')
    setMemo(newMemo)
    updateTask(task.id, { description: newMemo })
  }

  // 삭제
  const handleDelete = async () => {
    if (isDeleting) return
    setIsDeleting(true)
    await deleteTask(task.id)
    onBack()
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b px-3 py-2 flex items-center gap-2">
        <button onClick={onBack} className="p-1">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 min-w-0">
          <span className={`text-xs px-1.5 py-0.5 rounded ${isNote ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
            {isNote ? '노트' : '태스크'}
          </span>
        </div>
        <button 
          onClick={handleDelete}
          disabled={isDeleting}
          className="p-2 text-red-400 hover:text-red-600"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-20">
        
        {/* 제목 */}
        <div className="bg-white rounded-lg p-3 border border-gray-100">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={saveTitle}
            className="w-full text-lg font-bold focus:outline-none"
            placeholder="제목"
          />
          {project && (
            <div className="mt-1 flex items-center gap-1.5">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: project.color }}
              />
              <span className="text-xs text-gray-500">{project.name}</span>
            </div>
          )}
        </div>

        {/* 빠른 액션 */}
        <div className="flex gap-2">
          {/* 위계 이동 버튼 */}
          <button
            onClick={moveUp}
            disabled={getCurrentHierarchy() >= 3}
            className="p-2 rounded-lg flex items-center justify-center bg-white text-gray-600 border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
            title="우선순위 올리기"
          >
            <ChevronUp size={18} />
          </button>
          <button
            onClick={moveDown}
            disabled={getCurrentHierarchy() <= 0}
            className="p-2 rounded-lg flex items-center justify-center bg-white text-gray-600 border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
            title="우선순위 내리기"
          >
            <ChevronDown size={18} />
          </button>

          {/* 완료 */}
          <button
            onClick={toggleComplete}
            className={`p-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-medium
              ${task.status === 'completed'
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-white text-gray-600 border border-gray-200'}`}
            style={{ width: '33.33%' }}
          >
            <Check size={16} />
            {task.status === 'completed' ? '완료됨' : '완료'}
          </button>
        </div>

        {/* 메모 */}
        <div className="bg-white rounded-lg p-3 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">메모</span>
            {hasChecklist && (
              <span className="text-xs text-gray-400">{completedCount}/{checklistItems.length}</span>
            )}
          </div>
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            onBlur={saveMemo}
            placeholder="메모 입력...&#10;[] 체크리스트"
            className="w-full h-32 text-sm resize-none focus:outline-none"
          />
        </div>

        {/* 체크리스트 (있는 경우) */}
        {hasChecklist && (
          <div className="bg-white rounded-lg p-3 border border-gray-100">
            <div className="text-xs text-gray-500 mb-2">체크리스트</div>
            <div className="space-y-1">
              {checklistItems.map((item, idx) => (
                <div 
                  key={idx}
                  onClick={() => toggleChecklist(item.lineIndex, !item.isCompleted)}
                  className="flex items-center gap-2 py-1.5 cursor-pointer"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center
                    ${item.isCompleted ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}
                  >
                    {item.isCompleted && <Check size={12} className="text-white" />}
                  </div>
                  <span className={`text-sm ${item.isCompleted ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 정보 */}
        <div className="bg-white rounded-lg p-3 border border-gray-100">
          <div className="text-xs text-gray-500 mb-2">정보</div>
          <div className="space-y-1 text-xs text-gray-600">
            {task.due_date && (
              <div className="flex justify-between">
                <span>날짜</span>
                <span>{format(parseISO(task.due_date), 'M월 d일', { locale: ko })}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>생성</span>
              <span>{format(parseISO(task.created_at), 'M월 d일 HH:mm', { locale: ko })}</span>
            </div>
            {task.tags && task.tags.length > 0 && (
              <div className="flex justify-between items-center">
                <span>태그</span>
                <div className="flex gap-1">
                  {task.tags.map(tag => (
                    <span key={tag} className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px]">#{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

