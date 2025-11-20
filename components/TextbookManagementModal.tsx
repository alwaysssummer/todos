'use client'

import { useState } from 'react'
import { X, BookOpen, Trash2 } from 'lucide-react'
import type { Textbook } from '@/types/database'

interface TextbookManagementModalProps {
    onClose: () => void
    textbooks: Textbook[]
    onCreateTextbook: (textbook: Partial<Textbook>) => Promise<Textbook>
    onDeleteTextbook: (id: string) => Promise<void>
}

export default function TextbookManagementModal({
    onClose,
    textbooks,
    onCreateTextbook,
    onDeleteTextbook
}: TextbookManagementModalProps) {
    const [name, setName] = useState('')
    const [totalChapters, setTotalChapters] = useState(10)
    const [chapterUnit, setChapterUnit] = useState<'강' | '과' | 'Unit' | 'Chapter' | '직접입력'>('강')
    const [customUnit, setCustomUnit] = useState('')
    const [isCreating, setIsCreating] = useState(false)

    const handleCreate = async () => {
        if (!name.trim()) {
            alert('교재명을 입력하세요.')
            return
        }

        if (totalChapters < 1 || totalChapters > 200) {
            alert('단원 수는 1~200 사이여야 합니다.')
            return
        }

        if (chapterUnit === '직접입력' && !customUnit.trim()) {
            alert('단원 단위를 입력하세요.')
            return
        }

        try {
            setIsCreating(true)
            await onCreateTextbook({
                name: name.trim(),
                total_chapters: totalChapters,
                chapter_unit: chapterUnit,
                custom_chapter_unit: chapterUnit === '직접입력' ? customUnit.trim() : undefined
            })

            // 초기화
            setName('')
            setTotalChapters(10)
            setChapterUnit('강')
            setCustomUnit('')
            alert('교재가 추가되었습니다.')
        } catch (error) {
            console.error('Error creating textbook:', error)
            alert('교재 추가에 실패했습니다.')
        } finally {
            setIsCreating(false)
        }
    }

    const handleDelete = async (id: string, textbookName: string) => {
        if (!confirm(`"${textbookName}" 교재를 삭제하시겠습니까?\n\n⚠️ 이 교재가 배정된 프로젝트가 있다면 수동으로 제거해야 합니다.`)) {
            return
        }

        try {
            await onDeleteTextbook(id)
            alert('교재가 삭제되었습니다.')
        } catch (error) {
            console.error('Error deleting textbook:', error)
            alert('교재 삭제에 실패했습니다.')
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
                {/* 헤더 */}
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <BookOpen size={24} className="text-blue-600" />
                        <h2 className="text-xl font-bold text-gray-900">교재 관리</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* 교재 목록 */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-3 mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-700">
                                현재 교재 ({textbooks.length}개)
                            </h3>
                        </div>

                        {textbooks.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
                                <p className="text-sm">등록된 교재가 없습니다.</p>
                                <p className="text-xs mt-1">아래에서 새 교재를 추가하세요.</p>
                            </div>
                        ) : (
                            textbooks.map((textbook) => (
                                <div
                                    key={textbook.id}
                                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-gray-900 text-lg mb-1">
                                                {textbook.name}
                                            </h4>
                                            <p className="text-sm text-gray-600">
                                                총 {textbook.total_chapters}
                                                {textbook.chapter_unit === '직접입력' 
                                                    ? textbook.custom_chapter_unit 
                                                    : textbook.chapter_unit}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                생성일: {new Date(textbook.created_at).toLocaleDateString('ko-KR')}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(textbook.id, textbook.name)}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="삭제"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 새 교재 추가 폼 */}
                <div className="p-6 border-t border-gray-200 bg-gray-50">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">새 교재 추가</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                        {/* 교재명 */}
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                교재명 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="예: 수학의 정석"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* 단원 수 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                단원 수 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                value={totalChapters}
                                onChange={(e) => setTotalChapters(parseInt(e.target.value) || 1)}
                                min={1}
                                max={200}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* 단원 단위 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                단원 단위 <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={chapterUnit}
                                onChange={(e) => setChapterUnit(e.target.value as any)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="강">강</option>
                                <option value="과">과</option>
                                <option value="Unit">Unit</option>
                                <option value="Chapter">Chapter</option>
                                <option value="직접입력">직접입력</option>
                            </select>
                        </div>

                        {/* 직접입력 시 커스텀 단위 */}
                        {chapterUnit === '직접입력' && (
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    단원 단위 입력 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={customUnit}
                                    onChange={(e) => setCustomUnit(e.target.value)}
                                    placeholder="예: 레슨, 챕터, 주제"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        )}
                    </div>

                    {/* 추가 버튼 */}
                    <button
                        onClick={handleCreate}
                        disabled={isCreating}
                        className="w-full mt-4 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                        {isCreating ? '추가 중...' : '교재 추가'}
                    </button>
                </div>
            </div>
        </div>
    )
}

