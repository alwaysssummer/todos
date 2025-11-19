'use client'

import { useState, useEffect, useRef } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor, DragStartEvent } from '@dnd-kit/core'
import LeftPanel from '@/components/LeftPanel'
import CenterPanel from '@/components/CenterPanel'
import RightPanel from '@/components/RightPanel'
import MobileNavigation from '@/components/MobileNavigation'
import { useTasks } from '@/hooks/useTasks'
import { useProjects } from '@/hooks/useProjects'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/types/database'
import { addWeeks, startOfWeek, endOfWeek } from 'date-fns'

type PanelType = 'left' | 'center' | 'right'

export default function Home() {
  const [activePanel, setActivePanel] = useState<PanelType>('left')
  const { tasks, createTask, updateTask, deleteTask, reorderTasks, loading: tasksLoading, refetch: refetchTasks } = useTasks()
  const { projects, createProject, updateProject, deleteProject, generateStudentLessons, generateHabitInstances, loading: projectsLoading } = useProjects()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  
  // 보충 수업 추가 모드
  const [makeupProject, setMakeupProject] = useState<any>(null)
  const isGeneratingRef = useRef(false)

  // 자동 재생성 및 중복 제거 로직
  useEffect(() => {
    if (tasksLoading || projectsLoading) return

    const manageStudentTimetables = async () => {
      if (isGeneratingRef.current) return
      isGeneratingRef.current = true

      try {
        // 1. 중복 제거 로직 (스마트 정리)
        const uniqueMap = new Map<string, string>()
        const duplicatesToDelete: string[] = []

        tasks.forEach(task => {
          if (task.is_auto_generated && task.status !== 'completed' && task.status !== 'cancelled') {
            const key = `${task.project_id}-${task.start_time}`
            if (uniqueMap.has(key)) {
              duplicatesToDelete.push(task.id)
            } else {
              uniqueMap.set(key, task.id)
            }
          }
        })

        if (duplicatesToDelete.length > 0) {
          console.log(`🧹 중복된 수업 ${duplicatesToDelete.length}개 삭제 중...`)
          await supabase.from('tasks').delete().in('id', duplicatesToDelete)
          refetchTasks()
          return
        }

        // 2. 자동 생성 로직 (현재 날짜 기준)
        const studentProjects = projects.filter(p => p.type === 'student' && p.status === 'active')
        
        if (studentProjects.length === 0) {
          isGeneratingRef.current = false
          return
        }

        let hasGenerated = false

        for (const project of studentProjects) {
          // 현재 보고 있는 날짜 기준으로 5주 뒤까지 체크
          const checkDate = new Date(currentDate)
          
          // 해당 프로젝트의 태스크들
          const projectTasks = tasks.filter(
            t => t.project_id === project.id && 
                 t.is_auto_generated && 
                 t.status !== 'completed' && 
                 t.status !== 'cancelled'
          )

          // 생성 로직 시작
          if (project.schedule_template && project.schedule_template.length > 0) {
            const startDate = project.start_date ? new Date(project.start_date) : new Date()
            const now = new Date()
            
            // 기준일: 오늘과 (현재 보고 있는 주간 - 1주) 중 더 늦은 날짜
            // 즉, 과거 데이터는 안 만들지만, 미래 데이터는 보고 있는 시점에 맞춰서 생성
            const viewStart = new Date(currentDate)
            viewStart.setDate(viewStart.getDate() - 7) 
            
            const baseDate = startDate > now ? startDate : now
            const effectiveDate = baseDate > viewStart ? baseDate : viewStart

            const getWeekStart = (date: Date): Date => {
              const d = new Date(date)
              const day = d.getDay()
              const diff = day === 0 ? -6 : 1 - day
              d.setDate(d.getDate() + diff)
              d.setHours(0, 0, 0, 0)
              return d
            }

            const weekStart = getWeekStart(effectiveDate)
            const lessonsToCreate: any[] = []

            // 현재 시점부터 향후 6주치 스캔 및 생성 (넉넉하게)
            for (let week = 0; week < 6; week++) {
              for (const schedule of project.schedule_template) {
                const lessonDate = new Date(weekStart)
                lessonDate.setDate(lessonDate.getDate() + (week * 7))

                const targetDay = schedule.day
                const mondayDay = lessonDate.getDay()
                let daysToAdd = targetDay - mondayDay
                if (targetDay === 0) daysToAdd = 6
                lessonDate.setDate(lessonDate.getDate() + daysToAdd)

                const [hour, minute] = schedule.time.split(':').map(Number)
                lessonDate.setHours(hour, minute, 0, 0)

                // 1. 과거는 생성 안 함
                if (lessonDate < now) continue

                // 2. 종료일 체크
                if (project.end_date && lessonDate > new Date(project.end_date)) {
                  continue
                }

                // 3. 이미 존재하는지 체크 (중복 방지)
                const exists = projectTasks.some(t => {
                  const tTime = new Date(t.start_time!)
                  return Math.abs(tTime.getTime() - lessonDate.getTime()) < 60000 // 1분 오차 허용
                })

                if (exists) continue

                lessonsToCreate.push({
                  title: project.name,
                  project_id: project.id,
                  start_time: lessonDate.toISOString(),
                  duration: schedule.duration || 40,
                  status: 'scheduled',
                  is_auto_generated: true,
                  is_top5: false,
                })
              }
            }

            if (lessonsToCreate.length > 0) {
              const { error } = await supabase.from('tasks').insert(lessonsToCreate)
              if (!error) {
                console.log(`✅ ${project.name}: 추가 일정 ${lessonsToCreate.length}개 생성됨`)
                hasGenerated = true
              }
            }
          }
        }

        if (hasGenerated) {
          await refetchTasks() // refetch 완료 대기
          setTimeout(() => { isGeneratingRef.current = false }, 500) // 락 해제
        } else {
          setTimeout(() => { isGeneratingRef.current = false }, 500) // 생성 안했으면 금방 해제
        }

      } catch (e) {
        console.error(e)
        isGeneratingRef.current = false
      }
    }

    manageStudentTimetables()
  }, [tasks, projects, tasksLoading, projectsLoading, currentDate])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragOver = (event: any) => {
    if (event.over) {
      setOverId(event.over.id as string)
    } else {
      setOverId(null)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setOverId(null)

    if (!over) return

    const taskId = active.id as string
    const overId = over.id as string

    // Handle drop on calendar slot
    if (overId.startsWith('slot-')) {
      // Format: slot-YYYY-MM-DD-HH-mm
      const parts = overId.split('-')
      // parts: ['slot', '2025', '11', '18', '10', '00']

      const year = parseInt(parts[1], 10)
      const month = parseInt(parts[2], 10)
      const day = parseInt(parts[3], 10)
      const hour = parseInt(parts[4], 10)
      const minute = parseInt(parts[5], 10)

      const newDate = new Date(year, month - 1, day, hour, minute, 0)

      updateTask(taskId, {
        start_time: newDate.toISOString(),
        status: 'scheduled'
      })
    }
  }

  const activeTask = tasks.find(t => t.id === activeId)
  const activeProject = activeTask?.project_id ? projects.find(p => p.id === activeTask.project_id) : undefined

  // 드래그 중인 태스크의 테두리 색상 계산
  const getDragBorderColor = () => {
    if (!activeTask) return 'border-blue-500'
    
    // 학생 시간표인 경우
    if (activeTask.is_auto_generated || activeTask.is_makeup) {
      if (activeTask.is_cancelled) {
        return 'border-gray-300'
      } else if (activeTask.is_makeup) {
        return 'border-orange-500 border-2' // 보충 수업 (특별수업)
      } else {
        // 정규 수업: 주당 횟수로 테두리 색상 결정
        const weeklyCount = activeProject?.schedule_template?.length || 0
        
        if (weeklyCount >= 3) {
          return 'border-sky-200 border-2'      // 주3회 이상: 연한 하늘색
        } else if (weeklyCount === 2) {
          return 'border-sky-400 border-2'      // 주2회: 하늘색
        } else if (weeklyCount === 1) {
          return 'border-blue-600 border-2'     // 주1회: 진한 파란색
        } else {
          return 'border-orange-500 border-2'   // 주0회 (특별수업): 오렌지
        }
      }
    }
    
    return 'border-blue-500' // 일반 태스크
  }

  // 커서가 태스크 박스 상단에 위치하도록 조정
  const customModifier = ({ transform }: { transform: { x: number, y: number } }) => {
    return {
      ...transform,
      y: transform.y - 10 // 커서가 박스 상단 근처에 위치
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="h-screen w-full">
        {/* Desktop: 3-Panel Layout */}
        <div className="hidden md:block h-full">
          <PanelGroup direction="horizontal">
            {/* Left Panel */}
            <Panel defaultSize={16} minSize={12} maxSize={25}>
              <LeftPanel
                tasks={tasks}
                createTask={createTask}
                updateTask={updateTask}
                deleteTask={deleteTask}
                reorderTasks={reorderTasks}
                projects={projects}
                createProject={createProject}
                updateProject={updateProject}
                deleteProject={deleteProject}
              />
            </Panel>

            <PanelResizeHandle className="w-px bg-gray-200 hover:bg-gray-400 transition-colors" />

            {/* Center Panel */}
            {/* Center Panel */}
            <Panel defaultSize={60} minSize={40}>
              <CenterPanel
                tasks={tasks}
                createTask={createTask}
                updateTask={updateTask}
                deleteTask={deleteTask}
                dragOverSlotId={overId}
                draggingTask={activeTask}
                projects={projects}
                makeupProject={makeupProject}
                onClearMakeupMode={() => setMakeupProject(null)}
                currentDate={currentDate}
                onDateChange={setCurrentDate}
              />
            </Panel>

            <PanelResizeHandle className="w-px bg-gray-200 hover:bg-gray-400 transition-colors" />

            {/* Right Panel */}
            <Panel defaultSize={16} minSize={12} maxSize={25}>
              <RightPanel
                projects={projects}
                createProject={createProject}
                updateProject={updateProject}
                deleteProject={deleteProject}
                createTask={createTask}
                tasks={tasks}
                updateTask={updateTask}
                deleteTask={deleteTask}
                onSelectMakeupProject={setMakeupProject}
                selectedMakeupProject={makeupProject}
                currentDate={currentDate}
              />
            </Panel>
          </PanelGroup>
        </div>

        {/* Mobile: Single Panel with Bottom Navigation */}
        <div className="md:hidden h-full flex flex-col">
          <div className="flex-1 overflow-hidden">
            {activePanel === 'left' && (
              <LeftPanel
                tasks={tasks}
                createTask={createTask}
                updateTask={updateTask}
                deleteTask={deleteTask}
                reorderTasks={reorderTasks}
                projects={projects}
                createProject={createProject}
                updateProject={updateProject}
                deleteProject={deleteProject}
              />
            )}
            {activePanel === 'center' && (
              <CenterPanel
                tasks={tasks}
                createTask={createTask}
                updateTask={updateTask}
                deleteTask={deleteTask}
                dragOverSlotId={overId}
                draggingTask={activeTask}
                projects={projects}
                makeupProject={makeupProject}
                onClearMakeupMode={() => setMakeupProject(null)}
                currentDate={currentDate}
                onDateChange={setCurrentDate}
              />
            )}
            {activePanel === 'right' && (
              <RightPanel
                projects={projects}
                createProject={createProject}
                updateProject={updateProject}
                deleteProject={deleteProject}
                createTask={createTask}
                tasks={tasks}
                updateTask={updateTask}
                deleteTask={deleteTask}
                onSelectMakeupProject={setMakeupProject}
                selectedMakeupProject={makeupProject}
                currentDate={currentDate}
              />
            )}
          </div>
          <MobileNavigation activePanel={activePanel} onPanelChange={setActivePanel} />
        </div>

        <DragOverlay modifiers={[customModifier]}>
          {activeTask ? (
            <div
              style={{ height: `${(activeTask.duration || 60) * 2}px` }}
              className={`text-xs rounded-sm px-1.5 py-0.5 leading-snug shadow-xl cursor-grabbing overflow-hidden min-w-[100px] max-w-[200px] ${
                // 학생 시간표 색상 로직
                activeTask.is_auto_generated || activeTask.is_makeup
                  ? activeTask.is_cancelled
                    ? 'bg-gray-100 text-gray-500 border-gray-300' // 취소된 수업
                    : activeTask.is_makeup
                    ? 'bg-yellow-100 text-yellow-700 border-orange-500 border-2' // 보충 수업 (오렌지 테두리)
                    : 'bg-sky-100 text-sky-700 ' + getDragBorderColor() // 정규 수업 (주당 횟수별 테두리)
                  : 'bg-blue-100 text-blue-700 border-blue-500' // 일반 태스크
              }`}
            >
              <div className="line-clamp-2 font-medium break-words">{activeTask.title}</div>
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  )
}
