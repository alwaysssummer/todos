'use client'

import { format } from 'date-fns'
import type { Task, Project } from '@/types/database'

interface ArchiveCardProps {
    task: Task
    projects: Project[]
    updateTask: (id: string, updates: Partial<Task>) => Promise<void>
    deleteTask: (id: string) => Promise<void>
    onTagClick: (tag: string) => void
}

export default function ArchiveCard({ task, projects, updateTask, deleteTask, onTagClick }: ArchiveCardProps) {
    const project = projects.find(p => p.id === task.project_id)

    return (
        <div className={`p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer ${task.status === 'completed' ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300'
            }`}>
            {/* Title */}
            <h4 className={`font-medium mb-2 ${task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                {task.title}
            </h4>

            {/* Description */}
            {task.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {task.description}
                </p>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-1 mb-3">
                {task.tags?.map(tag => (
                    <button
                        key={tag}
                        onClick={(e) => {
                            e.stopPropagation()
                            onTagClick(tag)
                        }}
                        className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
                    >
                        #{tag}
                    </button>
                ))}
            </div>

            {/* Meta */}
            <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{format(new Date(task.created_at), 'yyyy-MM-dd')}</span>
                {project && <span className="truncate ml-2">{project.name}</span>}
            </div>
        </div>
    )
}
