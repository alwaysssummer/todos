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
    } else if (data) {
      setLinks(data)
    }
    setLoading(false)
  }

  const createLink = async (link: Partial<NotionLink>) => {
    const { data, error } = await supabase
      .from('notion_links')
      .insert([{
        title: link.title,
        url: link.url,
        order_index: link.order_index ?? links.length
      }])
      .select()
    
    if (error) {
      console.error('❌ Notion Link 생성 에러:', error)
      alert('링크 생성 실패: ' + error.message)
      return
    }
    
    if (data) {
      setLinks([...links, data[0]])
      return data[0]
    }
  }

  const deleteLink = async (id: string) => {
    const { error } = await supabase
      .from('notion_links')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('❌ Notion Link 삭제 에러:', error)
      alert('링크 삭제 실패: ' + error.message)
      return
    }
    
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
    for (let i = 0; i < newLinks.length; i++) {
      await supabase
        .from('notion_links')
        .update({ order_index: i })
        .eq('id', newLinks[i].id)
    }
  }

  return { links, loading, createLink, deleteLink, reorderLinks }
}

