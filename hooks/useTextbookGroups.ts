'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { TextbookGroup } from '@/types/database'

export function useTextbookGroups() {
  const [groups, setGroups] = useState<TextbookGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 그룹 목록 조회
  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('textbook_groups')
        .select('*')
        .order('order_index', { ascending: true })

      if (fetchError) throw fetchError
      setGroups(data || [])
    } catch (err) {
      console.error('Error fetching textbook groups:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch groups')
    } finally {
      setLoading(false)
    }
  }, [])

  // 그룹 생성
  const createGroup = useCallback(async (name: string): Promise<TextbookGroup> => {
    const maxOrderIndex = groups.length > 0 
      ? Math.max(...groups.map(g => g.order_index)) + 1 
      : 0

    const { data, error: createError } = await supabase
      .from('textbook_groups')
      .insert({
        name,
        order_index: maxOrderIndex
      })
      .select()
      .single()

    if (createError) throw createError
    
    setGroups(prev => [...prev, data])
    return data
  }, [groups])

  // 그룹 수정
  const updateGroup = useCallback(async (id: string, name: string): Promise<TextbookGroup> => {
    const { data, error: updateError } = await supabase
      .from('textbook_groups')
      .update({ name })
      .eq('id', id)
      .select()
      .single()

    if (updateError) throw updateError
    
    setGroups(prev => prev.map(g => g.id === id ? data : g))
    return data
  }, [])

  // 그룹 삭제
  const deleteGroup = useCallback(async (id: string): Promise<void> => {
    // 1. 해당 그룹에 속한 교재들의 group_id, subgroup_id를 null로 변경
    await supabase
      .from('textbooks')
      .update({ group_id: null, subgroup_id: null })
      .eq('group_id', id)

    // 2. 해당 그룹의 서브그룹들 삭제
    await supabase
      .from('textbook_subgroups')
      .delete()
      .eq('group_id', id)

    // 3. 그룹 삭제
    const { error: deleteError } = await supabase
      .from('textbook_groups')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError
    
    setGroups(prev => prev.filter(g => g.id !== id))
  }, [])

  // 그룹 순서 변경
  const reorderGroups = useCallback(async (reorderedGroups: TextbookGroup[]): Promise<void> => {
    // 로컬 상태 먼저 업데이트 (낙관적 업데이트)
    setGroups(reorderedGroups)

    // DB 업데이트
    const updates = reorderedGroups.map((group, index) => ({
      id: group.id,
      name: group.name,
      order_index: index,
      created_at: group.created_at
    }))

    const { error: updateError } = await supabase
      .from('textbook_groups')
      .upsert(updates)

    if (updateError) {
      console.error('Error reordering groups:', updateError)
      // 실패 시 다시 로드
      fetchGroups()
      throw updateError
    }
  }, [fetchGroups])

  // 초기 로드
  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  return {
    groups,
    loading,
    error,
    fetchGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    reorderGroups
  }
}
