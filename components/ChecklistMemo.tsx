'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { uploadImage, getImageFromClipboard } from '@/utils/imageUpload'

interface ChecklistMemoProps {
  value: string
  onChange: (value: string) => void
  onSave: (value: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

// 파싱된 블록 타입
type BlockType = 'toggle' | 'checkbox' | 'checkbox-checked' | 'image' | 'text' | 'empty'

interface ParsedBlock {
  type: BlockType
  content: string
  children?: ParsedBlock[]
  id: string // 고유 ID (토글 상태 관리용)
}

/**
 * 체크리스트 메모 컴포넌트
 * 
 * 지원 문법:
 * - [] 항목     : 체크박스 (미완료)
 * - [x] 항목    : 체크박스 (완료)
 * - >>> 제목   : 토글 시작
 * - <<<        : 토글 끝
 * - ![alt](url): 이미지
 * - #태그      : 태그 (회색)
 * - [[링크]]   : 내부 링크 (파란색)
 * 
 * 서식 단축키:
 * - Ctrl+B     : **굵게**
 * - Ctrl+U     : __밑줄__
 */
export default function ChecklistMemo({
  value,
  onChange,
  onSave,
  placeholder = '메모 입력... ([] 체크리스트, >>> 토글)',
  className = '',
  autoFocus = false
}: ChecklistMemoProps) {
  const [isEditing, setIsEditing] = useState(autoFocus)
  const [isUploading, setIsUploading] = useState(false)
  const [expandedToggles, setExpandedToggles] = useState<Set<string>>(new Set())
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      const len = textareaRef.current.value.length
      textareaRef.current.setSelectionRange(len, len)
    }
  }, [isEditing])

  // ========== 파싱 로직 ==========
  
  const parseBlocks = (text: string): ParsedBlock[] => {
    const lines = text.split('\n')
    const result: ParsedBlock[] = []
    let i = 0
    let toggleCounter = 0

    const parseUntilEnd = (depth: number): ParsedBlock[] => {
      const blocks: ParsedBlock[] = []
      
      while (i < lines.length) {
        const line = lines[i]
        const trimmed = line.trim()

        // 토글 끝
        if (trimmed === '<<<') {
          i++
          return blocks
        }

        // 토글 시작
        if (trimmed.startsWith('>>> ')) {
          const title = trimmed.substring(4)
          const toggleId = `toggle-${toggleCounter++}`
          i++
          const children = parseUntilEnd(depth + 1)
          blocks.push({
            type: 'toggle',
            content: title,
            children,
            id: toggleId
          })
          continue
        }

        // 체크박스 (미완료)
        if (trimmed.startsWith('[] ')) {
          blocks.push({
            type: 'checkbox',
            content: trimmed.substring(3),
            id: `line-${i}`
          })
          i++
          continue
        }

        // 체크박스 (완료)
        if (trimmed.startsWith('[x] ') || trimmed.startsWith('[X] ')) {
          blocks.push({
            type: 'checkbox-checked',
            content: trimmed.substring(4),
            id: `line-${i}`
          })
          i++
          continue
        }

        // 이미지
        const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
        if (imageMatch) {
          blocks.push({
            type: 'image',
            content: trimmed,
            id: `line-${i}`
          })
          i++
          continue
        }

        // 빈 줄
        if (!trimmed) {
          blocks.push({
            type: 'empty',
            content: '',
            id: `line-${i}`
          })
          i++
          continue
        }

        // 일반 텍스트
        blocks.push({
          type: 'text',
          content: line,
          id: `line-${i}`
        })
        i++
      }

      return blocks
    }

    return parseUntilEnd(0)
  }

  // ========== 토글 상태 관리 ==========

  const toggleExpand = (id: string) => {
    setExpandedToggles(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // ========== 체크박스 토글 ==========

  const handleCheckboxToggle = (lineContent: string, isChecked: boolean) => {
    const lines = value.split('\n')
    const searchPattern = isChecked ? `[x] ${lineContent}` : `[] ${lineContent}`
    const replacePattern = isChecked ? `[] ${lineContent}` : `[x] ${lineContent}`
    
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim()
      if (trimmed === searchPattern || trimmed.toLowerCase() === searchPattern.toLowerCase()) {
        lines[i] = lines[i].replace(
          isChecked ? /\[x\] /i : /\[\] /,
          isChecked ? '[] ' : '[x] '
        )
        break
      }
    }
    
    const newValue = lines.join('\n')
    onChange(newValue)
    onSave(newValue)
  }

  // ========== 서식 단축키 처리 ==========

  const applyFormat = (marker: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)
    
    // 이미 마커가 있는지 확인 (토글 기능)
    const markerLen = marker.length
    const beforeMarker = value.substring(start - markerLen, start)
    const afterMarker = value.substring(end, end + markerLen)
    
    let newValue: string
    let newCursorStart: number
    let newCursorEnd: number
    
    if (beforeMarker === marker && afterMarker === marker) {
      // 마커 제거 (토글 OFF)
      newValue = value.substring(0, start - markerLen) + selectedText + value.substring(end + markerLen)
      newCursorStart = start - markerLen
      newCursorEnd = end - markerLen
    } else if (selectedText) {
      // 선택된 텍스트에 마커 적용
      newValue = value.substring(0, start) + marker + selectedText + marker + value.substring(end)
      newCursorStart = start + markerLen
      newCursorEnd = end + markerLen
    } else {
      // 선택 없으면 빈 마커 삽입 후 커서를 가운데로
      newValue = value.substring(0, start) + marker + marker + value.substring(end)
      newCursorStart = start + markerLen
      newCursorEnd = start + markerLen
    }
    
    onChange(newValue)
    
    // 커서 위치 복원
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(newCursorStart, newCursorEnd)
    }, 0)
  }

  // ========== 텍스트 렌더링 (태그, 링크, 서식) ==========

  // 알려진 TLD 목록 (주요 도메인 확장자)
  const knownTLDs = ['com', 'net', 'org', 'io', 'app', 'dev', 'co', 'kr', 'jp', 'cn', 'uk', 'de', 'fr', 'ai', 'me', 'tv', 'gg', 'xyz', 'so', 'to', 'cc', 'ly', 'in', 'us', 'ca', 'au', 'ru', 'br', 'it', 'es', 'nl', 'be', 'ch', 'at', 'pl', 'se', 'no', 'fi', 'dk', 'pt', 'gr', 'cz', 'hu', 'ro', 'bg', 'sk', 'ua', 'tw', 'hk', 'sg', 'my', 'th', 'vn', 'id', 'ph', 'nz', 'za', 'mx', 'ar', 'cl', 'pe', 'co', 've', 'ec', 'edu', 'gov', 'mil', 'int', 'info', 'biz', 'name', 'pro', 'mobi', 'asia', 'tel', 'jobs', 'travel', 'museum', 'coop', 'aero', 'cat', 'post']
  
  // TLD 패턴 생성 (동적으로)
  const tldPattern = knownTLDs.join('|')
  
  // URL 패턴: http(s)://, www., 또는 알려진 TLD로 끝나는 도메인
  const urlRegex = new RegExp(
    `(https?:\\/\\/[^\\s]+|www\\.[^\\s]+|[a-zA-Z0-9][a-zA-Z0-9-]*\\.[a-zA-Z0-9-]*(\\.(${tldPattern}))[^\\s]*)`,
    'gi'
  )

  const renderText = (text: string): React.ReactNode => {
    // 서식 마커 + 기존 패턴을 한번에 매칭
    const combinedPattern = new RegExp(
      `(\\*\\*[^*]+\\*\\*|__[^_]+__|#[\\w가-힣]+|\\[\\[[^\\]]+\\]\\]|https?:\\/\\/[^\\s]+|www\\.[^\\s]+|[a-zA-Z0-9][a-zA-Z0-9-]*(?:\\.[a-zA-Z0-9-]+)*\\.(?:${tldPattern})(?:\\/[^\\s]*)?)`,
      'gi'
    )
    
    const parts = text.split(combinedPattern)
    
    return parts.map((part, i) => {
      if (!part) return null
      
      // **굵게**
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        const inner = part.slice(2, -2)
        return <strong key={i} className="font-bold">{renderText(inner)}</strong>
      }
      
      // __밑줄__
      if (part.startsWith('__') && part.endsWith('__') && part.length > 4) {
        const inner = part.slice(2, -2)
        return <u key={i}>{renderText(inner)}</u>
      }
      
      // #태그
      if (part.startsWith('#') && /^#[\w가-힣]+$/.test(part)) {
        return <span key={i} className="text-gray-400">{part}</span>
      }
      
      // [[내부 링크]]
      if (part.startsWith('[[') && part.endsWith(']]')) {
        const linkText = part.slice(2, -2)
        return (
          <span 
            key={i} 
            className="text-blue-500 hover:text-blue-600 hover:underline cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              console.log('Internal link:', linkText)
            }}
          >
            {linkText}
          </span>
        )
      }
      
      // 웹 링크 (http://, https://, www., 또는 알려진 TLD 도메인)
      const isUrl = /^https?:\/\//i.test(part) || 
                    /^www\./i.test(part) || 
                    new RegExp(`^[a-zA-Z0-9][a-zA-Z0-9-]*(?:\\.[a-zA-Z0-9-]+)*\\.(?:${tldPattern})(?:\\/|$)`, 'i').test(part)
      
      if (isUrl) {
        // URL 정규화: www.나 도메인만 있으면 https:// 추가
        let url = part
        if (!url.match(/^https?:\/\//i)) {
          url = 'https://' + url
        }
        
        return (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 underline"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        )
      }
      
      return part
    })
  }

  // ========== 블록 렌더링 ==========

  const renderBlock = (block: ParsedBlock): React.ReactNode => {
    switch (block.type) {
      case 'toggle': {
        const isExpanded = expandedToggles.has(block.id)
        return (
          <div key={block.id} className="my-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                toggleExpand(block.id)
              }}
              className="flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900 py-0.5 w-full text-left"
            >
              {isExpanded ? (
                <ChevronDown size={16} className="text-gray-500 flex-shrink-0" />
              ) : (
                <ChevronRight size={16} className="text-gray-500 flex-shrink-0" />
              )}
              <span className="font-medium">{renderText(block.content)}</span>
            </button>
            {isExpanded && block.children && block.children.length > 0 && (
              <div className="ml-5 border-l-2 border-gray-200 pl-3 py-1 space-y-1">
                {block.children.map(renderBlock)}
              </div>
            )}
          </div>
        )
      }

      case 'checkbox':
      case 'checkbox-checked': {
        const isChecked = block.type === 'checkbox-checked'
        return (
          <div key={block.id} className="flex items-start gap-2 group">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleCheckboxToggle(block.content, isChecked)
              }}
              className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 transition-colors flex items-center justify-center ${
                isChecked ? 'border-blue-500 bg-blue-500' : 'border-gray-300 hover:border-blue-500'
              }`}
            >
              {isChecked && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <span 
              className={`text-sm flex-1 cursor-text ${isChecked ? 'text-gray-400 line-through' : 'text-gray-700'}`}
              onClick={() => setIsEditing(true)}
            >
              {renderText(block.content)}
            </span>
          </div>
        )
      }

      case 'image': {
        const imageMatch = block.content.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
        if (!imageMatch) return null
        const [, alt, src] = imageMatch
        return (
          <div key={block.id} className="my-2">
            <img 
              src={src} 
              alt={alt || 'image'} 
              className="max-w-full h-auto rounded-lg shadow-sm border border-gray-200 max-h-64 object-contain cursor-pointer hover:opacity-90"
              onClick={(e) => {
                e.stopPropagation()
                window.open(src, '_blank', 'width=800,height=600,resizable=yes,scrollbars=yes')
              }}
            />
          </div>
        )
      }

      case 'empty':
        return <div key={block.id} className="h-4" />

      case 'text':
      default:
        return (
          <p key={block.id} className="text-sm text-gray-700 cursor-text" onClick={() => setIsEditing(true)}>
            {renderText(block.content)}
          </p>
        )
    }
  }

  // ========== 키보드 핸들러 ==========

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Escape: 저장 후 편집 종료
    if (e.key === 'Escape') {
      setIsEditing(false)
      onSave(value)
      return
    }
    
    // Ctrl+B: 굵게 **
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'b') {
      e.preventDefault()
      applyFormat('**')
      return
    }
    
    // Ctrl+U: 밑줄 __
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'u') {
      e.preventDefault()
      applyFormat('__')
      return
    }
  }

  // ========== 이미지 붙여넣기 ==========

  const handlePaste = async (e: React.ClipboardEvent) => {
    const imageFile = getImageFromClipboard(e.nativeEvent)
    if (!imageFile) return

    e.preventDefault()
    setIsUploading(true)
    
    try {
      const imageUrl = await uploadImage(imageFile)
      if (imageUrl) {
        const textarea = textareaRef.current
        if (textarea) {
          const start = textarea.selectionStart
          const before = value.substring(0, start)
          const after = value.substring(textarea.selectionEnd)
          const imageMarkdown = `\n![image](${imageUrl})\n`
          onChange(before + imageMarkdown + after)
        } else {
          onChange(value + `\n![image](${imageUrl})\n`)
        }
      }
    } catch (err) {
      console.error('이미지 업로드 에러:', err)
      alert('이미지 업로드 실패')
    } finally {
      setIsUploading(false)
    }
  }

  // ========== 렌더링 ==========

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
          onKeyDown={handleKeyDown}
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
        <div className="absolute bottom-2 right-2 text-xs text-gray-400">
          Esc: 저장 | Ctrl+B: 굵게 | Ctrl+U: 밑줄
        </div>
      </div>
    )
  }

  const blocks = parseBlocks(value)

  return (
    <div 
      className={`w-full p-3 bg-gray-50 rounded-lg min-h-[400px] cursor-text hover:bg-gray-100 transition-colors overflow-auto ${className}`}
      onClick={() => setIsEditing(true)}
    >
      {!value.trim() ? (
        <p className="text-sm text-gray-400">{placeholder}</p>
      ) : (
        <div className="space-y-1">
          {blocks.map(renderBlock)}
        </div>
      )}
    </div>
  )
}
