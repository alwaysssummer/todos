'use client'

import { useState } from 'react'
import { Check, Calendar, Folder, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import type { Task, Project } from '@/types/database'

interface ArchiveListItemProps {
    task: Task
    projects: Project[]
    updateTask: (id: string, updates: Partial<Task>) => Promise<void>
    deleteTask: (id: string) => Promise<void>
    onTagClick: (tag: string) => void
    toggleTaskStatus?: (id: string, currentStatus: string) => void
}

export default function ArchiveListItem({ task, projects, updateTask, deleteTask, onTagClick, toggleTaskStatus }: ArchiveListItemProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const project = projects.find(p => p.id === task.project_id)

    const handleToggleComplete = (e: React.MouseEvent) => {
        e.stopPropagation()
        // 체크박스 전용 초고속 함수가 있으면 사용, 없으면 일반 updateTask 사용
        if (toggleTaskStatus) {
            toggleTaskStatus(task.id, task.status)
        } else {
            updateTask(task.id, {
                status: task.status === 'completed' ? 'inbox' : 'completed'
            }).catch(error => {
                console.error('Failed to toggle task:', error)
            })
        }
    }

    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-sm transition-shadow">
            {/* Collapsed View */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-3 hover:bg-gray-50 transition-colors cursor-pointer"
            >
                <div className="flex items-center gap-3">
                    {/* Checkbox */}
                    <button
                        onClick={handleToggleComplete}
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${task.status === 'completed'
                                ? 'bg-blue-500 border-blue-500'
                                : 'border-gray-300 hover:border-blue-400'
                            }`}
                    >
                        {task.status === 'completed' && <Check size={12} className="text-white" />}
                    </button>

                    {/* Title */}
                    <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-medium truncate ${task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'
                            }`}>
                            {task.title}
                        </h4>
                    </div>

                    {/* Tags */}
                    <div className="flex gap-1 flex-shrink-0">
                        {task.tags?.slice(0, 2).map(tag => (
                            <button
                                key={tag}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onTagClick(tag)
                                }}
                                className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200"
                            >
                                #{tag}
                            </button>
                        ))}
                        {task.tags && task.tags.length > 2 && (
                            <span className="text-xs text-gray-400">+{task.tags.length - 2}</span>
                        )}
                    </div>

                    {/* Date */}
                    <span className="text-xs text-gray-500 flex-shrink-0">
                        {format(new Date(task.created_at), 'MM/dd')}
                    </span>

                    {/* Expand Icon */}
                    <ChevronDown
                        size={16}
                        className={`text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                </div>
            </div>

            {/* Expanded View */}
            {isExpanded && (
                <div className="px-3 pb-3 border-t border-gray-100 bg-gray-50">
                    {task.description && (
                        <p className="text-sm text-gray-700 mt-3 mb-2 whitespace-pre-wrap">
                            {task.description}
                        </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                        {task.start_time && (
                            <span className="flex items-center gap-1">
                                <Calendar size={12} />
                                {format(new Date(task.start_time), 'yyyy-MM-dd HH:mm')}
                            </span>
                        )}
                        {project && (
                            <span className="flex items-center gap-1">
                                <Folder size={12} />
                                {project.name}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
