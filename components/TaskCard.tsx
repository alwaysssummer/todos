'use client'

import { useState } from 'react'
import { Check, Calendar, Folder, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import type { Task, Project } from '@/types/database'

interface TaskCardProps {
    task: Task
    isExpanded: boolean
    onToggleExpand: () => void
    updateTask: (id: string, updates: Partial<Task>) => Promise<void>
    deleteTask: (id: string) => Promise<void>
    projects: Project[]
    onEdit?: (task: Task) => void
    toggleTaskStatus?: (id: string, currentStatus: string) => void
}

export default function TaskCard({ task, isExpanded, onToggleExpand, updateTask, deleteTask, projects, onEdit, toggleTaskStatus }: TaskCardProps) {
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
        <div className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
            {/* Collapsed View */}
            <div
                onClick={onToggleExpand}
                className="w-full p-4 text-left hover:bg-gray-50 transition-colors cursor-pointer"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            {/* Status Checkbox */}
                            <button
                                onClick={handleToggleComplete}
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${task.status === 'completed'
                                        ? 'bg-blue-500 border-blue-500'
                                        : 'border-gray-300 hover:border-blue-400'
                                    }`}
                            >
                                {task.status === 'completed' && <Check size={14} className="text-white" />}
                            </button>

                            {/* Title */}
                            <h3 className={`text-lg font-medium ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                {task.title}
                            </h3>

                            {/* Priority Indicator */}
                            {task.is_top5 && (
                                <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="Top 5" />
                            )}
                        </div>

                        {/* Meta Info */}
                        <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
                            {task.start_time && (
                                <span className="flex items-center gap-1">
                                    <Calendar size={14} />
                                    {format(new Date(task.start_time), 'M/d HH:mm')}
                                </span>
                            )}
                            {task.due_date && !task.start_time && (
                                <span className="flex items-center gap-1">
                                    <Calendar size={14} />
                                    Due: {format(new Date(task.due_date), 'M/d')}
                                </span>
                            )}
                            {project && (
                                <span className="flex items-center gap-1">
                                    <Folder size={14} />
                                    {project.name}
                                </span>
                            )}
                            {task.tags && task.tags.length > 0 && (
                                <div className="flex gap-1 flex-wrap">
                                    {task.tags.map(tag => (
                                        <span key={tag} className="text-xs text-gray-400">#{tag}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Expand Icon */}
                    <ChevronDown
                        size={20}
                        className={`text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                </div>
            </div>

            {/* Expanded View */}
            {isExpanded && (
                <div className="p-4 pt-0 border-t border-gray-100 bg-gray-50">
                    {/* Description */}
                    {task.description && (
                        <div className="mb-3">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.description}</p>
                        </div>
                    )}

                    {/* Additional Info */}
                    <div className="mb-3 text-sm text-gray-600 space-y-1">
                        {task.duration && (
                            <div>Duration: {task.duration} minutes</div>
                        )}
                        {task.created_at && (
                            <div>Created: {format(new Date(task.created_at), 'yyyy-MM-dd HH:mm')}</div>
                        )}
                    </div>

                    {/* Edit Actions */}
                    <div className="flex gap-2">
                        {onEdit && (
                            <button
                                onClick={() => onEdit(task)}
                                className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                            >
                                Edit
                            </button>
                        )}
                        <button
                            onClick={() => {
                                if (confirm('Delete this task?')) {
                                    deleteTask(task.id)
                                }
                            }}
                            className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
