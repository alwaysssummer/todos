import type { Task, Project, NotionLink } from '@/types/database'

export interface LeftPanelProps {
  tasks: Task[]
  createTask: (task: Partial<Task>) => Promise<any>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  reorderTasks: (activeId: string, overId: string) => void
  toggleTaskStatus: (id: string, currentStatus: string) => void
  projects: Project[]
  createProject: (project: Partial<Project>) => Promise<Project>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
}

export type PanelTab = 'main' | 'tasks' | 'notes' | 'tags'

