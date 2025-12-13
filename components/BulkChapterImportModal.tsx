'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { parseChapterText, type ParsedChapter } from '@/utils/chapterParser'

interface BulkChapterImportModalProps {
  textbookId: string
  textbookName: string
  currentTotalChapters: number
  onImport: (chapters: ParsedChapter[]) => Promise<void>
  onClose: () => void
}

export default function BulkChapterImportModal({
  textbookId,
  textbookName,
  currentTotalChapters,
  onImport,
  onClose,
}: BulkChapterImportModalProps) {
  const [inputText, setInputText] = useState('')
  const [parsedChapters, setParsedChapters] = useState<ParsedChapter[]>([])
  const [importing, setImporting] = useState(false)

  // 실시간 파싱 미리보기
  useEffect(() => {
    if (inputText.trim()) {
      const parsed = parseChapterText(inputText)
      setParsedChapters(parsed)
    } else {
      setParsedChapters([])
    }
  }, [inputText])

  const handleImport = async () => {
    if (parsedChapters.length === 0) {
      alert('등록할 단원이 없습니다.')
      return
    }

    // 확인 다이얼로그
    const message = currentTotalChapters > 0
      ? `기존 ${currentTotalChapters}개 단원을 삭제하고\n${parsedChapters.length}개 단원을 새로 등록합니다.\n\n계속하시겠습니까?`
      : `${parsedChapters.length}개 단원을 등록합니다.\n\n계속하시겠습니까?`

    const confirmed = window.confirm(message)
    if (!confirmed) return

    setImporting(true)
    try {
      console.log('🚀 일괄 등록 시작:', parsedChapters.length, '개')
      await onImport(parsedChapters)
      alert(`${parsedChapters.length}개 단원이 등록되었습니다.`)
      onClose()
    } catch (error) {
      console.error('❌ Error importing chapters:', error)
      console.error('에러 타입:', typeof error)
      console.error('에러 상세:', JSON.stringify(error, null, 2))
      
      let errorMessage = '단원 등록에 실패했습니다.'
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage += '\n\n' + (error as any).message
      }
      
      alert(errorMessage)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* 헤더 */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">단원 일괄 등록</h3>
            <p className="text-sm text-gray-500 mt-1">{textbookName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 메인 콘텐츠 */}
        <div className="flex-1 overflow-hidden flex gap-6 p-6">
          {/* 왼쪽: 입력 영역 */}
          <div className="flex-1 flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-2">
              단원 목록 붙여넣기
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`예시:\n01-01 주어 + 수식어\n01-02 to부정사, 동명사\n02-01 불완전자동사(1): ~상태로 있다\n02-02 불완전자동사(2): ~이 되다\n\n또는:\n1강 함수의 극한\n2강 함수의 연속\n3강 미분계수`}
              className="flex-1 p-4 border border-gray-300 rounded-lg resize-none font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-2">
              💡 Excel이나 노션에서 복사한 텍스트를 붙여넣으세요
            </p>
          </div>

          {/* 오른쪽: 미리보기 */}
          <div className="flex-1 flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-2">
              미리보기 ({parsedChapters.length}개 단원)
            </label>
            <div className="flex-1 border border-gray-300 rounded-lg overflow-y-auto p-4 bg-gray-50">
              {parsedChapters.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <p className="text-sm">텍스트를 입력하면</p>
                    <p className="text-sm">미리보기가 표시됩니다</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {parsedChapters.map((ch, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                    >
                      {/* 순서 번호 */}
                      <div className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-700 text-xs font-bold rounded flex-shrink-0">
                        {i + 1}
                      </div>
                      
                      {/* 단원 번호 */}
                      <div className="w-20 font-mono text-sm font-bold text-gray-700 flex-shrink-0">
                        {ch.chapterNumber}
                      </div>
                      
                      {/* 단원명 */}
                      <div className="flex-1 text-sm text-gray-900 min-w-0">
                        <span className="line-clamp-2">{ch.chapterName}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {currentTotalChapters > 0 && (
              <span className="text-orange-600">
                ⚠️ 기존 {currentTotalChapters}개 단원이 삭제됩니다
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={importing}
            >
              취소
            </button>
            <button
              onClick={handleImport}
              disabled={parsedChapters.length === 0 || importing}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {importing ? '등록 중...' : `${parsedChapters.length}개 단원 등록`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
