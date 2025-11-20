import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Task } from '@/types/database'

interface TagPanelProps {
    tasks: Task[]
    selectedTags: string[]
    onTagClick: (tag: string) => void
}

export default function TagPanel({ tasks, selectedTags, onTagClick }: TagPanelProps) {
    const [isExpanded, setIsExpanded] = useState(true)

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
        <div className="mb-4 border-b border-gray-200 pb-4">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between w-full px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
                <span>🏷️ TAGS ({tagCounts.length})</span>
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {isExpanded && (
                <div className="px-4 py-2 space-y-1 max-h-64 overflow-y-auto">
                    {tagCounts.map(([tag, count]) => (
                        <button
                            key={tag}
                            onClick={() => onTagClick(tag)}
                            className={`w-full text-left px-2 py-1 text-sm rounded hover:bg-gray-100 flex justify-between items-center transition-colors
                ${selectedTags.includes(tag) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                        >
                            <span>#{tag}</span>
                            <span className="text-gray-400 text-xs">({count})</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
