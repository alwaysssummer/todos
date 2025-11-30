'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Save } from 'lucide-react'
import type { Textbook } from '@/types/database'

interface ChapterMemoPopupProps {
    textbook: Textbook
    chapterNumber: number
    chapterName: string
    initialMemo: string
    onSave: (memo: string) => Promise<void>
    onClose: () => void
}

export default function ChapterMemoPopup({
    textbook,
    chapterNumber,
    chapterName,
    initialMemo,
    onSave,
    onClose
}: ChapterMemoPopupProps) {
    const [memo, setMemo] = useState(initialMemo || '')
    const [saving, setSaving] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        // 팝업 열릴 때 텍스트 영역에 포커스
        textareaRef.current?.focus()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        try {
            await onSave(memo)
            onClose()
        } catch (error) {
            console.error('Error saving memo:', error)
            alert('메모 저장에 실패했습니다.')
        } finally {
            setSaving(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Ctrl+Enter로 저장
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault()
            handleSave()
        }
        // Escape로 닫기
        if (e.key === 'Escape') {
            onClose()
        }
    }

    const getChapterUnitDisplay = () => {
        return textbook.chapter_unit === '직접입력' 
            ? textbook.custom_chapter_unit 
            : textbook.chapter_unit
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
                {/* 헤더 */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">
                        {chapterNumber}{getChapterUnitDisplay()} 메모
                        {chapterName && chapterName !== `${chapterNumber}${getChapterUnitDisplay()}` && (
                            <span className="text-gray-500 font-normal ml-2">({chapterName})</span>
                        )}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* 교재 정보 */}
                <div className="mb-3 text-sm text-gray-500">
                    📚 {textbook.name}
                </div>

                {/* 메모 입력 */}
                <textarea
                    ref={textareaRef}
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="단원에 대한 메모를 입력하세요..."
                    className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                {/* 안내 텍스트 */}
                <div className="mt-2 text-xs text-gray-400">
                    Ctrl+Enter로 저장 • Escape로 닫기
                </div>

                {/* 버튼 */}
                <div className="flex gap-2 justify-end mt-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
                    >
                        <Save size={16} />
                        {saving ? '저장 중...' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    )
}


