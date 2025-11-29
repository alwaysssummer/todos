'use client'

import { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, BookOpen, Edit2, Check, X, FileText, Folder, FolderOpen } from 'lucide-react'
import type { Textbook, TextbookGroup, TextbookChapter } from '@/types/database'
import { useTextbookChapters } from '@/hooks/useTextbookChapters'
import ChapterMemoPopup from './ChapterMemoPopup'

interface TextbookDetailPageProps {
    textbook: Textbook
    groups: TextbookGroup[]
    onBack: () => void
    onUpdateLocalPath?: (id: string, localPath: string | null) => Promise<Textbook>
}

export default function TextbookDetailPage({
    textbook,
    groups,
    onBack,
    onUpdateLocalPath
}: TextbookDetailPageProps) {
    const { chapters, loading, updateChapterName, updateChapterMemo } = useTextbookChapters(textbook.id)
    const [editingChapter, setEditingChapter] = useState<number | null>(null)
    const [editingName, setEditingName] = useState('')
    const [showMemoPopup, setShowMemoPopup] = useState(false)
    const [selectedChapter, setSelectedChapter] = useState<{ number: number; name: string; memo: string } | null>(null)
    
    // 로컬 경로 수정 상태
    const [isEditingPath, setIsEditingPath] = useState(false)
    const [editingPath, setEditingPath] = useState(textbook.local_path || '')
    const [currentLocalPath, setCurrentLocalPath] = useState(textbook.local_path || '')

    const getChapterUnitDisplay = () => {
        return textbook.chapter_unit === '직접입력' 
            ? textbook.custom_chapter_unit 
            : textbook.chapter_unit
    }

    const groupName = useMemo(() => {
        if (!textbook.group_id) return '미분류'
        const group = groups.find(g => g.id === textbook.group_id)
        return group?.name || '미분류'
    }, [textbook.group_id, groups])

    // 단원 목록 생성 (1부터 total_chapters까지)
    const chapterList = useMemo(() => {
        const list = []
        for (let i = 1; i <= textbook.total_chapters; i++) {
            const chapterData = chapters.find(c => c.chapter_number === i)
            list.push({
                number: i,
                customName: chapterData?.custom_name || '',
                memo: chapterData?.memo || '',
                id: chapterData?.id
            })
        }
        return list
    }, [textbook.total_chapters, chapters])

    const handleEditName = (chapterNumber: number, currentName: string) => {
        setEditingChapter(chapterNumber)
        setEditingName(currentName)
    }

    const handleSaveName = async (chapterNumber: number) => {
        try {
            await updateChapterName(chapterNumber, editingName)
            setEditingChapter(null)
            setEditingName('')
        } catch (error) {
            console.error('Error updating chapter name:', error)
            alert('단원명 수정에 실패했습니다.')
        }
    }

    const handleOpenMemo = (chapterNumber: number, chapterName: string, memo: string) => {
        setSelectedChapter({ number: chapterNumber, name: chapterName, memo })
        setShowMemoPopup(true)
    }

    const handleSaveMemo = async (memo: string) => {
        if (!selectedChapter) return
        
        try {
            await updateChapterMemo(selectedChapter.number, memo)
            setShowMemoPopup(false)
            setSelectedChapter(null)
        } catch (error) {
            console.error('Error updating chapter memo:', error)
            alert('메모 저장에 실패했습니다.')
        }
    }

    // 로컬 경로 저장
    const handleSaveLocalPath = async () => {
        if (!onUpdateLocalPath) return
        
        try {
            await onUpdateLocalPath(textbook.id, editingPath.trim() || null)
            setCurrentLocalPath(editingPath.trim())
            setIsEditingPath(false)
        } catch (error) {
            console.error('Error updating local path:', error)
            alert('경로 저장에 실패했습니다.')
        }
    }

    // 로컬 폴더 열기
    const handleOpenLocalFolder = () => {
        if (!currentLocalPath) return
        
        const normalizedPath = currentLocalPath.replace(/\\/g, '/')
        const url = `openfolder://${normalizedPath}`
        window.open(url, '_blank')
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
                {/* 헤더 */}
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div className="flex-1">
                            <div className="flex items-center gap-3">
                                <BookOpen size={24} className="text-blue-600" />
                                <h2 className="text-xl font-bold text-gray-900">{textbook.name}</h2>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                <span>총 {textbook.total_chapters}{getChapterUnitDisplay()}</span>
                                <span>•</span>
                                <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">{groupName}</span>
                            </div>
                        </div>
                    </div>

                    {/* 로컬 폴더 경로 */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                            <Folder size={16} className="text-gray-400 flex-shrink-0" />
                            {isEditingPath ? (
                                <div className="flex-1 flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={editingPath}
                                        onChange={(e) => setEditingPath(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveLocalPath()
                                            if (e.key === 'Escape') {
                                                setIsEditingPath(false)
                                                setEditingPath(currentLocalPath)
                                            }
                                        }}
                                        placeholder="예: D:/Dropbox/교재/어법입문"
                                        className="flex-1 px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleSaveLocalPath}
                                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                                        title="저장"
                                    >
                                        <Check size={16} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsEditingPath(false)
                                            setEditingPath(currentLocalPath)
                                        }}
                                        className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                        title="취소"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center gap-2">
                                    {currentLocalPath ? (
                                        <>
                                            <span className="text-sm text-gray-600 truncate flex-1" title={currentLocalPath}>
                                                {currentLocalPath}
                                            </span>
                                            <button
                                                onClick={handleOpenLocalFolder}
                                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                                title="폴더 열기"
                                            >
                                                <FolderOpen size={16} />
                                            </button>
                                        </>
                                    ) : (
                                        <span className="text-sm text-gray-400 italic">로컬 폴더 경로 없음</span>
                                    )}
                                    {onUpdateLocalPath && (
                                        <button
                                            onClick={() => {
                                                setEditingPath(currentLocalPath)
                                                setIsEditingPath(true)
                                            }}
                                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                                            title="경로 수정"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 단원 목록 */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="text-center py-12 text-gray-400">
                            로딩 중...
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {chapterList.map((chapter) => (
                                <div
                                    key={chapter.number}
                                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    {/* 단원 번호 */}
                                    <div className="w-12 h-12 flex items-center justify-center bg-blue-100 text-blue-700 font-bold rounded-lg flex-shrink-0">
                                        {chapter.number}
                                    </div>

                                    {/* 단원명 */}
                                    <div className="flex-1 min-w-0">
                                        {editingChapter === chapter.number ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={editingName}
                                                    onChange={(e) => setEditingName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSaveName(chapter.number)
                                                        if (e.key === 'Escape') {
                                                            setEditingChapter(null)
                                                            setEditingName('')
                                                        }
                                                    }}
                                                    placeholder={`${chapter.number}${getChapterUnitDisplay()}`}
                                                    className="flex-1 px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => handleSaveName(chapter.number)}
                                                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                                                >
                                                    <Check size={16} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditingChapter(null)
                                                        setEditingName('')
                                                    }}
                                                    className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-900">
                                                    {chapter.customName || `${chapter.number}${getChapterUnitDisplay()}`}
                                                </span>
                                                <button
                                                    onClick={() => handleEditName(chapter.number, chapter.customName)}
                                                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="단원명 수정"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                        
                                        {/* 메모 미리보기 */}
                                        {chapter.memo && (
                                            <p className="text-xs text-gray-500 mt-1 truncate">
                                                📝 {chapter.memo.substring(0, 50)}{chapter.memo.length > 50 ? '...' : ''}
                                            </p>
                                        )}
                                    </div>

                                    {/* 액션 버튼들 */}
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {editingChapter !== chapter.number && (
                                            <button
                                                onClick={() => handleEditName(chapter.number, chapter.customName)}
                                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                                title="단원명 수정"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleOpenMemo(
                                                chapter.number,
                                                chapter.customName || `${chapter.number}${getChapterUnitDisplay()}`,
                                                chapter.memo
                                            )}
                                            className={`p-2 rounded-lg transition-colors ${
                                                chapter.memo 
                                                    ? 'text-orange-500 hover:bg-orange-50' 
                                                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                            }`}
                                            title="메모"
                                        >
                                            <FileText size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 메모 팝업 */}
            {showMemoPopup && selectedChapter && (
                <ChapterMemoPopup
                    textbook={textbook}
                    chapterNumber={selectedChapter.number}
                    chapterName={selectedChapter.name}
                    initialMemo={selectedChapter.memo}
                    onSave={handleSaveMemo}
                    onClose={() => {
                        setShowMemoPopup(false)
                        setSelectedChapter(null)
                    }}
                />
            )}
        </div>
    )
}

