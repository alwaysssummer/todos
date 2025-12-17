'use client'

import { useState, useRef, useEffect } from 'react'
import { GripVertical } from 'lucide-react'
import { uploadImage, getImageFromClipboard } from '@/utils/imageUpload'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface ChecklistMemoProps {
  value: string
  onChange: (value: string) => void
  onSave: (value: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  mode?: 'view' | 'edit' // 외부에서 모드 제어 (탭용)
  onModeChange?: (mode: 'view' | 'edit') => void
}

// 파싱된 블록 타입
type BlockType = 'toggle' | 'checkbox' | 'checkbox-checked' | 'image' | 'text' | 'empty' | 'number-1' | 'number-2' | 'number-3'

interface ParsedBlock {
  type: BlockType
  content: string
  children?: ParsedBlock[]
  id: string // 고유 ID (토글 상태 관리용)
  number?: number // 넘버링 숫자
  indent?: number // 들여쓰기 레벨
}

// 블록 그룹 (빈 줄로 구분된 단위)
interface BlockGroup {
  id: string
  blocks: ParsedBlock[]
  rawText: string // 원본 텍스트 (재구성용)
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
  autoFocus = false,
  mode,
  onModeChange
}: ChecklistMemoProps) {
  // 외부에서 mode가 제공되면 외부 제어, 아니면 내부 state 사용
  const [internalMode, setInternalMode] = useState<'view' | 'edit'>(autoFocus ? 'edit' : 'view')
  const [isUploading, setIsUploading] = useState(false)
  const [expandedToggles, setExpandedToggles] = useState<Set<string>>(new Set())
  const [blockGroups, setBlockGroups] = useState<BlockGroup[]>([])
  const [targetCursorPos, setTargetCursorPos] = useState<number | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 드래그 앤 드롭 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 실제 사용할 모드 (외부 제어 우선)
  const currentMode = mode !== undefined ? mode : internalMode
  const isEditing = currentMode === 'edit'

  // 모드 변경 함수
  const setMode = (newMode: 'view' | 'edit') => {
    if (onModeChange) {
      onModeChange(newMode)
    } else {
      setInternalMode(newMode)
    }
  }

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const textarea = textareaRef.current
      textarea.focus()
      
      // 타겟 커서 위치가 있으면 그 위치로, 없으면 끝으로
      if (targetCursorPos !== null) {
        textarea.setSelectionRange(targetCursorPos, targetCursorPos)
        setTargetCursorPos(null)
        
        // 커서 위치로 스크롤 조정
        setTimeout(() => {
          if (textarea) {
            // 커서가 있는 줄의 대략적인 위치 계산
            const textBeforeCursor = textarea.value.substring(0, targetCursorPos)
            const linesBefore = textBeforeCursor.split('\n').length
            const lineHeight = 20 // 대략적인 줄 높이 (text-sm)
            const cursorY = linesBefore * lineHeight
            
            // textarea의 보이는 영역 높이
            const viewportHeight = textarea.clientHeight
            
            // 커서가 화면 하단 30% 이하에 있으면 스크롤
            const scrollThreshold = viewportHeight * 0.7
            
            if (cursorY > textarea.scrollTop + scrollThreshold) {
              // 커서를 화면 중앙에 위치시키도록 스크롤
              textarea.scrollTop = cursorY - viewportHeight / 2
            } else if (cursorY < textarea.scrollTop) {
              // 커서가 화면 위쪽에 있으면 위로 스크롤
              textarea.scrollTop = Math.max(0, cursorY - 100)
            }
          }
        }, 0)
      } else {
        const len = textarea.value.length
        textarea.setSelectionRange(len, len)
      }
    }
  }, [isEditing, targetCursorPos])

  // 블록 그룹 초기화
  useEffect(() => {
    const groups = parseBlockGroups(value)
    setBlockGroups(groups)
  }, [value])

  // 드래그 종료 핸들러
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setBlockGroups((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        
        const newItems = arrayMove(items, oldIndex, newIndex)
        
        // textarea 텍스트 동기화 (다음 틱에 실행)
        setTimeout(() => {
          // 체크박스는 줄바꿈만, 일반 블록은 빈 줄로 구분
          const newText = newItems.map((group, idx) => {
            if (idx === 0) return group.rawText
            
            const prevGroup = newItems[idx - 1]
            const isCurrentCheckbox = group.rawText.trim().startsWith('[')
            const isPrevCheckbox = prevGroup.rawText.trim().startsWith('[')
            
            // 둘 다 체크박스면 줄바꿈 하나만
            if (isCurrentCheckbox && isPrevCheckbox) {
              return '\n' + group.rawText
            }
            
            // 그 외는 빈 줄 추가
            return '\n\n' + group.rawText
          }).join('')
          
          onChange(newText)
        }, 0)
        
        return newItems
      })
    }
  }

  // ========== 파싱 로직 ==========
  
  // 블록 그룹 생성 (체크박스는 개별, 토글은 통합, 나머지는 빈 줄 기준)
  const parseBlockGroups = (text: string): BlockGroup[] => {
    const lines = text.split('\n')
    const groups: BlockGroup[] = []
    let i = 0
    let groupIndex = 0

    while (i < lines.length) {
      const line = lines[i]
      const trimmed = line.trim()

      // 1. 넘버링 리스트 (개별 블록)
      // 1단계: 1. 2. 3.
      const number1Match = trimmed.match(/^(\d+)\.\s+(.*)$/)
      if (number1Match) {
        groups.push({
          id: `group-${groupIndex++}`,
          blocks: parseBlocks(line),
          rawText: line
        })
        i++
        continue
      }

      // 2단계: 1) 2) 3)
      const number2Match = trimmed.match(/^(\d+)\)\s+(.*)$/)
      if (number2Match) {
        groups.push({
          id: `group-${groupIndex++}`,
          blocks: parseBlocks(line),
          rawText: line
        })
        i++
        continue
      }

      // 3단계: ① ② ③
      const number3Match = trimmed.match(/^([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])\s+(.*)$/)
      if (number3Match) {
        groups.push({
          id: `group-${groupIndex++}`,
          blocks: parseBlocks(line),
          rawText: line
        })
        i++
        continue
      }

      // 2. 체크박스는 항상 개별 블록
      if (trimmed.startsWith('[] ') || trimmed.startsWith('[x] ') || trimmed.startsWith('[X] ')) {
        groups.push({
          id: `group-${groupIndex++}`,
          blocks: parseBlocks(line),
          rawText: line
        })
        i++
        continue
      }

      // 2. 토글은 >>> ~ <<< 전체를 하나의 블록으로
      if (trimmed.startsWith('>>> ') || trimmed === '>>>') {
        const startIndex = i
        i++ // >>> 다음 줄로
        
        // <<< 를 찾을 때까지 수집
        while (i < lines.length && lines[i].trim() !== '<<<') {
          i++
        }
        
        // <<< 포함
        if (i < lines.length) {
          i++
        }
        
        const toggleText = lines.slice(startIndex, i).join('\n')
        groups.push({
          id: `group-${groupIndex++}`,
          blocks: parseBlocks(toggleText),
          rawText: toggleText
        })
        continue
      }

      // 3. 빈 줄은 건너뛰기
      if (!trimmed) {
        i++
        continue
      }

      // 4. 일반 텍스트는 빈 줄까지 수집
      const startIndex = i
      while (i < lines.length) {
        const currentTrimmed = lines[i].trim()
        
        // 빈 줄을 만나면 중단
        if (!currentTrimmed) {
          break
        }
        
        // 체크박스, 토글, 넘버링을 만나면 중단
        if (currentTrimmed.startsWith('[] ') || 
            currentTrimmed.startsWith('[x] ') || 
            currentTrimmed.startsWith('[X] ') ||
            currentTrimmed.startsWith('>>> ') ||
            currentTrimmed === '>>>' ||
            /^\d+\.\s/.test(currentTrimmed) ||
            /^\d+\)\s/.test(currentTrimmed) ||
            /^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]\s/.test(currentTrimmed)) {
          break
        }
        
        i++
      }
      
      const textBlock = lines.slice(startIndex, i).join('\n')
      if (textBlock.trim()) {
        groups.push({
          id: `group-${groupIndex++}`,
          blocks: parseBlocks(textBlock),
          rawText: textBlock
        })
      }
    }

    return groups
  }

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

        // 토글 시작 (제목 있음)
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

        // 토글 시작 (제목 없음)
        if (trimmed === '>>>') {
          const toggleId = `toggle-${toggleCounter++}`
          i++
          const children = parseUntilEnd(depth + 1)
          blocks.push({
            type: 'toggle',
            content: '', // 제목 없음
            children,
            id: toggleId
          })
          continue
        }

        // 넘버링 1단계: 1. 2. 3.
        const number1Match = trimmed.match(/^(\d+)\.\s+(.*)$/)
        if (number1Match) {
          const indent = line.length - line.trimStart().length
          blocks.push({
            type: 'number-1',
            content: number1Match[2],
            number: parseInt(number1Match[1]),
            indent,
            id: `line-${i}`
          })
          i++
          continue
        }

        // 넘버링 2단계: 1) 2) 3)
        const number2Match = trimmed.match(/^(\d+)\)\s+(.*)$/)
        if (number2Match) {
          const indent = line.length - line.trimStart().length
          blocks.push({
            type: 'number-2',
            content: number2Match[2],
            number: parseInt(number2Match[1]),
            indent,
            id: `line-${i}`
          })
          i++
          continue
        }

        // 넘버링 3단계: ① ② ③
        const circledNumbers = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'
        const number3Match = trimmed.match(/^([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])\s+(.*)$/)
        if (number3Match) {
          const indent = line.length - line.trimStart().length
          const circledChar = number3Match[1]
          const number = circledNumbers.indexOf(circledChar) + 1
          blocks.push({
            type: 'number-3',
            content: number3Match[2],
            number,
            indent,
            id: `line-${i}`
          })
          i++
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

  // ========== 블록 클릭 핸들러 ==========

  // 블록 그룹의 텍스트 시작 위치 계산
  const getBlockGroupTextPosition = (groupId: string): number => {
    let position = 0
    for (const group of blockGroups) {
      if (group.id === groupId) {
        return position
      }
      position += group.rawText.length
      
      // 다음 그룹과의 구분자 계산
      const nextGroupIndex = blockGroups.indexOf(group) + 1
      if (nextGroupIndex < blockGroups.length) {
        const nextGroup = blockGroups[nextGroupIndex]
        const isCurrentCheckbox = group.rawText.trim().startsWith('[')
        const isNextCheckbox = nextGroup.rawText.trim().startsWith('[')
        
        // 둘 다 체크박스면 줄바꿈 하나만
        if (isCurrentCheckbox && isNextCheckbox) {
          position += 1
        } else {
          position += 2 // 빈 줄
        }
      }
    }
    return position
  }

  // 블록 클릭 시 편집 모드로 전환
  const handleBlockClick = (groupId: string) => {
    const position = getBlockGroupTextPosition(groupId)
    setTargetCursorPos(position)
    setMode('edit')
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
                <svg width="16" height="16" viewBox="0 0 16 16" className="text-gray-700 flex-shrink-0">
                  <path d="M3 6 L8 11 L13 6" fill="currentColor" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" className="text-gray-700 flex-shrink-0">
                  <path d="M6 3 L11 8 L6 13" fill="currentColor" />
                </svg>
              )}
              <span className="font-medium">
                {block.content ? renderText(block.content) : <span className="text-gray-400">토글</span>}
              </span>
            </button>
            {isExpanded && block.children && block.children.length > 0 && (
              <div className="ml-5 border-l-2 border-gray-200 pl-3 py-1 space-y-1">
                {block.children.map(renderBlock)}
              </div>
            )}
          </div>
        )
      }

      case 'number-1':
      case 'number-2':
      case 'number-3': {
        const circledNumbers = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'
        let numberPrefix = ''
        
        if (block.type === 'number-1') {
          numberPrefix = `${block.number}.`
        } else if (block.type === 'number-2') {
          numberPrefix = `${block.number})`
        } else if (block.type === 'number-3' && block.number) {
          numberPrefix = circledNumbers[block.number - 1] || `${block.number}`
        }

        const indentStyle = block.indent ? { paddingLeft: `${block.indent}px` } : {}

        return (
          <div key={block.id} className="flex items-start gap-2 text-sm text-gray-700" style={indentStyle}>
            <span className="font-medium text-gray-600 select-none min-w-[2rem]">{numberPrefix}</span>
            <span className="flex-1 cursor-text">
              {renderText(block.content)}
            </span>
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
          <p key={block.id} className="text-sm text-gray-700 cursor-text">
            {renderText(block.content)}
          </p>
        )
    }
  }

  // ========== 키보드 핸들러 ==========

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Escape: 저장 후 편집 종료
    if (e.key === 'Escape') {
      setMode('view')
      onSave(value)
      return
    }

    // Enter: 넘버링 자동 증가
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      const cursorPos = textarea.selectionStart
      const textBeforeCursor = value.substring(0, cursorPos)
      const lines = textBeforeCursor.split('\n')
      const currentLine = lines[lines.length - 1]
      const trimmed = currentLine.trim()

      // 1단계: 1. 2. 3.
      const number1Match = trimmed.match(/^(\d+)\.\s*(.*)$/)
      if (number1Match) {
        const num = parseInt(number1Match[1])
        const content = number1Match[2]
        
        // 내용이 없으면 넘버링 종료
        if (!content) {
          e.preventDefault()
          const indent = currentLine.length - currentLine.trimStart().length
          const newText = value.substring(0, cursorPos - trimmed.length - indent) + value.substring(cursorPos)
          onChange(newText)
          setTimeout(() => {
            if (textarea) {
              textarea.selectionStart = textarea.selectionEnd = cursorPos - trimmed.length - indent
            }
          }, 0)
          return
        }
        
        // 다음 번호 생성
        e.preventDefault()
        const indent = currentLine.length - currentLine.trimStart().length
        const spaces = ' '.repeat(indent)
        const newNumber = `\n${spaces}${num + 1}. `
        const textAfter = value.substring(cursorPos)
        onChange(value.substring(0, cursorPos) + newNumber + textAfter)
        setTimeout(() => {
          if (textarea) {
            textarea.selectionStart = textarea.selectionEnd = cursorPos + newNumber.length
          }
        }, 0)
        return
      }

      // 2단계: 1) 2) 3)
      const number2Match = trimmed.match(/^(\d+)\)\s*(.*)$/)
      if (number2Match) {
        const num = parseInt(number2Match[1])
        const content = number2Match[2]
        
        if (!content) {
          e.preventDefault()
          const indent = currentLine.length - currentLine.trimStart().length
          const newText = value.substring(0, cursorPos - trimmed.length - indent) + value.substring(cursorPos)
          onChange(newText)
          setTimeout(() => {
            if (textarea) {
              textarea.selectionStart = textarea.selectionEnd = cursorPos - trimmed.length - indent
            }
          }, 0)
          return
        }
        
        e.preventDefault()
        const indent = currentLine.length - currentLine.trimStart().length
        const spaces = ' '.repeat(indent)
        const newNumber = `\n${spaces}${num + 1}) `
        const textAfter = value.substring(cursorPos)
        onChange(value.substring(0, cursorPos) + newNumber + textAfter)
        setTimeout(() => {
          if (textarea) {
            textarea.selectionStart = textarea.selectionEnd = cursorPos + newNumber.length
          }
        }, 0)
        return
      }

      // 3단계: ① ② ③
      const circledNumbers = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'
      const number3Match = trimmed.match(/^([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])\s*(.*)$/)
      if (number3Match) {
        const circledChar = number3Match[1]
        const content = number3Match[2]
        const num = circledNumbers.indexOf(circledChar) + 1
        
        if (!content) {
          e.preventDefault()
          const indent = currentLine.length - currentLine.trimStart().length
          const newText = value.substring(0, cursorPos - trimmed.length - indent) + value.substring(cursorPos)
          onChange(newText)
          setTimeout(() => {
            if (textarea) {
              textarea.selectionStart = textarea.selectionEnd = cursorPos - trimmed.length - indent
            }
          }, 0)
          return
        }
        
        if (num < 20) {
          e.preventDefault()
          const indent = currentLine.length - currentLine.trimStart().length
          const spaces = ' '.repeat(indent)
          const nextCircled = circledNumbers[num]
          const newNumber = `\n${spaces}${nextCircled} `
          const textAfter = value.substring(cursorPos)
          onChange(value.substring(0, cursorPos) + newNumber + textAfter)
          setTimeout(() => {
            if (textarea) {
              textarea.selectionStart = textarea.selectionEnd = cursorPos + newNumber.length
            }
          }, 0)
          return
        }
      }
    }

    // Tab: 레벨 증가 (1. -> 1) -> ①)
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      const cursorPos = textarea.selectionStart
      const lines = value.split('\n')
      
      // 현재 커서가 있는 라인 찾기
      let currentPos = 0
      let currentLineIndex = 0
      for (let i = 0; i < lines.length; i++) {
        if (currentPos + lines[i].length >= cursorPos) {
          currentLineIndex = i
          break
        }
        currentPos += lines[i].length + 1 // +1 for \n
      }
      
      const currentLine = lines[currentLineIndex]
      const trimmed = currentLine.trim()

      // 1. -> 1) (번호를 1로 리셋)
      const number1Match = trimmed.match(/^(\d+)\.\s+(.*)$/)
      if (number1Match) {
        const content = number1Match[2]
        const indent = currentLine.length - currentLine.trimStart().length
        const newIndent = indent + 2
        const spaces = ' '.repeat(newIndent)
        const newLine = `${spaces}1) ${content}`  // 항상 1로 시작
        lines[currentLineIndex] = newLine
        const newText = lines.join('\n')
        onChange(newText)
        
        // 커서 위치 계산
        const newCursorPos = lines.slice(0, currentLineIndex).join('\n').length + 
                             (currentLineIndex > 0 ? 1 : 0) + 
                             newLine.length
        setTimeout(() => {
          if (textarea) {
            textarea.selectionStart = textarea.selectionEnd = newCursorPos
          }
        }, 0)
        return
      }

      // 1) -> ① (번호를 ①로 리셋)
      const number2Match = trimmed.match(/^(\d+)\)\s+(.*)$/)
      if (number2Match) {
        const content = number2Match[2]
        const circledNumbers = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'
        const indent = currentLine.length - currentLine.trimStart().length
        const newIndent = indent + 2
        const spaces = ' '.repeat(newIndent)
        const newLine = `${spaces}① ${content}`  // 항상 ①로 시작
        lines[currentLineIndex] = newLine
        const newText = lines.join('\n')
        onChange(newText)
        
        const newCursorPos = lines.slice(0, currentLineIndex).join('\n').length + 
                             (currentLineIndex > 0 ? 1 : 0) + 
                             newLine.length
        setTimeout(() => {
          if (textarea) {
            textarea.selectionStart = textarea.selectionEnd = newCursorPos
          }
        }, 0)
        return
      }
    }

    // Shift+Tab: 레벨 감소 (① -> 1) -> 1.)
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      const cursorPos = textarea.selectionStart
      const lines = value.split('\n')
      
      // 현재 커서가 있는 라인 찾기
      let currentPos = 0
      let currentLineIndex = 0
      for (let i = 0; i < lines.length; i++) {
        if (currentPos + lines[i].length >= cursorPos) {
          currentLineIndex = i
          break
        }
        currentPos += lines[i].length + 1
      }
      
      const currentLine = lines[currentLineIndex]
      const trimmed = currentLine.trim()

      // ① -> 1) (번호를 1로 리셋)
      const circledNumbers = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'
      const number3Match = trimmed.match(/^([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])\s+(.*)$/)
      if (number3Match) {
        const content = number3Match[2]
        const indent = currentLine.length - currentLine.trimStart().length
        const newIndent = Math.max(0, indent - 2)
        const spaces = ' '.repeat(newIndent)
        const newLine = `${spaces}1) ${content}`  // 항상 1로 시작
        lines[currentLineIndex] = newLine
        const newText = lines.join('\n')
        onChange(newText)
        
        const newCursorPos = lines.slice(0, currentLineIndex).join('\n').length + 
                             (currentLineIndex > 0 ? 1 : 0) + 
                             newLine.length
        setTimeout(() => {
          if (textarea) {
            textarea.selectionStart = textarea.selectionEnd = newCursorPos
          }
        }, 0)
        return
      }

      // 1) -> 1. (번호를 1로 리셋)
      const number2Match = trimmed.match(/^(\d+)\)\s+(.*)$/)
      if (number2Match) {
        const content = number2Match[2]
        const indent = currentLine.length - currentLine.trimStart().length
        const newIndent = Math.max(0, indent - 2)
        const spaces = ' '.repeat(newIndent)
        const newLine = `${spaces}1. ${content}`  // 항상 1로 시작
        lines[currentLineIndex] = newLine
        const newText = lines.join('\n')
        onChange(newText)
        
        const newCursorPos = lines.slice(0, currentLineIndex).join('\n').length + 
                             (currentLineIndex > 0 ? 1 : 0) + 
                             newLine.length
        setTimeout(() => {
          if (textarea) {
            textarea.selectionStart = textarea.selectionEnd = newCursorPos
          }
        }, 0)
        return
      }
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

  // 블록 삭제 핸들러
  const handleDeleteBlock = (groupId: string) => {
    const newGroups = blockGroups.filter(g => g.id !== groupId)
    setBlockGroups(newGroups)
    
    // textarea 텍스트 동기화
    setTimeout(() => {
      // 체크박스는 줄바꿈만, 일반 블록은 빈 줄로 구분
      const newText = newGroups.map((group, idx) => {
        if (idx === 0) return group.rawText
        
        const prevGroup = newGroups[idx - 1]
        const isCurrentCheckbox = group.rawText.trim().startsWith('[')
        const isPrevCheckbox = prevGroup.rawText.trim().startsWith('[')
        
        // 둘 다 체크박스면 줄바꿈 하나만
        if (isCurrentCheckbox && isPrevCheckbox) {
          return '\n' + group.rawText
        }
        
        // 그 외는 빈 줄 추가
        return '\n\n' + group.rawText
      }).join('')
      
      onChange(newText)
    }, 0)
  }

  // ========== Sortable 블록 컴포넌트 ==========
  
  const SortableBlockGroup = ({ group }: { group: BlockGroup }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: group.id })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }

    return (
      <div
        ref={setNodeRef}
        style={style}
        className="group relative"
      >
        {/* 삭제 버튼 & 드래그 핸들 */}
        <div className="absolute -left-11 top-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          {/* 삭제 버튼 */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleDeleteBlock(group.id)
            }}
            className="text-gray-400 hover:text-red-500 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          
          {/* 드래그 핸들 */}
          <div
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing"
          >
            <GripVertical size={16} className="text-gray-400 hover:text-gray-600" />
          </div>
        </div>
        
        {/* 블록 내용 */}
        <div 
          className="space-y-1"
          onClick={() => handleBlockClick(group.id)}
        >
          {group.blocks.map(renderBlock)}
        </div>
      </div>
    )
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
            // 탭 모드일 때는 blur로 자동 전환하지 않음
            if (mode === undefined) {
              setMode('view')
              onSave(value)
            }
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          className="w-full h-full p-3 pb-32 bg-white rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[400px] placeholder-gray-400 text-gray-900 font-mono flex-1"
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

  // 보기 모드 - 블록 그룹으로 렌더링
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div 
        className={`w-full p-3 pl-14 bg-gray-50 rounded-lg min-h-[400px] cursor-text hover:bg-gray-100 transition-colors overflow-auto ${className}`}
        onClick={(e) => {
          // 빈 영역 클릭 시 끝으로 이동
          if (e.target === e.currentTarget) {
            setTargetCursorPos(value.length)
            setMode('edit')
          }
        }}
      >
        {!value.trim() ? (
          <p className="text-sm text-gray-400">{placeholder}</p>
        ) : (
          <SortableContext
            items={blockGroups.map(g => g.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {blockGroups.map((group, index) => {
                // 이전 그룹과의 간격 계산
                const prevGroup = index > 0 ? blockGroups[index - 1] : null
                const isCurrentNumbering = /^(\d+\.|(\d+\))|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])\s/.test(group.rawText.trim())
                const isPrevNumbering = prevGroup && /^(\d+\.|(\d+\))|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])\s/.test(prevGroup.rawText.trim())
                
                // 넘버링끼리는 좁은 간격, 다른 블록과는 넓은 간격
                const needsExtraSpace = index > 0 && (!isCurrentNumbering || !isPrevNumbering)
                
                return (
                  <div key={group.id} className={needsExtraSpace ? 'mt-4' : ''}>
                    <SortableBlockGroup group={group} />
                  </div>
                )
              })}
            </div>
          </SortableContext>
        )}
      </div>
    </DndContext>
  )
}
