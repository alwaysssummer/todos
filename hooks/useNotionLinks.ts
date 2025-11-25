'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { NotionLink } from '@/types/database'

export function useNotionLinks() {
  const [links, setLinks] = useState<NotionLink[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLinks()
  }, [])

  const fetchLinks = async () => {
    const { data, error } = await supabase
      .from('notion_links')
      .select('*')
      .order('order_index', { ascending: true })
    
    if (error) {
      console.error('❌ Notion Links 조회 에러:', error)
      console.error('💡 Supabase에서 notion_links 테이블을 생성했는지 확인하세요!')
    }
    
    if (data) {
      console.log('✅ Notion Links 로드:', data)
      setLinks(data)
    }
    setLoading(false)
  }

  const createLink = async (link: Partial<NotionLink>) => {
    console.log('📝 Notion Link 생성 시도:', link)
    
    const { data, error } = await supabase
      .from('notion_links')
      .insert([link])
      .select()
    
    if (error) {
      console.error('❌ Notion Link 생성 에러:', error)
      alert(`링크 생성 실패: ${error.message}`)
      return
    }
    
    if (data) {
      console.log('✅ Notion Link 생성 성공:', data[0])
      setLinks([...links, data[0]])
      return data[0]
    }
  }

  const updateLink = async (id: string, updates: Partial<NotionLink>) => {
    const { data, error } = await supabase
      .from('notion_links')
      .update(updates)
      .eq('id', id)
      .select()
    
    if (data) {
      setLinks(links.map(l => l.id === id ? data[0] : l))
    }
  }

  const deleteLink = async (id: string) => {
    const { error } = await supabase
      .from('notion_links')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('❌ Notion Link 삭제 에러:', error)
      alert(`링크 삭제 실패: ${error.message}`)
      return
    }
    
    console.log('✅ Notion Link 삭제 성공:', id)
    setLinks(links.filter(l => l.id !== id))
  }

  const reorderLinks = async (activeId: string, overId: string) => {
    const oldIndex = links.findIndex(l => l.id === activeId)
    const newIndex = links.findIndex(l => l.id === overId)

    if (oldIndex === -1 || newIndex === -1) return

    const newLinks = [...links]
    const [movedLink] = newLinks.splice(oldIndex, 1)
    newLinks.splice(newIndex, 0, movedLink)

    // 로컬 상태 즉시 업데이트
    setLinks(newLinks)

    // DB 업데이트 (order_index 재설정)
    const updates = newLinks.map((link, index) => ({
      id: link.id,
      order_index: index
    }))

    for (const update of updates) {
      await supabase
        .from('notion_links')
        .update({ order_index: update.order_index })
        .eq('id', update.id)
    }
  }

  return { links, loading, createLink, updateLink, deleteLink, reorderLinks, refetchLinks: fetchLinks }
}

