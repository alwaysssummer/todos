import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/types/database'

export function useTasks() {
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)

    // Supabase에서 Tasks 로드
    const fetchTasks = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .order('order_index', { ascending: true })

            if (error) throw error
            if (error) throw error

            // 클라이언트 필터링: 프로젝트가 없는 자동 생성 태스크(고아 데이터) 제외
            const validTasks = (data || []).filter(t => {
                if (t.is_auto_generated && !t.project_id) return false
                return true
            })

            setTasks(validTasks)
        } catch (error) {
            console.error('Error fetching tasks:', error)
        } finally {
            setLoading(false)
        }
    }

    // 초기 로드
    useEffect(() => {
        fetchTasks()
    }, [])

    // Task 생성
    const createTask = async (task: Partial<Task>) => {
        try {
            // order_index 계산 (가장 큰 값 + 1)
            const maxOrder = tasks.reduce((max, t) => Math.max(max, t.order_index || 0), 0)

            const newTask = {
                title: task.title || 'New Task',
                status: task.status || 'inbox',
                is_top5: task.is_top5 || false,
                order_index: maxOrder + 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                ...task
            }

            const { data, error } = await supabase
                .from('tasks')
                .insert([newTask])
                .select()
                .single()

            if (error) throw error

            // 로컬 상태 업데이트
            setTasks(prev => [data, ...prev])
            return data
        } catch (error) {
            console.error('Error creating task:', error)
            throw error
        }
    }

    // Task 업데이트 (낙관적 업데이트 최적화)
    const updateTask = async (id: string, updates: Partial<Task>) => {
        // 1. 로컬 상태 즉시 업데이트 (UI 반응성 향상)
        const previousTasks = tasks
        const updatedAt = new Date().toISOString()
        
        setTasks(prev => prev.map(t => 
            t.id === id ? { ...t, ...updates, updated_at: updatedAt } : t
        ))

        try {
            // 2. 서버에 업데이트 요청 (select 제거로 성능 향상)
            const { error } = await supabase
                .from('tasks')
                .update({
                    ...updates,
                    updated_at: updatedAt
                })
                .eq('id', id)

            if (error) throw error

            // 3. 서버 응답으로 재업데이트 안 함 (이미 로컬 상태가 정확하므로)
            // 중복 리렌더링 방지!
        } catch (error) {
            console.error('Error updating task:', JSON.stringify(error, null, 2))
            // 4. 에러 시 이전 상태로 롤백
            setTasks(previousTasks)
            throw error
        }
    }

    // Task 삭제
    const deleteTask = async (id: string) => {
        try {
            const { error } = await supabase
                .from('tasks')
                .delete()
                .eq('id', id)

            if (error) throw error

            // 로컬 상태 업데이트
            setTasks(prev => prev.filter(t => t.id !== id))
        } catch (error) {
            console.error('Error deleting task:', error)
            throw error
        }
    }

    // Task 순서 변경
    const reorderTasks = async (activeId: string, overId: string) => {
        const oldIndex = tasks.findIndex((t) => t.id === activeId)
        const newIndex = tasks.findIndex((t) => t.id === overId)

        if (oldIndex === -1 || newIndex === -1) return

        const newTasks = [...tasks]
        const [movedTask] = newTasks.splice(oldIndex, 1)
        newTasks.splice(newIndex, 0, movedTask)

        // order_index 재계산
        const updatedTasks = newTasks.map((task, index) => ({
            ...task,
            order_index: index
        }))

        // 로컬 상태 즉시 업데이트 (UI 반응성)
        setTasks(updatedTasks)

        try {
            // DB 업데이트 (batch update)
            const updates = updatedTasks.map(task => ({
                id: task.id,
                order_index: task.order_index,
                updated_at: new Date().toISOString()
            }))

            // Supabase는 batch update를 직접 지원하지 않으므로
            // 변경된 항목만 개별 업데이트
            const promises = updates.map(update =>
                supabase
                    .from('tasks')
                    .update({ order_index: update.order_index, updated_at: update.updated_at })
                    .eq('id', update.id)
            )

            await Promise.all(promises)
        } catch (error) {
            console.error('Error reordering tasks:', error)
            // 에러 시 다시 fetch
            fetchTasks()
        }
    }

    // 체크박스 토글 전용 최적화 함수 (초고속 반응)
    const toggleTaskStatus = (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'completed' ? 'inbox' : 'completed'
        
        // 즉시 UI 업데이트 (최대 속도)
        setTasks(prev => prev.map(t => 
            t.id === id ? { ...t, status: newStatus } : t
        ))

        // 백그라운드에서 서버 동기화 (await 없음)
        supabase
            .from('tasks')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', id)
            .then(({ error }) => {
                if (error) {
                    console.error('Failed to sync status:', error)
                    // 에러 시 전체 새로고침
                    fetchTasks()
                }
            })
    }

    return {
        tasks,
        loading,
        createTask,
        updateTask,
        deleteTask,
        reorderTasks,
        toggleTaskStatus,
        refetch: fetchTasks,
    }
}
