'use client'

import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'

interface MarkdownViewerProps {
  content: string
  className?: string
  onCheckboxToggle?: (lineIndex: number, checked: boolean) => void
}

/**
 * Typora 스타일의 심플하고 깔끔한 마크다운 뷰어
 * - [] 체크박스 지원
 * - 기본 마크다운 문법 지원 (헤딩, 리스트, 볼드, 이탤릭 등)
 */
export default function MarkdownViewer({ 
  content, 
  className = '',
  onCheckboxToggle 
}: MarkdownViewerProps) {
  
  // 체크박스 라인 인덱스 추적
  const checkboxLines = useMemo(() => {
    const lines: number[] = []
    content.split('\n').forEach((line, index) => {
      if (line.trim().startsWith('[] ') || 
          line.trim().startsWith('[x] ') || 
          line.trim().startsWith('[X] ')) {
        lines.push(index)
      }
    })
    return lines
  }, [content])
  
  // [] 체크박스 패턴을 마크다운 체크박스로 변환
  const processedContent = useMemo(() => {
    let checkboxIndex = 0
    return content
      .split('\n')
      .map((line, index) => {
        // [] 로 시작하는 라인 → 체크박스로 변환
        if (line.trim().startsWith('[] ')) {
          return `- [ ] ${line.trim().substring(3)}<!--cb:${index}-->`
        }
        // [x] 로 시작하는 라인 → 체크된 체크박스로 변환
        if (line.trim().startsWith('[x] ') || line.trim().startsWith('[X] ')) {
          return `- [x] ${line.trim().substring(4)}<!--cb:${index}-->`
        }
        return line
      })
      .join('\n')
  }, [content])

  return (
    <div className={`markdown-viewer ${className}`}>
      <ReactMarkdown
        components={{
          // 헤딩 스타일
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-gray-900 mt-4 mb-2 pb-1 border-b border-gray-200">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold text-gray-800 mt-3 mb-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-gray-700 mt-2 mb-1">
              {children}
            </h3>
          ),
          
          // 단락
          p: ({ children }) => (
            <p className="text-sm text-gray-700 leading-relaxed my-1.5">
              {children}
            </p>
          ),
          
          // 리스트
          ul: ({ children }) => (
            <ul className="list-disc list-inside text-sm text-gray-700 my-1.5 space-y-0.5">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside text-sm text-gray-700 my-1.5 space-y-0.5">
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => {
            // 체크박스 리스트 아이템 처리
            const className = props.className || ''
            if (className.includes('task-list-item')) {
              return (
                <li className="flex items-start gap-2 list-none ml-0">
                  {children}
                </li>
              )
            }
            return <li className="text-gray-700">{children}</li>
          },
          
          // 체크박스 input - 클릭 시 토글
          input: ({ type, checked, node, ...props }) => {
            if (type === 'checkbox') {
              // 부모 li 요소에서 라인 인덱스 추출 시도
              return (
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {}} // React 경고 방지
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5 cursor-pointer hover:scale-110 transition-transform"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (onCheckboxToggle) {
                      // 체크박스가 속한 li 요소의 텍스트에서 라인 인덱스 추출
                      const li = (e.target as HTMLElement).closest('li')
                      const text = li?.textContent || ''
                      const match = text.match(/<!--cb:(\d+)-->/)
                      if (match) {
                        const lineIndex = parseInt(match[1])
                        onCheckboxToggle(lineIndex, !checked)
                      } else {
                        // 폴백: 체크박스 순서로 라인 인덱스 찾기
                        const allCheckboxes = document.querySelectorAll('.markdown-viewer input[type="checkbox"]')
                        const index = Array.from(allCheckboxes).indexOf(e.target as HTMLInputElement)
                        if (index >= 0 && checkboxLines[index] !== undefined) {
                          onCheckboxToggle(checkboxLines[index], !checked)
                        }
                      }
                    }
                  }}
                />
              )
            }
            return <input type={type} {...props} />
          },
          
          // 인라인 코드
          code: ({ children, className }) => {
            // 코드 블록인지 인라인 코드인지 구분
            const isBlock = className?.includes('language-')
            if (isBlock) {
              return (
                <code className="block bg-gray-100 rounded-md p-3 text-xs font-mono text-gray-800 overflow-x-auto my-2">
                  {children}
                </code>
              )
            }
            return (
              <code className="bg-gray-100 text-red-600 px-1 py-0.5 rounded text-xs font-mono">
                {children}
              </code>
            )
          },
          
          // 코드 블록
          pre: ({ children }) => (
            <pre className="bg-gray-50 rounded-lg overflow-x-auto my-2">
              {children}
            </pre>
          ),
          
          // 볼드
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900">{children}</strong>
          ),
          
          // 이탤릭
          em: ({ children }) => (
            <em className="italic text-gray-700">{children}</em>
          ),
          
          // 링크
          a: ({ href, children }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              {children}
            </a>
          ),
          
          // 인용문
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 pl-3 my-2 text-gray-600 italic">
              {children}
            </blockquote>
          ),
          
          // 수평선
          hr: () => (
            <hr className="my-4 border-gray-200" />
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}

