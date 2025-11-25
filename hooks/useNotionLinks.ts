'use client'

import { useEffect, useState } from 'react'

export interface NotionLink {
  id: string
  title: string
  url: string
  order_index: number
  created_at: string
}

const STORAGE_KEY = 'notion_links'

export function useNotionLinks() {
  const [links, setLinks] = useState<NotionLink[]>([])
  const [loading, setLoading] = useState(true)

  // 로컬 스토리지에서 로드
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setLinks(parsed)
      } catch (e) {
        console.error('로컬 스토리지 파싱 에러:', e)
      }
    }
    setLoading(false)
  }, [])

  // 링크 변경시마다 로컬 스토리지에 저장
  const saveToStorage = (newLinks: NotionLink[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLinks))
    setLinks(newLinks)
  }

  const createLink = (link: Partial<NotionLink>) => {
    const newLink: NotionLink = {
      id: Date.now().toString(),
      title: link.title || '',
      url: link.url || '',
      order_index: links.length,
      created_at: new Date().toISOString()
    }
    
    const newLinks = [...links, newLink]
    saveToStorage(newLinks)
    return newLink
  }

  const deleteLink = (id: string) => {
    const newLinks = links.filter(l => l.id !== id)
    saveToStorage(newLinks)
  }

  const reorderLinks = (activeId: string, overId: string) => {
    const oldIndex = links.findIndex(l => l.id === activeId)
    const newIndex = links.findIndex(l => l.id === overId)

    if (oldIndex === -1 || newIndex === -1) return

    const newLinks = [...links]
    const [movedLink] = newLinks.splice(oldIndex, 1)
    newLinks.splice(newIndex, 0, movedLink)

    // order_index 재설정
    newLinks.forEach((link, index) => {
      link.order_index = index
    })

    saveToStorage(newLinks)
  }

  return { links, loading, createLink, deleteLink, reorderLinks }
}

