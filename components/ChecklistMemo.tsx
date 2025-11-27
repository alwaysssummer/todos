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
  autoFocus?: boolean  // 자동으로 편집 모드 진입
}

// 파싱된 라인 타입
interface ParsedLine {
  type: 'toggle' | 'checkbox' | 'checkbox-checked' | 'image' | 'text' | 'empty'
  content: string
  indent: number  // 들여쓰기 레벨 (0, 1, 2)
  lineIndex: number
  children?: ParsedLine[]
}

// 토글 상태 관리 (lineIndex 기반)
interface ToggleState {
  [key: string]: boolean  // "lineIndex" -> expanded
}

/**
 * 체크리스트 메모 컴포넌트
 * - [] 로 시작하는 라인을 체크박스로 렌더링
 * - > 로 시작하는 라인을 토글로 렌더링 (2단계 중첩 지원)
 * - Tab/Shift+Tab으로 들여쓰기/내어쓰기
 * - 체크박스 클릭 시 [] ↔ [x] 토글
 * - 편집 모드와 미리보기 모드 통합
 */
export default function ChecklistMemo({
  value,
  onChange,
  onSave,
  placeholder = '메모 입력... ([] 로 체크리스트, > 로 토글 생성)',
  className = '',
  autoFocus = false
}: ChecklistMemoProps) {
  const [isEditing, setIsEditing] = useState(autoFocus)
  const [isUploading, setIsUploading] = useState(false)
  const [toggleStates, setToggleStates] = useState<ToggleState>({})
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

  // 들여쓰기 레벨 계산 (공백 2개 = 1레벨)
  const getIndentLevel = (line: string): number => {
    const match = line.match(/^(\s*)/)
    if (!match) return 0
    return Math.floor(match[1].length / 2)
  }

  // 라인 파싱
  const parseLine = (line: string, lineIndex: number): ParsedLine => {
    const indent = getIndentLevel(line)
    const trimmed = line.trim()

    // 토글: > 로 시작
    if (trimmed.startsWith('> ')) {
      return {
        type: 'toggle',
        content: trimmed.substring(2),
        indent,
        lineIndex
      }
    }

    // 체크박스 (미완료): [] 로 시작
    if (trimmed.startsWith('[] ')) {
      return {
        type: 'checkbox',
        content: trimmed.substring(3),
        indent,
        lineIndex
      }
    }

    // 체크박스 (완료): [x] 또는 [X] 로 시작
    if (trimmed.startsWith('[x] ') || trimmed.startsWith('[X] ')) {
      return {
        type: 'checkbox-checked',
        content: trimmed.substring(4),
        indent,
        lineIndex
      }
    }

    // 이미지: ![...](url) 형식
    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (imageMatch) {
      return {
        type: 'image',
        content: trimmed,
        indent,
        lineIndex
      }
    }

    // 빈 라인
    if (!trimmed) {
      return {
        type: 'empty',
        content: '',
        indent,
        lineIndex
      }
    }

    // 일반 텍스트
    return {
      type: 'text',
      content: line,
      indent,
      lineIndex
    }
  }

  // 라인들을 토글 구조로 그룹화 (2단계 중첩 지원)
  const parseLines = (lines: string[]): ParsedLine[] => {
    const result: ParsedLine[] = []
    let i = 0

    while (i < lines.length) {
      const parsed = parseLine(lines[i], i)

      // 1단계 토글 발견
      if (parsed.type === 'toggle' && parsed.indent === 0) {
        const toggleItem: ParsedLine = { ...parsed, children: [] }
        i++

        // 토글 내부 컨텐츠 수집 (indent > 0)
        while (i < lines.length) {
          const childParsed = parseLine(lines[i], i)
          
          // 들여쓰기가 없으면 토글 종료
          if (childParsed.indent === 0 && lines[i].trim() !== '') {
            break
          }

          // 2단계 토글 발견 (indent === 1)
          if (childParsed.type === 'toggle' && childParsed.indent === 1) {
            const nestedToggle: ParsedLine = { ...childParsed, children: [] }
            i++

            // 2단계 토글 내부 컨텐츠 수집 (indent >= 2)
            while (i < lines.length) {
              const grandChildParsed = parseLine(lines[i], i)
              
              // 들여쓰기가 2 미만이면 중첩 토글 종료
              if (grandChildParsed.indent < 2 && lines[i].trim() !== '') {
                break
              }

              nestedToggle.children!.push(grandChildParsed)
              i++
            }

            toggleItem.children!.push(nestedToggle)
          } else {
            toggleItem.children!.push(childParsed)
            i++
          }
        }

        result.push(toggleItem)
      } else {
        result.push(parsed)
        i++
      }
    }

    return result
  }

  // 토글 상태 변경
  const handleToggleClick = (lineIndex: number) => {
    setToggleStates(prev => ({
      ...prev,
      [lineIndex]: !prev[lineIndex]
    }))
  }

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

  // Tab/Shift+Tab 핸들러
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Escape로 편집 모드 종료
    if (e.key === 'Escape') {
      setIsEditing(false)
      onSave(value)
      return
    }

    // Tab 키 처리
    if (e.key === 'Tab') {
      e.preventDefault()
      
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const lines = value.split('\n')
      
      // 현재 커서가 있는 라인 찾기
      let charCount = 0
      let startLineIndex = 0
      let endLineIndex = 0
      
      for (let i = 0; i < lines.length; i++) {
        const lineEnd = charCount + lines[i].length + 1 // +1 for newline
        if (charCount <= start && start <= charCount + lines[i].length) {
          startLineIndex = i
        }
        if (charCount <= end && end <= charCount + lines[i].length) {
          endLineIndex = i
          break
        }
        charCount = lineEnd
      }

      // 선택된 라인들 처리
      const newLines = [...lines]
      let offsetChange = 0

      for (let i = startLineIndex; i <= endLineIndex; i++) {
        if (e.shiftKey) {
          // Shift+Tab: 들여쓰기 제거 (공백 2개 제거)
          if (newLines[i].startsWith('  ')) {
            newLines[i] = newLines[i].substring(2)
            offsetChange -= 2
          }
        } else {
          // Tab: 들여쓰기 추가 (공백 2개 추가)
          newLines[i] = '  ' + newLines[i]
          offsetChange += 2
        }
      }

      const newValue = newLines.join('\n')
      onChange(newValue)

      // 커서 위치 조정
      setTimeout(() => {
        const newStart = Math.max(0, start + (e.shiftKey ? -2 : 2))
        const newEnd = Math.max(0, end + offsetChange)
        textarea.setSelectionRange(newStart, newEnd)
      }, 0)
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
    
    // 들여쓰기 보존하면서 [] ↔ [x] 토글
    const indent = line.match(/^(\s*)/)?.[1] || ''
    const trimmed = line.trim()
    
    if (trimmed.startsWith('[] ')) {
      lines[lineIndex] = indent + '[x] ' + trimmed.substring(3)
    } else if (trimmed.startsWith('[x] ') || trimmed.startsWith('[X] ')) {
      lines[lineIndex] = indent + '[] ' + trimmed.substring(4)
    }
    
    const newValue = lines.join('\n')
    onChange(newValue)
    onSave(newValue)
  }

  // 체크박스 렌더링
  const renderCheckbox = (item: ParsedLine, indentClass: string) => {
    const isChecked = item.type === 'checkbox-checked'
    return (
      <div key={item.lineIndex} className={`flex items-start gap-2 group ${indentClass}`}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleCheckboxToggle(item.lineIndex)
          }}
          className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 transition-colors flex items-center justify-center ${
            isChecked 
              ? 'border-blue-500 bg-blue-500' 
              : 'border-gray-300 hover:border-blue-500'
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
          {renderText(item.content)}
        </span>
      </div>
    )
  }

  // 이미지 렌더링
  const renderImage = (item: ParsedLine, indentClass: string) => {
    const imageMatch = item.content.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (!imageMatch) return null
    
    const [, alt, src] = imageMatch
    return (
      <div key={item.lineIndex} className={`my-2 ${indentClass}`}>
        <img 
          src={src} 
          alt={alt || 'image'} 
          className="max-w-full h-auto rounded-lg shadow-sm border border-gray-200 max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
          onClick={(e) => {
            e.stopPropagation()
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

  // 토글 렌더링 (재귀적으로 중첩 토글 지원)
  const renderToggle = (item: ParsedLine, level: number = 0) => {
    const isExpanded = toggleStates[item.lineIndex] ?? false
    const indentClass = level === 0 ? '' : level === 1 ? 'ml-4' : 'ml-8'
    
    return (
      <div key={item.lineIndex} className={indentClass}>
        {/* 토글 헤더 */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleToggleClick(item.lineIndex)
          }}
          className="flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900 transition-colors py-0.5 w-full text-left"
        >
          {isExpanded ? (
            <ChevronDown size={16} className="text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRight size={16} className="text-gray-500 flex-shrink-0" />
          )}
          <span className="font-medium">{renderText(item.content)}</span>
        </button>
        
        {/* 토글 내용 (펼쳐진 경우만) */}
        {isExpanded && item.children && item.children.length > 0 && (
          <div className="ml-5 border-l-2 border-gray-200 pl-3 py-1 space-y-1">
            {item.children.map(child => renderParsedItem(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  // 파싱된 아이템 렌더링
  const renderParsedItem = (item: ParsedLine, level: number = 0): React.ReactNode => {
    const indentClass = level === 0 ? '' : level === 1 ? '' : '' // 토글 내부는 이미 들여쓰기됨

    switch (item.type) {
      case 'toggle':
        return renderToggle(item, level)
      case 'checkbox':
      case 'checkbox-checked':
        return renderCheckbox(item, indentClass)
      case 'image':
        return renderImage(item, indentClass)
      case 'empty':
        return <div key={item.lineIndex} className="h-4" />
      case 'text':
      default:
        return (
          <p 
            key={item.lineIndex} 
            className={`text-sm text-gray-700 cursor-text ${indentClass}`}
            onClick={() => setIsEditing(true)}
          >
            {renderText(item.content)}
          </p>
        )
    }
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
    const parsedLines = parseLines(lines)
    
    return (
      <div className="space-y-1">
        {parsedLines.map(item => renderParsedItem(item))}
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
          Tab: 들여쓰기 | Shift+Tab: 내어쓰기 | Esc: 저장
        </div>
      </div>
    )
  }

  // 미리보기 모드 (체크박스 + 토글 렌더링)
  return (
    <div 
      className={`w-full p-3 bg-gray-50 rounded-lg min-h-[400px] cursor-text hover:bg-gray-100 transition-colors overflow-auto ${className}`}
      onClick={() => setIsEditing(true)}
    >
      {renderContent()}
    </div>
  )
}
