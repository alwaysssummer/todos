'use client'

import { useState, useMemo } from 'react'
import { X } from 'lucide-react'
import type { Task, Project } from '@/types/database'
import TaskCard from './TaskCard'

interface TagModalProps {
    isOpen: boolean
    onClose: () => void
    selectedTags: string[]
    tasks: Task[]
    projects: Project[]
    updateTask: (id: string, updates: Partial<Task>) => Promise<void>
    deleteTask: (id: string) => Promise<void>
    onTagSelect: (tag: string) => void
    allTags: string[]
}

export default function TagModal({
    isOpen,
    onClose,
    selectedTags,
    tasks,
    projects,
    updateTask,
    deleteTask,
    onTagSelect,
    allTags
}: TagModalProps) {
    // State
    const [filterMode, setFilterMode] = useState<'AND' | 'OR'>('AND')
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('active')
    const [projectFilter, setProjectFilter] = useState<string | null>(null)
    const [sortBy, setSortBy] = useState<'date' | 'priority' | 'project'>('date')
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)

    // 필터링 로직
    const filteredTasks = useMemo(() => {
        let result = tasks

        // 태그 필터 (AND/OR)
        if (selectedTags.length > 0) {
            result = result.filter(task => {
                if (!task.tags || task.tags.length === 0) return false

                if (filterMode === 'AND') {
                    return selectedTags.every(tag => task.tags?.includes(tag))
                } else {
                    return selectedTags.some(tag => task.tags?.includes(tag))
                }
            })
        }

        // 상태 필터
        if (statusFilter === 'active') {
            result = result.filter(t => t.status !== 'completed')
        } else if (statusFilter === 'completed') {
            result = result.filter(t => t.status === 'completed')
        }

        // 프로젝트 필터
        if (projectFilter) {
            result = result.filter(t => t.project_id === projectFilter)
        }

        // 정렬
        result = [...result].sort((a, b) => {
            if (sortBy === 'date') {
                const aDate = a.start_time || a.due_date || a.created_at
                const bDate = b.start_time || b.due_date || b.created_at
                return new Date(bDate).getTime() - new Date(aDate).getTime()
            } else if (sortBy === 'priority') {
                if (a.is_top5 !== b.is_top5) return a.is_top5 ? -1 : 1
                return 0
            } else {
                // project
                return (a.project_id || '').localeCompare(b.project_id || '')
            }
        })

        return result
    }, [tasks, selectedTags, filterMode, statusFilter, projectFilter, sortBy])

    // 관련 태그 추출 (선택된 태그와 함께 자주 나타나는 태그)
    const relatedTags = useMemo(() => {
        const tagCounts: Record<string, number> = {}
        filteredTasks.forEach(task => {
            task.tags?.forEach(tag => {
                if (!selectedTags.includes(tag)) {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1
                }
            })
        })
        return Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([tag]) => tag)
    }, [filteredTasks, selectedTags])

    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="w-[90vw] h-[90vh] max-w-6xl bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-gray-900">
                                {selectedTags.map(tag => `#${tag}`).join(' ')}
                            </h2>
                            <span className="text-sm text-gray-500">
                                ({filteredTasks.length} tasks)
                            </span>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 mb-3">
                        {/* AND/OR Toggle */}
                        {selectedTags.length > 1 && (
                            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                                <button
                                    onClick={() => setFilterMode('AND')}
                                    className={`px-3 py-1 text-sm rounded transition-colors ${filterMode === 'AND' ? 'bg-white shadow-sm font-medium' : 'text-gray-600'
                                        }`}
                                >
                                    AND
                                </button>
                                <button
                                    onClick={() => setFilterMode('OR')}
                                    className={`px-3 py-1 text-sm rounded transition-colors ${filterMode === 'OR' ? 'bg-white shadow-sm font-medium' : 'text-gray-600'
                                        }`}
                                >
                                    OR
                                </button>
                            </div>
                        )}

                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="px-3 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                        </select>

                        {/* Project Filter */}
                        <select
                            value={projectFilter || ''}
                            onChange={(e) => setProjectFilter(e.target.value || null)}
                            className="px-3 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All Projects</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>

                        {/* Sort */}
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="px-3 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="date">Sort by Date</option>
                            <option value="priority">Sort by Priority</option>
                            <option value="project">Sort by Project</option>
                        </select>
                    </div>

                    {/* Related Tags */}
                    {relatedTags.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-500">Related:</span>
                            {relatedTags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => onTagSelect(tag)}
                                    className="px-2 py-1 text-xs bg-gray-100 hover:bg-blue-100 text-gray-700 rounded-full transition-colors"
                                >
                                    #{tag}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Task List */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-3">
                        {filteredTasks.map(task => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                isExpanded={expandedTaskId === task.id}
                                onToggleExpand={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                                updateTask={updateTask}
                                deleteTask={deleteTask}
                                projects={projects}
                            />
                        ))}
                        {filteredTasks.length === 0 && (
                            <div className="text-center py-12 text-gray-400">
                                <p className="text-lg">No tasks found</p>
                                <p className="text-sm mt-2">Try adjusting your filters</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
