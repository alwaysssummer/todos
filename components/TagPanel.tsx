import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Task } from '@/types/database'

interface TagPanelProps {
    tasks: Task[]
    selectedTags: string[]
    onTagClick: (tag: string) => void
    onHeaderClick: () => void
}

export default function TagPanel({ tasks, selectedTags, onTagClick, onHeaderClick }: TagPanelProps) {
    // 모든 태그 추출 및 개수 계산
    const tagCounts = useMemo(() => {
        const counts: Record<string, number> = {}
        tasks.forEach(task => {
            task.tags?.forEach(tag => {
                counts[tag] = (counts[tag] || 0) + 1
            })
        })
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])  // 개수 많은 순
    }, [tasks])

    if (tagCounts.length === 0) return null

    return (
        <div className="border-t border-gray-200 bg-white">
            {/* Header - Archive 오픈 */}
            <button
                onClick={onHeaderClick}
                className="flex items-center justify-between w-full px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span>🏷️ TAGS</span>
                    <span className="text-xs text-gray-400 font-normal">({tagCounts.length})</span>
                </div>
                <ChevronRight size={16} className="text-gray-400" />
            </button>
        </div>
    )
}
