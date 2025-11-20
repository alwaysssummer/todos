'use client'

import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import type { Task, Project } from '@/types/database'
import ArchiveListItem from './ArchiveListItem'

interface ArchiveTimelineProps {
    tasks: Task[]
    projects: Project[]
    updateTask: (id: string, updates: Partial<Task>) => Promise<void>
    deleteTask: (id: string) => Promise<void>
    onTagClick: (tag: string) => void
}

export default function ArchiveTimeline({ tasks, projects, updateTask, deleteTask, onTagClick }: ArchiveTimelineProps) {
    // Group tasks by date
    const groupedTasks = useMemo(() => {
        const groups: Record<string, Task[]> = {}

        tasks.forEach(task => {
            const date = format(new Date(task.created_at), 'yyyy-MM-dd')
            if (!groups[date]) {
                groups[date] = []
            }
            groups[date].push(task)
        })

        // Sort dates descending
        return Object.entries(groups)
            .sort((a, b) => b[0].localeCompare(a[0]))
    }, [tasks])

    return (
        <div className="space-y-6">
            {groupedTasks.map(([date, dateTasks]) => (
                <div key={date}>
                    {/* Date Header */}
                    <div className="sticky top-0 bg-white z-10 pb-2 mb-3">
                        <h3 className="text-sm font-semibold text-gray-700">
                            {format(parseISO(date), 'MMMM d, yyyy')}
                        </h3>
                        <div className="text-xs text-gray-500">
                            {dateTasks.length} {dateTasks.length === 1 ? 'task' : 'tasks'}
                        </div>
                    </div>

                    {/* Tasks */}
                    <div className="space-y-2 pl-4 border-l-2 border-gray-200">
                        {dateTasks.map(task => (
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
                </div>
            ))}

            {groupedTasks.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                    <p>No tasks to display</p>
                </div>
            )}
        </div>
    )
}
