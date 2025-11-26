'use client'

import { useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, X, ExternalLink, GripVertical, Pencil } from 'lucide-react'
import type { NotionLink } from '@/types/database'

interface SortableNotionLinkProps {
  link: NotionLink
  onUpdate: (id: string, updates: Partial<NotionLink>) => void
  onDelete: (id: string) => void
}

export default function SortableNotionLink({ link, onUpdate, onDelete }: SortableNotionLinkProps) {
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

