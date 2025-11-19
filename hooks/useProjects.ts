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
      
      if (error) throw error
      setProjects(data || [])
    } catch (error) {
      console.error('Error fetching projects:', error)
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

  // 다음 주의 특정 요일 날짜 계산
  const getNextWeekDay = (dayOfWeek: number, baseDate: Date = new Date()): Date => {
    const result = new Date(baseDate)
    const currentDay = result.getDay()
    let daysToAdd = dayOfWeek - currentDay
    
    if (daysToAdd <= 0) {
      daysToAdd += 7
    }
    
    result.setDate(result.getDate() + daysToAdd)
    return result
  }

  // 학생 시간표: 향후 4주치 수업 생성
  const generateStudentLessons = (project: Project, createTask: (task: Partial<any>) => Promise<any>) => {
    if (!project.schedule_template || project.schedule_template.length === 0) return []

    const lessons: any[] = []
    const startDate = project.start_date ? new Date(project.start_date) : new Date()
    
    // 시작일이 속한 주의 월요일을 찾기 (week의 기준점)
    const getWeekStart = (date: Date): Date => {
      const d = new Date(date)
      const day = d.getDay() // 0(일) ~ 6(토)
      const diff = day === 0 ? -6 : 1 - day // 월요일을 기준으로
      d.setDate(d.getDate() + diff)
      d.setHours(0, 0, 0, 0)
      return d
    }
    
    const weekStart = getWeekStart(startDate)

    // 향후 4주치 생성
    for (let week = 0; week < 4; week++) {
      project.schedule_template.forEach(schedule => {
        // 각 주의 월요일에서 시작
        const lessonDate = new Date(weekStart)
        lessonDate.setDate(lessonDate.getDate() + (week * 7))
        
        // 해당 요일로 이동 (0=일요일, 1=월요일, ...)
        const targetDay = schedule.day
        const mondayDay = lessonDate.getDay() // 항상 1(월요일)이어야 함
        let daysToAdd = targetDay - mondayDay
        if (targetDay === 0) daysToAdd = 6 // 일요일은 +6일
        lessonDate.setDate(lessonDate.getDate() + daysToAdd)

        // 시간 설정
        const [hour, minute] = schedule.time.split(':').map(Number)
        lessonDate.setHours(hour, minute, 0, 0)

        // 종료일 체크
        if (project.end_date && lessonDate > new Date(project.end_date)) {
          return
        }

        const lesson = {
          title: project.name,
          project_id: project.id,
          start_time: lessonDate.toISOString(),
          duration: schedule.duration || 60,
          status: 'scheduled',
          is_auto_generated: true,
          is_top5: false,
        }

        lessons.push(lesson)
      })
    }

    return lessons
  }

  // 루틴/습관: 향후 4주치 루틴 생성
  const generateHabitInstances = (project: Project, createTask: (task: Partial<any>) => Promise<any>) => {
    if (!project.repeat_days || project.repeat_days.length === 0) return []

    const instances: any[] = []
    const startDate = project.start_date ? new Date(project.start_date) : new Date()

    // 향후 4주치 생성
    for (let week = 0; week < 4; week++) {
      project.repeat_days.forEach(dayOfWeek => {
        const instanceDate = new Date(startDate)
        instanceDate.setDate(instanceDate.getDate() + (week * 7))
        
        // 해당 요일로 이동
        const currentDay = instanceDate.getDay()
        let daysToAdd = dayOfWeek - currentDay
        if (daysToAdd < 0) daysToAdd += 7
        instanceDate.setDate(instanceDate.getDate() + daysToAdd)

        // 시간 설정
        if (project.target_time) {
          const [hour, minute] = project.target_time.split(':').map(Number)
          instanceDate.setHours(hour, minute, 0, 0)
        }

        const instance = {
          title: project.name,
          project_id: project.id,
          start_time: instanceDate.toISOString(),
          duration: project.target_duration || 30,
          status: 'scheduled',
          is_auto_generated: true,
          is_top5: false,
          habit_completed: false,
        }

        instances.push(instance)
      })
    }

    return instances
  }

  return {
    projects,
    loading,
    createProject,
    updateProject,
    deleteProject,
    generateStudentLessons,
    generateHabitInstances,
  }
}

