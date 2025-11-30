'use client'

import { useMemo, useState } from 'react'
import { Tag, Search, X } from 'lucide-react'
import type { Task } from '@/types/database'

interface TagsTabProps {
  tasks: Task[]
  onTaskClick: (e: React.MouseEvent, task: Task) => void
}

export default function TagsTab({ tasks, onTaskClick }: TagsTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  // 모든 태그 추출 및 개수 계산
  const tagStats = useMemo(() => {
    const counts: Record<string, number> = {}
    tasks.forEach(task => {
      if (!task.is_auto_generated) {
        task.tags?.forEach(tag => {
          counts[tag] = (counts[tag] || 0) + 1
        })
      }
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }))
  }, [tasks])

  // 필터링된 태그
  const filteredTags = useMemo(() => {
    if (!searchQuery) return tagStats
    const query = searchQuery.toLowerCase()
    return tagStats.filter(({ tag }) => tag.toLowerCase().includes(query))
  }, [tagStats, searchQuery])

  // 선택된 태그의 태스크들
  const taggedTasks = useMemo(() => {
    if (!selectedTag) return []
    return tasks.filter(t => 
      !t.is_auto_generated && 
      t.tags?.includes(selectedTag)
    ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }, [tasks, selectedTag])

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="p-3 border-b border-gray-100">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="태그 검색..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Selected Tag Header */}
      {selectedTag && (
        <div className="px-3 py-2 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag size={14} className="text-purple-600" />
            <span className="text-sm font-medium text-purple-700">#{selectedTag}</span>
            <span className="text-xs text-purple-500">({taggedTasks.length})</span>
          </div>
          <button
            onClick={() => setSelectedTag(null)}
            className="p-1 hover:bg-purple-100 rounded transition-colors"
          >
            <X size={14} className="text-purple-500" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!selectedTag ? (
          // Tag List
          <div className="p-2">
            {filteredTags.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Tag size={24} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">태그가 없습니다</p>
                <p className="text-xs mt-1">테스크나 노트에 #태그를 추가해보세요</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredTags.map(({ tag, count }) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-purple-500">#</span>
                      <span className="text-gray-700 group-hover:text-gray-900">{tag}</span>
                    </div>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Tagged Tasks List
          <div className="p-2">
            {taggedTasks.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm">이 태그의 항목이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-1">
                {taggedTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={(e) => onTaskClick(e, task)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-start gap-2">
                      <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                        task.status === 'completed' ? 'bg-green-400' :
                        task.type === 'note' ? 'bg-amber-400' : 'bg-blue-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${
                          task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-700'
                        }`}>
                          {task.title}
                        </p>
                        {task.tags && task.tags.length > 1 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {task.tags.filter(t => t !== selectedTag).slice(0, 3).map(t => (
                              <span key={t} className="text-xs text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded">
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {task.type === 'note' ? '노트' : '테스크'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats Footer */}
      <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>총 {tagStats.length}개 태그</span>
          <span>{tasks.filter(t => t.tags && t.tags.length > 0 && !t.is_auto_generated).length}개 항목</span>
        </div>
      </div>
    </div>
  )
}




