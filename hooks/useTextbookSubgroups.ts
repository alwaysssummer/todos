'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { TextbookSubgroup } from '@/types/database'

export function useTextbookSubgroups() {
    const [subgroups, setSubgroups] = useState<TextbookSubgroup[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // 서브그룹 목록 조회
    const fetchSubgroups = useCallback(async () => {
        try {
            setLoading(true)
            const { data, error: fetchError } = await supabase
                .from('textbook_subgroups')
                .select('*')
                .order('order_index', { ascending: true })

            if (fetchError) throw fetchError
            setSubgroups(data || [])
        } catch (err) {
            console.error('Error fetching textbook subgroups:', err)
            setError(err instanceof Error ? err.message : 'Failed to fetch subgroups')
        } finally {
            setLoading(false)
        }
    }, [])

    // 초기 로드
    useEffect(() => {
        fetchSubgroups()
    }, [fetchSubgroups])

    // 서브그룹 생성
    const createSubgroup = useCallback(async (groupId: string, name: string): Promise<TextbookSubgroup> => {
        const groupSubgroups = subgroups.filter(s => s.group_id === groupId)
        const maxOrderIndex = groupSubgroups.length > 0
            ? Math.max(...groupSubgroups.map(s => s.order_index)) + 1
            : 0

        const { data, error: createError } = await supabase
            .from('textbook_subgroups')
            .insert({
                group_id: groupId,
                name,
                order_index: maxOrderIndex
            })
            .select()
            .single()

        if (createError) throw createError

        setSubgroups(prev => [...prev, data].sort((a, b) => a.order_index - b.order_index))
        return data
    }, [subgroups])

    // 서브그룹 수정 (name, local_path 지원)
    const updateSubgroup = useCallback(async (id: string, updates: { name?: string; local_path?: string | null }): Promise<TextbookSubgroup> => {
        const { data, error: updateError } = await supabase
            .from('textbook_subgroups')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (updateError) throw updateError

        setSubgroups(prev => prev.map(s => s.id === id ? data : s))
        return data
    }, [])

    // 서브그룹 삭제
    const deleteSubgroup = useCallback(async (id: string): Promise<void> => {
        // 먼저 해당 서브그룹의 교재들의 subgroup_id를 null로 변경
        await supabase
            .from('textbooks')
            .update({ subgroup_id: null })
            .eq('subgroup_id', id)

        const { error: deleteError } = await supabase
            .from('textbook_subgroups')
            .delete()
            .eq('id', id)

        if (deleteError) throw deleteError

        setSubgroups(prev => prev.filter(s => s.id !== id))
    }, [])

    // 서브그룹 순서 변경
    const reorderSubgroups = useCallback(async (reorderedSubgroups: TextbookSubgroup[]): Promise<void> => {
        // 로컬 상태 먼저 업데이트 (낙관적 업데이트)
        setSubgroups(prev => {
            const otherSubgroups = prev.filter(s => !reorderedSubgroups.find(r => r.id === s.id))
            return [...otherSubgroups, ...reorderedSubgroups.map((s, i) => ({ ...s, order_index: i }))]
                .sort((a, b) => a.order_index - b.order_index)
        })

        // DB 업데이트
        const updates = reorderedSubgroups.map((subgroup, index) =>
            supabase
                .from('textbook_subgroups')
                .update({ order_index: index })
                .eq('id', subgroup.id)
        )

        try {
            await Promise.all(updates)
        } catch (err) {
            console.error('Error reordering subgroups:', err)
            fetchSubgroups() // 실패 시 다시 로드
            throw err
        }
    }, [fetchSubgroups])

    // 특정 그룹의 서브그룹만 가져오기
    const getSubgroupsByGroupId = useCallback((groupId: string): TextbookSubgroup[] => {
        return subgroups
            .filter(s => s.group_id === groupId)
            .sort((a, b) => a.order_index - b.order_index)
    }, [subgroups])

    return {
        subgroups,
        loading,
        error,
        fetchSubgroups,
        createSubgroup,
        updateSubgroup,
        deleteSubgroup,
        reorderSubgroups,
        getSubgroupsByGroupId,
    }
}
