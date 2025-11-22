'use client'

import { memo } from 'react'
import type { Textbook } from '@/types/database'

interface ChapterGridProps {
    textbook: Textbook
    selectedChapters: string[]
    page: number
    onPageChange: (page: number) => void
    onToggle: (textbookId: string, chapter: string, e?: React.MouseEvent) => void
}

const ChapterGrid = memo(({ textbook, selectedChapters, page, onPageChange, onToggle }: ChapterGridProps) => {
    const pageSize = 20
    const startChapter = page * pageSize + 1
    const endChapter = Math.min(startChapter + pageSize - 1, textbook.total_chapters)
    const totalPages = Math.ceil(textbook.total_chapters / pageSize)

    return (
        <div className="border rounded-md p-1.5 bg-white h-full flex flex-col">
            {/* 헤더: 교재명 + 페이지네이션 */}
            <div className="flex items-center justify-between mb-1">
                <div className="text-xs font-semibold text-gray-900 truncate flex-1" title={textbook.name}>
                    {textbook.name}
                </div>
                
                {/* 페이지네이션 */}
                {totalPages > 1 && (
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                            onClick={() => onPageChange(Math.max(0, page - 1))}
                            disabled={page === 0}
                            className="p-0.5 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                        >
                            ◀
                        </button>
                        <span className="text-[9px] text-gray-500 px-0.5">
                            {startChapter}-{endChapter}
                        </span>
                        <button
                            onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
                            disabled={page === totalPages - 1}
                            className="p-0.5 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                        >
                            ▶
                        </button>
                    </div>
                )}
            </div>

            {/* 단원 선택 그리드 */}
            <div className="grid grid-cols-5 gap-0.5 mb-1">
                {Array.from({ length: endChapter - startChapter + 1 }, (_, i) => {
                    const chapter = (startChapter + i).toString()
                    const isSelected = selectedChapters.includes(chapter)

                    return (
                        <button
                            key={chapter}
                            onClick={(e) => onToggle(textbook.id, chapter, e)}
                            className={`px-1 py-0.5 text-[10px] rounded transition-colors font-medium ${
                                isSelected
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            }`}
                        >
                            {chapter}
                        </button>
                    )
                })}
            </div>

            {/* 선택된 단원 요약 */}
            {selectedChapters.length > 0 && (
                <div className="mt-auto pt-1 text-[10px] text-blue-600 font-medium truncate border-t border-gray-100" title={selectedChapters.join(',')}>
                    ✓ {selectedChapters.sort((a, b) => parseInt(a) - parseInt(b)).join(',')} ({selectedChapters.length})
                </div>
            )}
        </div>
    )
})

ChapterGrid.displayName = 'ChapterGrid'

export default ChapterGrid

