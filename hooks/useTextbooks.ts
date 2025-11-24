import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Textbook } from '@/types/database'

export function useTextbooks() {
    const [textbooks, setTextbooks] = useState<Textbook[]>([])
    const [loading, setLoading] = useState(true)

    // Supabase에서 교재 로드
    const fetchTextbooks = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('textbooks')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Supabase error fetching textbooks:', error)
                throw error
            }

            setTextbooks(data || [])
        } catch (error) {
            console.error('Error fetching textbooks:', error instanceof Error ? error.message : JSON.stringify(error))
        } finally {
            setLoading(false)
        }
    }

    // 초기 로드
    useEffect(() => {
        fetchTextbooks()
    }, [])

    // 교재 생성
    const createTextbook = async (textbook: Partial<Textbook>) => {
        try {
            const newTextbook = {
                name: textbook.name || '',
                total_chapters: textbook.total_chapters || 1,
                chapter_unit: textbook.chapter_unit || '강',
                custom_chapter_unit: textbook.custom_chapter_unit,
            }

            const { data, error } = await supabase
                .from('textbooks')
                .insert([newTextbook])
                .select()
                .single()

            if (error) throw error

            // 로컬 상태 업데이트
            setTextbooks(prev => [data, ...prev])
            return data
        } catch (error) {
            console.error('Error creating textbook:', error)
            throw error
        }
    }

    // 교재 삭제
    const deleteTextbook = async (id: string) => {
        try {
            const { error } = await supabase
                .from('textbooks')
                .delete()
                .eq('id', id)

            if (error) throw error

            // 로컬 상태 업데이트
            setTextbooks(prev => prev.filter(t => t.id !== id))
        } catch (error) {
            console.error('Error deleting textbook:', error)
            throw error
        }
    }

    // 프로젝트의 모든 수업에서 특정 교재 데이터 정리
    const cleanTextbookDataFromTasks = async (projectId: string, textbookId: string) => {
        try {
            // 해당 프로젝트의 모든 수업 조회
            const { data: projectTasks, error: fetchError } = await supabase
                .from('tasks')
                .select('*')
                .eq('project_id', projectId)

            if (fetchError) throw fetchError
            if (!projectTasks) return

            let cleanedCount = 0

            // 각 수업의 과제 데이터에서 해당 교재 제거
            for (const task of projectTasks) {
                let needsUpdate = false
                const updates: any = {}

                // homework_checks에서 해당 교재 제거
                if (task.homework_checks && Array.isArray(task.homework_checks)) {
                    const cleaned = task.homework_checks.filter(
                        (check: any) => check.textbook_id !== textbookId
                    )
                    if (cleaned.length !== task.homework_checks.length) {
                        updates.homework_checks = cleaned.length > 0 ? cleaned : null
                        needsUpdate = true
                    }
                }

                // homework_assignments에서 해당 교재 제거
                if (task.homework_assignments && Array.isArray(task.homework_assignments)) {
                    const cleaned = task.homework_assignments.filter(
                        (assignment: any) => assignment.textbook_id !== textbookId
                    )
                    if (cleaned.length !== task.homework_assignments.length) {
                        updates.homework_assignments = cleaned.length > 0 ? cleaned : null
                        needsUpdate = true
                    }
                }

                // 업데이트 필요한 경우만 실행
                if (needsUpdate) {
                    const { error: updateError } = await supabase
                        .from('tasks')
                        .update(updates)
                        .eq('id', task.id)

                    if (updateError) {
                        console.error('Error updating task:', updateError)
                    } else {
                        cleanedCount++
                    }
                }
            }

            console.log(`✅ ${cleanedCount}개 수업에서 교재 데이터 정리 완료`)
            return cleanedCount
        } catch (error) {
            console.error('Error cleaning textbook data:', error)
            throw error
        }
    }

    return {
        textbooks,
        loading,
        createTextbook,
        deleteTextbook,
        cleanTextbookDataFromTasks,
        refetch: fetchTextbooks,
    }
}

