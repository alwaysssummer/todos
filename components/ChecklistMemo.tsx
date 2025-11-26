'use client'

import { useState, useRef, useEffect } from 'react'

interface ChecklistMemoProps {
  value: string
  onChange: (value: string) => void
  onSave: (value: string) => void
  placeholder?: string
  className?: string
}

/**
 * 체크리스트 메모 컴포넌트
 * - [] 로 시작하는 라인을 체크박스로 렌더링
 * - 체크박스 클릭 시 [] ↔ [x] 토글
 * - 편집 모드와 미리보기 모드 통합
 */
export default function ChecklistMemo({
  value,
  onChange,
  onSave,
  placeholder = '메모 입력... ([] 로 체크리스트 생성)',
  className = ''
}: ChecklistMemoProps) {
  const [isEditing, setIsEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 편집 모드 진입 시 포커스
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      // 커서를 끝으로 이동
      const len = textareaRef.current.value.length
      textareaRef.current.setSelectionRange(len, len)
    }
  }, [isEditing])

  // 체크박스 토글 핸들러
  const handleCheckboxToggle = (lineIndex: number) => {
    const lines = value.split('\n')
    const line = lines[lineIndex]
    
    if (!line) return
    
    // [] → [x] 또는 [x] → []
    if (line.trim().startsWith('[] ')) {
      lines[lineIndex] = line.replace('[] ', '[x] ')
    } else if (line.trim().startsWith('[x] ') || line.trim().startsWith('[X] ')) {
      lines[lineIndex] = line.replace(/\[[xX]\] /, '[] ')
    }
    
    const newValue = lines.join('\n')
    onChange(newValue)
    onSave(newValue)
  }

  // 라인을 파싱하여 렌더링
  const renderContent = () => {
    if (!value.trim()) {
      return (
        <p 
          className="text-sm text-gray-400 cursor-text"
          onClick={() => setIsEditing(true)}
        >
          {placeholder}
        </p>
      )
    }

    const lines = value.split('\n')
    
    return (
      <div className="space-y-1">
        {lines.map((line, index) => {
          const trimmedLine = line.trim()
          
          // 체크박스 라인: [] 또는 [x]로 시작
          if (trimmedLine.startsWith('[] ')) {
            const text = trimmedLine.substring(3)
            return (
              <div key={index} className="flex items-start gap-2 group">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCheckboxToggle(index)
                  }}
                  className="mt-0.5 w-4 h-4 rounded border-2 border-gray-300 hover:border-blue-500 flex-shrink-0 transition-colors flex items-center justify-center"
                >
                  {/* 빈 체크박스 */}
                </button>
                <span 
                  className="text-sm text-gray-700 flex-1 cursor-text"
                  onClick={() => setIsEditing(true)}
                >
                  {text}
                </span>
              </div>
            )
          }
          
          if (trimmedLine.startsWith('[x] ') || trimmedLine.startsWith('[X] ')) {
            const text = trimmedLine.substring(4)
            return (
              <div key={index} className="flex items-start gap-2 group">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCheckboxToggle(index)
                  }}
                  className="mt-0.5 w-4 h-4 rounded border-2 border-blue-500 bg-blue-500 flex-shrink-0 transition-colors flex items-center justify-center"
                >
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <span 
                  className="text-sm text-gray-400 line-through flex-1 cursor-text"
                  onClick={() => setIsEditing(true)}
                >
                  {text}
                </span>
              </div>
            )
          }
          
          // 일반 텍스트 라인
          if (trimmedLine) {
            return (
              <p 
                key={index} 
                className="text-sm text-gray-700 cursor-text"
                onClick={() => setIsEditing(true)}
              >
                {line}
              </p>
            )
          }
          
          // 빈 라인
          return <div key={index} className="h-4" />
        })}
      </div>
    )
  }

  // 편집 모드
  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          setIsEditing(false)
          onSave(value)
        }}
        onKeyDown={(e) => {
          // Escape로 편집 모드 종료
          if (e.key === 'Escape') {
            setIsEditing(false)
            onSave(value)
          }
        }}
        placeholder={placeholder}
        className={`w-full p-3 bg-white rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[250px] placeholder-gray-400 text-gray-900 font-mono ${className}`}
      />
    )
  }

  // 미리보기 모드 (체크박스 렌더링)
  return (
    <div 
      className={`w-full p-3 bg-gray-50 rounded-lg min-h-[250px] cursor-text hover:bg-gray-100 transition-colors ${className}`}
      onClick={() => setIsEditing(true)}
    >
      {renderContent()}
    </div>
  )
}

