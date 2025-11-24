'use client'

import { useMemo, useState } from 'react'
import type { Task } from '@/types/database'

interface MobileTagsViewProps {
  tasks: Task[]
  onTagSelect?: (tag: string) => void
}

export default function MobileTagsView({ tasks, onTagSelect }: MobileTagsViewProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // 모든 태그 추출 및 개수 계산
  const tagStats = useMemo(() => {
    const tagMap = new Map<string, number>()
    
    tasks.forEach(task => {
      if (task.tags && task.status !== 'completed') {
        task.tags.forEach(tag => {
          tagMap.set(tag, (tagMap.get(tag) || 0) + 1)
        })
      }
    })

    // 정렬: 개수 많은 순
    return Array.from(tagMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
  }, [tasks])

  // 검색 필터링
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tagStats
    
    const query = searchQuery.toLowerCase()
    return tagStats.filter(({ tag }) => 
      tag.toLowerCase().includes(query)
    )
  }, [tagStats, searchQuery])

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 검색창 */}
      <div className="bg-white border-b border-gray-200 p-3">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="태그 검색..."
            className="w-full pl-10 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg 
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <div className="mt-2 text-xs text-gray-500">
          총 {tagStats.length}개의 태그
        </div>
      </div>

      {/* 태그 목록 */}
      <div className="flex-1 overflow-y-auto pb-20">
        {filteredTags.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {filteredTags.map(({ tag, count }) => (
              <button
                key={tag}
                onClick={() => onTagSelect?.(tag)}
                className="w-full flex items-center justify-between px-4 py-3.5 bg-white active:bg-gray-50 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      #{tag}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {count}개의 태스크
                    </div>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <div className="text-sm">
              {searchQuery ? '검색 결과가 없습니다' : '태그가 없습니다'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}






