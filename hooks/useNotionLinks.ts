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
    
    if (data) setLinks(data)
    setLoading(false)
  }

  const createLink = async (link: Partial<NotionLink>) => {
    const { data, error } = await supabase
      .from('notion_links')
      .insert([link])
      .select()
    
    if (data) {
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
    
    if (!error) {
      setLinks(links.filter(l => l.id !== id))
    }
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

