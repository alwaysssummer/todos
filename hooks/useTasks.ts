import { useEffect, useState } from 'react'
// import { supabase } from '@/lib/supabase'
import type { Task } from '@/types/database'

// 임시 Mock 데이터 생성용 ID
const generateId = () => Math.random().toString(36).substr(2, 9)

export function useTasks() {
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)

    // 초기 로드 (Mock Data)
    useEffect(() => {
        // 임시 더미 데이터
        const initialTasks: Task[] = [
            {
                id: '1',
                title: '프로젝트 기획서 작성',
                status: 'inbox',
                is_top5: true,
                created_at: new Date().toISOString(),
                user_id: 'user-1'
            },
            {
                id: '2',
                title: '디자인 시안 검토',
                status: 'inbox',
                is_top5: false,
                created_at: new Date().toISOString(),
                user_id: 'user-1'
            },
            {
                id: '3',
                title: '주간 회의 준비',
                status: 'scheduled',
                start_time: new Date(2025, 10, 19, 14, 0).toISOString(), // 11월 19일 14:00
                duration: 60,
                is_top5: false,
                created_at: new Date().toISOString(),
                user_id: 'user-1'
            }
        ]
        setTasks(initialTasks)
        setLoading(false)
    }, [])

    // DB 없이 로컬 상태만 업데이트
    const createTask = async (task: Partial<Task>) => {
        const newTask: Task = {
            id: generateId(),
            created_at: new Date().toISOString(),
            user_id: 'temp-user',
            title: task.title || 'New Task',
            status: task.status || 'inbox',
            is_top5: task.is_top5 || false,
            ...task
        }
        
        setTasks(prev => [newTask, ...prev])
        return newTask
    }

    const updateTask = async (id: string, updates: Partial<Task>) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    }

    const deleteTask = async (id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id))
    }

    const reorderTasks = (activeId: string, overId: string) => {
        setTasks((prev) => {
            const oldIndex = prev.findIndex((t) => t.id === activeId)
            const newIndex = prev.findIndex((t) => t.id === overId)
            
            if (oldIndex === -1 || newIndex === -1) return prev

            const newTasks = [...prev]
            const [movedTask] = newTasks.splice(oldIndex, 1)
            newTasks.splice(newIndex, 0, movedTask)
            
            return newTasks
        })
    }

    const fetchTasks = async () => {
        // DB 연동 전이라 할 게 없음
    }

    return { 
        tasks, 
        loading, 
        createTask, 
        updateTask, 
        deleteTask, 
        reorderTasks, 
        refetch: fetchTasks,
    }
}
