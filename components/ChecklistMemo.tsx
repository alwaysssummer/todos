'use client'

import { useState, useRef, useEffect } from 'react'
import { uploadImage, getImageFromClipboard } from '@/utils/imageUpload'

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
  const [isUploading, setIsUploading] = useState(false)
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

  // 이미지 붙여넣기 핸들러
  const handlePaste = async (e: React.ClipboardEvent) => {
    const imageFile = getImageFromClipboard(e.nativeEvent)
    
    if (imageFile) {
      e.preventDefault() // 기본 붙여넣기 방지
      setIsUploading(true)
      
      try {
        const imageUrl = await uploadImage(imageFile)
        
        if (imageUrl) {
          // 현재 커서 위치에 마크다운 이미지 삽입
          const textarea = textareaRef.current
          if (textarea) {
            const start = textarea.selectionStart
            const end = textarea.selectionEnd
            const before = value.substring(0, start)
            const after = value.substring(end)
            const imageMarkdown = `\n![image](${imageUrl})\n`
            const newValue = before + imageMarkdown + after
            onChange(newValue)
            
            // 커서 위치 조정
            setTimeout(() => {
              const newPos = start + imageMarkdown.length
              textarea.setSelectionRange(newPos, newPos)
              textarea.focus()
            }, 0)
          } else {
            // textarea가 없으면 끝에 추가
            const imageMarkdown = `\n![image](${imageUrl})\n`
            onChange(value + imageMarkdown)
          }
        } else {
          alert('이미지 업로드에 실패했습니다.')
        }
      } catch (err) {
        console.error('이미지 붙여넣기 에러:', err)
        alert('이미지 업로드 중 오류가 발생했습니다.')
      } finally {
        setIsUploading(false)
      }
    }
  }

  // 텍스트에서 #태그, [[링크]] 처리
  const renderText = (text: string) => {
    // #태그와 [[링크]] 패턴을 모두 매칭
    const parts = text.split(/(#[\w가-힣]+|\[\[[^\]]+\]\])/g)
    return parts.map((part, i) => {
      // #태그 - 회색으로 표시
      if (part.startsWith('#')) {
        return <span key={i} className="text-gray-400">{part}</span>
      }
      // [[링크]] - 파란색 링크 스타일
      if (part.startsWith('[[') && part.endsWith(']]')) {
        const linkText = part.slice(2, -2)
        return (
          <span 
            key={i} 
            className="text-blue-500 hover:text-blue-600 hover:underline cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              // 링크 클릭 시 검색하거나 해당 노트로 이동하는 로직 추가 가능
              console.log('Link clicked:', linkText)
            }}
          >
            {linkText}
          </span>
        )
      }
      return part
    })
  }

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
          
          // 이미지 라인: ![...](url) 형식
          const imageMatch = trimmedLine.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
          if (imageMatch) {
            const [, alt, src] = imageMatch
            return (
              <div key={index} className="my-2">
                <img 
                  src={src} 
                  alt={alt || 'image'} 
                  className="max-w-full h-auto rounded-lg shadow-sm border border-gray-200 max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    // 이미지 클릭 시 새 창에서 원본 열기
                    const width = 800
                    const height = 600
                    const left = (window.screen.width - width) / 2
                    const top = (window.screen.height - height) / 2
                    window.open(src, '_blank', `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`)
                  }}
                />
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
                {renderText(line)}
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
      <div className={`relative flex flex-col ${className}`}>
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
          onPaste={handlePaste}
          placeholder={placeholder}
          className="w-full h-full p-3 bg-white rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[400px] placeholder-gray-400 text-gray-900 font-mono flex-1"
        />
        {isUploading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              이미지 업로드 중...
            </div>
          </div>
        )}
      </div>
    )
  }

  // 미리보기 모드 (체크박스 렌더링)
  return (
    <div 
      className={`w-full p-3 bg-gray-50 rounded-lg min-h-[400px] cursor-text hover:bg-gray-100 transition-colors overflow-auto ${className}`}
      onClick={() => setIsEditing(true)}
    >
      {renderContent()}
    </div>
  )
}

