import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/types/database'

// 프로젝트 색상 팔레트
export const PROJECT_COLORS = [
  '#10b981', // green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ef4444', // red
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
]

let colorIndex = 0

const generateColor = () => {
  const color = PROJECT_COLORS[colorIndex % PROJECT_COLORS.length]
  colorIndex++
  return color
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  // Supabase에서 Projects 로드
  const fetchProjects = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Supabase error fetching projects:', error)
        throw error
      }
      setProjects(data || [])
    } catch (error) {
      console.error('Error fetching projects:', error instanceof Error ? error.message : JSON.stringify(error))
    } finally {
      setLoading(false)
    }
  }

  // 초기 로드
  useEffect(() => {
    fetchProjects()
  }, [])

  // Project 생성
  const createProject = async (data: Partial<Project>): Promise<Project> => {
    try {
      const newProject = {
        name: data.name || '새 프로젝트',
        color: data.color || generateColor(),
        type: data.type || 'folder',
        status: 'active',
        created_at: new Date().toISOString(),
        ...data,
      }

      const { data: insertedData, error } = await supabase
        .from('projects')
        .insert([newProject])
        .select()
        .single()
      
      if (error) throw error
      
      // 로컬 상태 업데이트
      setProjects(prev => [insertedData, ...prev])
      return insertedData
    } catch (error) {
      console.error('Error creating project:', error)
      throw error
    }
  }

  // Project 업데이트
  const updateProject = async (id: string, updates: Partial<Project>): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      
      // 로컬 상태 업데이트
      setProjects(prev => prev.map(p => (p.id === id ? data : p)))
    } catch (error) {
      console.error('Error updating project:', error)
      throw error
    }
  }

  // Project 삭제
  const deleteProject = async (id: string): Promise<void> => {
    try {
      // 1. 프로젝트에 속한 모든 태스크 먼저 삭제 (Cascade가 없을 경우 대비 및 확실한 정리)
      // 사용자 요구사항: 프로젝트 삭제 시 모든 태스크(보충 포함) 삭제
      const { error: taskError } = await supabase
        .from('tasks')
        .delete()
        .eq('project_id', id)
      
      if (taskError) throw taskError

      // 2. 프로젝트 삭제
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      // 3. 로컬 상태 업데이트
      setProjects(prev => prev.filter(p => p.id !== id))

      // 4. 상태 동기화를 위해 페이지 새로고침 (잔존 데이터 방지)
      window.location.reload()
      
    } catch (error) {
      console.error('Error deleting project:', error)
      throw error
    }
  }

  return {
    projects,
    loading,
    createProject,
    updateProject,
    deleteProject,
    refetchProjects: fetchProjects
  }
}
