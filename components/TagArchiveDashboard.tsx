'use client'

import { useState, useMemo } from 'react'
import { X, Search } from 'lucide-react'
import type { Task, Project } from '@/types/database'
import ArchiveCard from './ArchiveCard'
import ArchiveListItem from './ArchiveListItem'
import ArchiveTimeline from './ArchiveTimeline'

interface TagArchiveDashboardProps {
    isOpen: boolean
    onClose: () => void
    tasks: Task[]
    projects: Project[]
    updateTask: (id: string, updates: Partial<Task>) => Promise<void>
    deleteTask: (id: string) => Promise<void>
    onTagClick: (tag: string) => void
}

export default function TagArchiveDashboard({
    isOpen,
    onClose,
    tasks,
    projects,
    updateTask,
    deleteTask,
    onTagClick
}: TagArchiveDashboardProps) {
    // State
    const [viewMode, setViewMode] = useState<'grid' | 'list' | 'timeline'>('grid')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedTag, setSelectedTag] = useState<string | null>(null)
    const [showCompleted, setShowCompleted] = useState(true)

    // 태그가 있는 모든 태스크 (완료/미완료 포함, 학생 시간표 제외)
    const archivedTasks = useMemo(() => {
        return tasks.filter(task =>
            task.tags &&
            task.tags.length > 0 &&
            !task.is_auto_generated
        )
    }, [tasks])

    // 모든 태그 추출 및 통계
    const tagStats = useMemo(() => {
        const stats: Record<string, {
            total: number
            completed: number
            recent: Date
        }> = {}

        archivedTasks.forEach(task => {
            task.tags?.forEach(tag => {
                if (!stats[tag]) {
                    stats[tag] = { total: 0, completed: 0, recent: new Date(0) }
                }
                stats[tag].total++
                if (task.status === 'completed') stats[tag].completed++

                const taskDate = new Date(task.updated_at || task.created_at)
                if (taskDate > stats[tag].recent) {
                    stats[tag].recent = taskDate
                }
            })
        })

        return Object.entries(stats)
            .map(([tag, data]) => ({
                tag,
                ...data,
                completionRate: (data.completed / data.total) * 100
            }))
            .sort((a, b) => b.total - a.total)
    }, [archivedTasks])

    // 필터링 및 검색
    const filteredTasks = useMemo(() => {
        let result = archivedTasks

        // 완료 필터
        if (!showCompleted) {
            result = result.filter(t => t.status !== 'completed')
        }

        // 태그 필터
        if (selectedTag) {
            result = result.filter(t => t.tags?.includes(selectedTag))
        }

        // 검색
        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            result = result.filter(t =>
                t.title.toLowerCase().includes(query) ||
                t.description?.toLowerCase().includes(query) ||
                t.tags?.some(tag => tag.toLowerCase().includes(query))
            )
        }

        return result
    }, [archivedTasks, showCompleted, selectedTag, searchQuery])

    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="w-[95vw] h-[95vh] max-w-7xl bg-white rounded-xl shadow-2xl flex overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Left Sidebar - Tag List */}
                <div className="w-64 border-r border-gray-200 flex flex-col">
                    <div className="p-4 border-b border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-bold text-gray-900">📚 Archive</h2>
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-gray-100 rounded transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="text-sm text-gray-500">
                            {archivedTasks.length} records
                        </div>
                    </div>

                    {/* Search */}
                    <div className="p-3 border-b border-gray-200">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search..."
                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Tag List */}
                    <div className="flex-1 overflow-y-auto p-3">
                        <button
                            onClick={() => setSelectedTag(null)}
                            className={`w-full text-left px-3 py-2 text-sm rounded-lg mb-1 transition-colors ${!selectedTag ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-100 text-gray-700'
                                }`}
                        >
                            All Tags ({tagStats.length})
                        </button>
                        {tagStats.map(({ tag, total, completionRate }) => (
                            <button
                                key={tag}
                                onClick={() => setSelectedTag(tag)}
                                className={`w-full text-left px-3 py-2 text-sm rounded-lg mb-1 transition-colors ${selectedTag === tag ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-100 text-gray-700'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span>#{tag}</span>
                                    <span className="text-xs text-gray-400">{total}</span>
                                </div>
                                <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-green-500 transition-all"
                                        style={{ width: `${completionRate}%` }}
                                    />
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Options */}
                    <div className="p-3 border-t border-gray-200">
                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                            <input
                                type="checkbox"
                                checked={showCompleted}
                                onChange={(e) => setShowCompleted(e.target.checked)}
                                className="rounded"
                            />
                            Show completed
                        </label>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col">
                    {/* Header */}
                    <div className="p-6 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">
                                    {selectedTag ? `#${selectedTag}` : 'All Records'}
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}
                                </p>
                            </div>

                            {/* View Mode */}
                            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`px-3 py-1 text-sm rounded transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm font-medium' : 'text-gray-600'
                                        }`}
                                >
                                    Grid
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`px-3 py-1 text-sm rounded transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm font-medium' : 'text-gray-600'
                                        }`}
                                >
                                    List
                                </button>
                                <button
                                    onClick={() => setViewMode('timeline')}
                                    className={`px-3 py-1 text-sm rounded transition-colors ${viewMode === 'timeline' ? 'bg-white shadow-sm font-medium' : 'text-gray-600'
                                        }`}
                                >
                                    Timeline
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Task List */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {viewMode === 'grid' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredTasks.map(task => (
                                    <ArchiveCard
                                        key={task.id}
                                        task={task}
                                        projects={projects}
                                        updateTask={updateTask}
                                        deleteTask={deleteTask}
                                        onTagClick={onTagClick}
                                    />
                                ))}
                            </div>
                        )}

                        {viewMode === 'list' && (
                            <div className="space-y-2">
                                {filteredTasks.map(task => (
                                    <ArchiveListItem
                                        key={task.id}
                                        task={task}
                                        projects={projects}
                                        updateTask={updateTask}
                                        deleteTask={deleteTask}
                                        onTagClick={onTagClick}
                                    />
                                ))}
                            </div>
                        )}

                        {viewMode === 'timeline' && (
                            <ArchiveTimeline
                                tasks={filteredTasks}
                                projects={projects}
                                updateTask={updateTask}
                                deleteTask={deleteTask}
                                onTagClick={onTagClick}
                            />
                        )}

                        {filteredTasks.length === 0 && (
                            <div className="text-center py-12 text-gray-400">
                                <p className="text-lg">No records found</p>
                                <p className="text-sm mt-2">Add tags to your tasks to archive them</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
