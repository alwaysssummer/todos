'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronRight, ChevronDown, GripVertical } from 'lucide-react'
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
type BlockType = 'toggle' | 'checkbox' | 'checkbox-checked' | 'image' | 'text' | 'empty'

interface ParsedBlock {
  type: BlockType
  content: string
  children?: ParsedBlock[]
  id: string // 고유 ID (토글 상태 관리용)
  level?: number // 토글 레벨 (1 or 2)
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
  const [lastCursorPos, setLastCursorPos] = useState<number>(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const viewContainerRef = useRef<HTMLDivElement>(null)
  const savedScrollPos = useRef<number>(0)
  const isTogglingRef = useRef<boolean>(false)

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
      
      // targetCursorPos가 설정되어 있으면 해당 위치로, 아니면 마지막 위치로
      const cursorPos = targetCursorPos !== null ? targetCursorPos : lastCursorPos
      textarea.setSelectionRange(cursorPos, cursorPos)
      
      // 스크롤 조정: 커서가 보이도록
      setTimeout(() => {
        if (textarea) {
          // 커서 위치의 Y 좌표 계산
          const textBeforeCursor = textarea.value.substring(0, cursorPos)
          const lines = textBeforeCursor.split('\n')
          const lineHeight = 24 // 대략적인 line height
          const cursorY = lines.length * lineHeight
          
          // 현재 보이는 영역
          const scrollTop = textarea.scrollTop
          const viewportHeight = textarea.clientHeight
          
          // 커서가 화면 밖에 있으면 스크롤 조정
          if (cursorY < scrollTop) {
            // 커서가 위쪽에 있으면
            textarea.scrollTop = Math.max(0, cursorY - 50)
          } else if (cursorY > scrollTop + viewportHeight - 100) {
            // 커서가 아래쪽에 있으면 (여유 공간 100px)
            textarea.scrollTop = cursorY - viewportHeight / 2
          }
        }
      }, 0)
      
      // targetCursorPos 초기화
      setTargetCursorPos(null)
    }
  }, [isEditing, targetCursorPos, lastCursorPos])

  // 블록 그룹 초기화
  useEffect(() => {
    const groups = parseBlockGroups(value)
    setBlockGroups(groups)
  }, [value])

  // 보기 모드로 전환 시 스크롤 위치 유지
  useEffect(() => {
    // 토글 중이면 스크롤 조정 안 함
    if (isTogglingRef.current) {
      return
    }
    
    if (!isEditing && viewContainerRef.current && lastCursorPos > 0) {
      // 마지막 커서 위치에 해당하는 블록 그룹 찾기
      let accumulatedLength = 0
      let targetGroupIndex = 0
      
      for (let i = 0; i < blockGroups.length; i++) {
        const groupLength = blockGroups[i].rawText.length + 2 // +2 for \n\n
        if (accumulatedLength + groupLength > lastCursorPos) {
          targetGroupIndex = i
          break
        }
        accumulatedLength += groupLength
      }
      
      // 해당 블록으로 스크롤
      setTimeout(() => {
        if (viewContainerRef.current && !isTogglingRef.current) {
          const blockElements = viewContainerRef.current.querySelectorAll('.group')
          if (blockElements[targetGroupIndex]) {
            blockElements[targetGroupIndex].scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            })
          }
        }
      }, 100)
    }
  }, [isEditing, lastCursorPos, blockGroups])

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
          const newText = newItems.map(group => group.rawText).join('\n\n')
          onChange(newText)
        }, 0)
        
        return newItems
      })
    }
  }

  // ========== 파싱 로직 ==========
  
  // 빈 줄(\n\n) 기준으로 블록 그룹 생성 (단, 토글은 통합 블록으로 처리)
  const parseBlockGroups = (text: string): BlockGroup[] => {
    const lines = text.split('\n')
    const groups: BlockGroup[] = []
    let i = 0
    let groupIndex = 0

    while (i < lines.length) {
      const trimmed = lines[i].trim()

      // 빈 줄 건너뛰기
      if (!trimmed) {
        i++
        continue
      }

      // 토글 시작 감지 (>> 또는 >> 제목)
      if (trimmed === '>>' || trimmed.startsWith('>> ')) {
        const startIdx = i
        let depth = 1
        i++

        // << 를 찾을 때까지 진행 (중첩 토글 고려)
        while (i < lines.length && depth > 0) {
          const currentLine = lines[i].trim()
          if (currentLine === '>>' || currentLine.startsWith('>> ')) {
            depth++
          } else if (currentLine === '<<') {
            depth--
          }
          i++
        }

        // 토글 전체를 하나의 그룹으로
        const toggleText = lines.slice(startIdx, i).join('\n')
        groups.push({
          id: `group-${groupIndex++}`,
          blocks: parseBlocks(toggleText),
          rawText: toggleText
        })
        continue
      }

      // 체크박스는 개별 블록으로
      if (trimmed.startsWith('[] ') || trimmed.startsWith('[x] ') || trimmed.startsWith('[X] ')) {
        groups.push({
          id: `group-${groupIndex++}`,
          blocks: parseBlocks(lines[i]),
          rawText: lines[i]
        })
        i++
        continue
      }

      // 일반 텍스트: 빈 줄까지 모으기
      const textStartIdx = i
      while (i < lines.length && lines[i].trim() !== '' && 
             !lines[i].trim().startsWith('[] ') && 
             !lines[i].trim().startsWith('[x] ') && 
             !lines[i].trim().startsWith('[X] ') &&
             lines[i].trim() !== '>>' &&
             !lines[i].trim().startsWith('>> ')) {
        i++
      }

      const textBlock = lines.slice(textStartIdx, i).join('\n')
      groups.push({
        id: `group-${groupIndex++}`,
        blocks: parseBlocks(textBlock),
        rawText: textBlock
      })
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
        if (trimmed === '<<') {
          i++
          return blocks
        }

        // 1차 토글 시작 (제목 있음)
        if (trimmed.startsWith('>> ')) {
          const title = trimmed.substring(3)
          const toggleId = `toggle-${toggleCounter++}`
          i++
          const children = parseUntilEnd(depth + 1)
          blocks.push({
            type: 'toggle',
            content: title,
            children,
            id: toggleId,
            level: 1
          })
          continue
        }

        // 1차 토글 시작 (제목 없음)
        if (trimmed === '>>') {
          const toggleId = `toggle-${toggleCounter++}`
          i++
          const children = parseUntilEnd(depth + 1)
          blocks.push({
            type: 'toggle',
            content: '', // 제목 없음
            children,
            id: toggleId,
            level: 1
          })
          continue
        }

        // 2차 토글 (>> ~ << 사이에서만 인식, depth > 0)
        if (depth > 0 && trimmed.startsWith('> ')) {
          const title = trimmed.substring(2)
          const toggleId = `toggle-${toggleCounter++}`
          i++
          
          // 2차 토글의 자식: 다음 토글(> 또는 >>)이나 << 가 나올 때까지
          const children: ParsedBlock[] = []
          while (i < lines.length) {
            const nextLine = lines[i].trim()
            // 다음 토글이나 종료 마커를 만나면 중단
            if (nextLine === '<<' || nextLine.startsWith('> ') || nextLine.startsWith('>> ') || nextLine === '>>') {
              break
            }
            
            // 일반 텍스트나 체크박스 등을 자식으로 추가
            if (nextLine) {
              // 체크박스
              if (nextLine.startsWith('[] ')) {
                children.push({
                  type: 'checkbox',
                  content: nextLine.substring(3),
                  id: `line-${i}`
                })
              } else if (nextLine.startsWith('[x] ') || nextLine.startsWith('[X] ')) {
                children.push({
                  type: 'checkbox-checked',
                  content: nextLine.substring(4),
                  id: `line-${i}`
                })
              } else {
                // 일반 텍스트
                children.push({
                  type: 'text',
                  content: nextLine,
                  id: `line-${i}`
                })
              }
            }
            i++
          }
          
          blocks.push({
            type: 'toggle',
            content: title,
            children,
            id: toggleId,
            level: 2
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
    // 토글 중임을 표시
    isTogglingRef.current = true
    
    if (!viewContainerRef.current) return
    
    // 토글 버튼의 현재 위치 찾기
    const toggleButton = viewContainerRef.current.querySelector(`[data-toggle-id="${id}"]`)
    const containerRect = viewContainerRef.current.getBoundingClientRect()
    const toggleRect = toggleButton?.getBoundingClientRect()
    
    // 토글 버튼의 컨테이너 상단으로부터의 상대 위치
    const toggleOffsetFromTop = toggleRect ? toggleRect.top - containerRect.top : 0
    
    setExpandedToggles(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
    
    // 토글 버튼의 위치를 유지하도록 스크롤 조정
    requestAnimationFrame(() => {
      if (viewContainerRef.current && toggleButton) {
        const newToggleRect = toggleButton.getBoundingClientRect()
        const newContainerRect = viewContainerRef.current.getBoundingClientRect()
        const newToggleOffsetFromTop = newToggleRect.top - newContainerRect.top
        
        // 위치 차이만큼만 정확히 스크롤 조정 (여유 공간 없음)
        const scrollDiff = newToggleOffsetFromTop - toggleOffsetFromTop
        if (Math.abs(scrollDiff) > 1) { // 1px 이상 차이날 때만 조정
          viewContainerRef.current.scrollTop += scrollDiff
        }
      }
      
      setTimeout(() => {
        // 한 번 더 조정 (React 렌더링 완료 후)
        if (viewContainerRef.current && toggleButton) {
          const newToggleRect = toggleButton.getBoundingClientRect()
          const newContainerRect = viewContainerRef.current.getBoundingClientRect()
          const newToggleOffsetFromTop = newToggleRect.top - newContainerRect.top
          
          const scrollDiff = newToggleOffsetFromTop - toggleOffsetFromTop
          if (Math.abs(scrollDiff) > 1) {
            viewContainerRef.current.scrollTop += scrollDiff
          }
        }
        
        // 세 번째 조정 (완전한 렌더링 후)
        setTimeout(() => {
          if (viewContainerRef.current && toggleButton) {
            const newToggleRect = toggleButton.getBoundingClientRect()
            const newContainerRect = viewContainerRef.current.getBoundingClientRect()
            const newToggleOffsetFromTop = newToggleRect.top - newContainerRect.top
            
            const scrollDiff = newToggleOffsetFromTop - toggleOffsetFromTop
            if (Math.abs(scrollDiff) > 1) {
              viewContainerRef.current.scrollTop += scrollDiff
            }
          }
          
          // 토글 완료
          setTimeout(() => {
            isTogglingRef.current = false
          }, 100)
        }, 50)
      }, 0)
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
        const isLevel2 = block.level === 2
        
        return (
          <div key={block.id} className={isLevel2 ? "my-0.5 ml-4" : "my-1"}>
            <button
              type="button"
              data-toggle-id={block.id}
              onClick={(e) => {
                e.stopPropagation()
                toggleExpand(block.id)
              }}
              className={`flex items-center gap-1 text-sm hover:text-gray-900 py-0.5 w-full text-left ${
                isLevel2 ? 'text-gray-600' : 'text-gray-700'
              }`}
            >
              {isExpanded ? (
                <svg width={isLevel2 ? "12" : "16"} height={isLevel2 ? "12" : "16"} viewBox="0 0 16 16" className="text-gray-700 flex-shrink-0">
                  <path d="M3 6 L8 11 L13 6" fill="currentColor" />
                </svg>
              ) : (
                <svg width={isLevel2 ? "12" : "16"} height={isLevel2 ? "12" : "16"} viewBox="0 0 16 16" className="text-gray-700 flex-shrink-0">
                  <path d="M6 3 L11 8 L6 13" fill="currentColor" />
                </svg>
              )}
              <span className={isLevel2 ? "font-normal text-sm" : "font-medium"}>
                {block.content ? renderText(block.content) : <span className="text-gray-400">토글</span>}
              </span>
            </button>
            {isExpanded && block.children && block.children.length > 0 && (
              <div className={`${isLevel2 ? 'ml-4' : 'ml-5'} border-l-2 border-gray-200 pl-3 py-1 space-y-1`}>
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
    // Escape: 저장 후 편집 종료
    if (e.key === 'Escape') {
      setMode('view')
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

  // 블록 삭제 핸들러
  const handleDeleteBlock = (groupId: string) => {
    const newGroups = blockGroups.filter(g => g.id !== groupId)
    setBlockGroups(newGroups)
    
    // textarea 텍스트 동기화
    setTimeout(() => {
      const newText = newGroups.map(group => group.rawText).join('\n\n')
      onChange(newText)
    }, 0)
  }

  // 블록 그룹의 텍스트 시작 위치 계산
  const getBlockGroupTextPosition = (groupId: string): number => {
    let position = 0
    for (const group of blockGroups) {
      if (group.id === groupId) {
        return position
      }
      position += group.rawText.length + 2 // +2 for \n\n
    }
    return position
  }

  // 보기 모드에서 블록 클릭 시 편집 모드로 전환하며 커서 위치 설정
  const handleBlockClick = (groupId: string, event: React.MouseEvent, blockIndex?: number) => {
    event.stopPropagation()
    
    // 클릭한 블록 그룹의 시작 위치
    const groupStartPos = getBlockGroupTextPosition(groupId)
    
    const group = blockGroups.find(g => g.id === groupId)
    if (group) {
      let cursorPos = groupStartPos
      
      // 특정 블록을 클릭한 경우, 해당 블록의 시작 위치로
      if (blockIndex !== undefined && blockIndex >= 0) {
        // 해당 블록까지의 텍스트 길이 계산
        const blockTexts = group.rawText.split('\n')
        for (let i = 0; i < Math.min(blockIndex, blockTexts.length); i++) {
          cursorPos += blockTexts[i].length + 1 // +1 for \n
        }
      } else {
        // 블록 그룹 전체 클릭 시 시작 위치로
        cursorPos = groupStartPos
      }
      
      setTargetCursorPos(cursorPos)
    }
    
    setMode('edit')
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
            title="블록 삭제"
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
          onClick={(e) => handleBlockClick(group.id, e)}
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
          onKeyDown={(e) => {
            handleKeyDown(e)
            // 키보드 입력 후 커서 위치 업데이트
            setTimeout(() => {
              if (textareaRef.current) {
                setLastCursorPos(textareaRef.current.selectionStart)
              }
            }, 0)
          }}
          onPaste={handlePaste}
          onSelect={(e) => {
            // 커서 위치 추적
            const target = e.target as HTMLTextAreaElement
            setLastCursorPos(target.selectionStart)
          }}
          onClick={(e) => {
            // 클릭 시에도 커서 위치 추적
            const target = e.target as HTMLTextAreaElement
            setLastCursorPos(target.selectionStart)
          }}
          onInput={(e) => {
            // 입력 시에도 커서 위치 추적
            const target = e.target as HTMLTextAreaElement
            setLastCursorPos(target.selectionStart)
          }}
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
        ref={viewContainerRef}
        className={`w-full p-3 pl-14 pb-32 bg-gray-50 rounded-lg min-h-[400px] cursor-text hover:bg-gray-100 transition-colors overflow-auto ${className}`}
        onClick={(e) => {
          // 빈 공간 클릭 시 맨 끝으로
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
            <div className="space-y-4">
              {blockGroups.map((group) => (
                <SortableBlockGroup key={group.id} group={group} />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </DndContext>
  )
}
