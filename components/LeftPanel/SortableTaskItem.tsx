'use client'

import { useState, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, Pencil, FileText } from 'lucide-react'
import type { Task } from '@/types/database'
import { parseChecklistFromMemo } from '@/utils/checklistParser'

interface SortableTaskItemProps {
  id?: string
  task: Task
  onClick: (e: React.MouseEvent) => void
  onToggleComplete: (e: React.MouseEvent) => void
  isInbox?: boolean
  isCompleting?: boolean
  subtasks?: Task[]
  onSubtaskToggle?: (subtask: Task) => void
  onChecklistToggle?: (task: Task, lineIndex: number, newCompleted: boolean) => void
  isExpanded?: boolean
  onToggleExpand?: (taskId: string) => void
  onConvertType?: (task: Task, newType: 'task' | 'note') => void
}

export default function SortableTaskItem({ 
  id, 
  task, 
  onClick, 
  onToggleComplete, 
  isInbox = false, 
  isCompleting = false, 
  subtasks = [], 
  onSubtaskToggle, 
  onChecklistToggle, 
  isExpanded = false, 
  onToggleExpand, 
  onConvertType 
}: SortableTaskItemProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null)
  
  // 우클릭 컨텍스트 메뉴
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  // 컨텍스트 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null)
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenu])

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

  const isNote = task.type === 'note'

  return (
    <div className="flex flex-col relative">
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={onClick}
        onContextMenu={handleContextMenu}
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
                  : isNote
                    ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
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

      {/* 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClick(e)
              setContextMenu(null)
            }}
            className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <Pencil size={14} />
            수정
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onConvertType?.(task, isNote ? 'task' : 'note')
              setContextMenu(null)
            }}
            className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            {isNote ? (
              <>
                <Check size={14} />
                테스크로 전환
              </>
            ) : (
              <>
                <FileText size={14} />
                노트로 전환
              </>
            )}
          </button>
          <div className="border-t border-gray-100 my-1" />
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleComplete(e)
              setContextMenu(null)
            }}
            className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <Check size={14} />
            {isCompleted ? '미완료로 변경' : '완료 처리'}
          </button>
        </div>
      )}
    </div>
  )
}

