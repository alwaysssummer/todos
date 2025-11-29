import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Textbook } from '@/types/database'

export function useTextbooks() {
    const [textbooks, setTextbooks] = useState<Textbook[]>([])
    const [loading, setLoading] = useState(true)

    // Supabase에서 교재 로드
    const fetchTextbooks = useCallback(async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('textbooks')
                .select('*')
                .order('order_index', { ascending: true })
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
    }, [])

    // 초기 로드
    useEffect(() => {
        fetchTextbooks()
    }, [fetchTextbooks])

    // 교재 생성
    const createTextbook = useCallback(async (textbook: Partial<Textbook>): Promise<Textbook> => {
        try {
            // 같은 그룹/서브그룹 내에서 최대 order_index 계산
            const sameGroupTextbooks = textbooks.filter(t => 
                t.group_id === textbook.group_id && t.subgroup_id === textbook.subgroup_id
            )
            const maxOrderIndex = sameGroupTextbooks.length > 0
                ? Math.max(...sameGroupTextbooks.map(t => t.order_index || 0)) + 1
                : 0

            const newTextbook = {
                name: textbook.name || '',
                total_chapters: textbook.total_chapters || 1,
                chapter_unit: textbook.chapter_unit || '강',
                custom_chapter_unit: textbook.custom_chapter_unit,
                group_id: textbook.group_id || null,
                subgroup_id: textbook.subgroup_id || null,
                order_index: maxOrderIndex,
            }

            const { data, error } = await supabase
                .from('textbooks')
                .insert([newTextbook])
                .select()
                .single()

            if (error) throw error

            // 로컬 상태 업데이트
            setTextbooks(prev => [...prev, data].sort((a, b) => (a.order_index || 0) - (b.order_index || 0)))
            return data
        } catch (error) {
            console.error('Error creating textbook:', error)
            throw error
        }
    }, [textbooks])

    // 교재 삭제
    const deleteTextbook = useCallback(async (id: string): Promise<void> => {
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
    }, [])

    // 교재 그룹 변경
    const updateTextbookGroup = useCallback(async (id: string, groupId: string | null): Promise<Textbook> => {
        try {
            // 그룹이 변경되면 서브그룹도 초기화
            const { data, error } = await supabase
                .from('textbooks')
                .update({ group_id: groupId, subgroup_id: null })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error

            setTextbooks(prev => prev.map(t => t.id === id ? data : t))
            return data
        } catch (error) {
            console.error('Error updating textbook group:', error)
            throw error
        }
    }, [])

    // 교재 서브그룹 변경
    const updateTextbookSubgroup = useCallback(async (id: string, subgroupId: string | null): Promise<Textbook> => {
        try {
            const { data, error } = await supabase
                .from('textbooks')
                .update({ subgroup_id: subgroupId })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error

            setTextbooks(prev => prev.map(t => t.id === id ? data : t))
            return data
        } catch (error) {
            console.error('Error updating textbook subgroup:', error)
            throw error
        }
    }, [])

    // 교재 단원 수 변경
    const updateTextbookChapters = useCallback(async (id: string, totalChapters: number): Promise<Textbook> => {
        try {
            const { data, error } = await supabase
                .from('textbooks')
                .update({ total_chapters: totalChapters })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error

            setTextbooks(prev => prev.map(t => t.id === id ? data : t))
            return data
        } catch (error) {
            console.error('Error updating textbook chapters:', error)
            throw error
        }
    }, [])

    // 교재 순서 변경 (같은 그룹/서브그룹 내에서)
    const reorderTextbooks = useCallback(async (reorderedTextbooks: Textbook[]): Promise<void> => {
        // 로컬 상태 먼저 업데이트 (낙관적 업데이트)
        setTextbooks(prev => {
            const otherTextbooks = prev.filter(t => !reorderedTextbooks.find(r => r.id === t.id))
            return [...otherTextbooks, ...reorderedTextbooks.map((t, i) => ({ ...t, order_index: i }))]
                .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
        })

        // DB 업데이트
        const updates = reorderedTextbooks.map((textbook, index) =>
            supabase
                .from('textbooks')
                .update({ order_index: index })
                .eq('id', textbook.id)
        )

        try {
            await Promise.all(updates)
        } catch (error) {
            console.error('Error reordering textbooks:', error)
            fetchTextbooks() // 실패 시 다시 로드
            throw error
        }
    }, [fetchTextbooks])

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
        updateTextbookGroup,
        updateTextbookSubgroup,
        updateTextbookChapters,
        reorderTextbooks,
        cleanTextbookDataFromTasks,
        refetch: fetchTextbooks,
    }
}

