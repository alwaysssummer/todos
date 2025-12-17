'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor, DragStartEvent } from '@dnd-kit/core'
import LeftPanel from '@/components/LeftPanel'
import CenterPanel from '@/components/CenterPanel'
import RightPanel from '@/components/RightPanel'
import MobileNavigation from '@/components/MobileNavigation'
import MobileTodayView from '@/components/MobileTodayView'
import MobileInboxView from '@/components/MobileInboxView'
import MobileScheduleView from '@/components/MobileScheduleView'
import MobileTagsView from '@/components/MobileTagsView'
import MobileMoreView from '@/components/MobileMoreView'
import MobileFocusView from '@/components/MobileFocusView'
import MobileNotesView from '@/components/MobileNotesView'
import TagModal from '@/components/TagModal'
import TagArchiveDashboard from '@/components/TagArchiveDashboard'
import TaskDetailPopover from '@/components/DetailPopover'
import { useTasks } from '@/hooks/useTasks'
import { useProjects } from '@/hooks/useProjects'
import { useScheduleManager } from '@/hooks/useScheduleManager'
import type { Task } from '@/types/database'
import { addWeeks, startOfWeek, endOfWeek } from 'date-fns'

type PanelType = 'focus' | 'today' | 'inbox' | 'schedule' | 'notes'

export default function Home() {
  const [activePanel, setActivePanel] = useState<PanelType>('today')
  const { tasks, createTask, updateTask, deleteTask, reorderTasks, toggleTaskStatus, loading: tasksLoading, refetch: refetchTasks } = useTasks()
  const { projects, createProject, updateProject, deleteProject, loading: projectsLoading } = useProjects()
  const { ensureScheduleInRange } = useScheduleManager()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // Tag Modal state
  const [isTagModalOpen, setIsTagModalOpen] = useState(false)
  const [modalSelectedTags, setModalSelectedTags] = useState<string[]>([])

  // Archive Dashboard state
  const [isArchiveOpen, setIsArchiveOpen] = useState(false)

  // Mobile Note Modal state
  const [mobileSelectedTask, setMobileSelectedTask] = useState<Task | null>(null)

  // 보충 수업 추가 모드
  const [makeupProject, setMakeupProject] = useState<any>(null)

  // 수업 취소 대기 중인 정보 (Phase 8)
  const [pendingCancelTask, setPendingCancelTask] = useState<{
    taskId: string
    projectId: string
    homeworkAssignments: any[]
  } | null>(null)

  // 태그 필터링된 태스크
  const filteredTasks = useMemo(() => {
    if (selectedTags.length === 0) return tasks

    return tasks.filter(task =>
      selectedTags.every(tag => task.tags?.includes(tag))  // AND 조건
    )
  }, [tasks, selectedTags])

  // 모든 태그 추출
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    tasks.forEach(task => {
      task.tags?.forEach(tag => tags.add(tag))
    })
    return Array.from(tags)
  }, [tasks])

  // Tag Modal handlers
  const handleOpenTagModal = (tag: string) => {
    setModalSelectedTags([tag])
    setIsTagModalOpen(true)
  }

  const handleModalTagSelect = (tag: string) => {
    setModalSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  // 중복 호출 방지
  const pendingCheckRef = useRef<NodeJS.Timeout | null>(null)
  const isCheckingRef = useRef(false)

  // 날짜 변경 핸들러 (스케줄 체크 포함)
  const handleDateChange = async (newDate: Date) => {
    setCurrentDate(newDate)

    // 기존 대기 중인 타이머 취소 (연속 클릭 방지)
    if (pendingCheckRef.current) {
      clearTimeout(pendingCheckRef.current)
    }

    // 디바운스 적용 (500ms 후 실행)
    pendingCheckRef.current = setTimeout(async () => {
      // 이미 체크 중이면 무시
      if (isCheckingRef.current) {
        console.log('⏭️ 이미 스케줄 체크 중 - 스킵')
        return
      }

      if (!projectsLoading && projects.length > 0) {
        isCheckingRef.current = true

        try {
          const viewStart = startOfWeek(newDate, { weekStartsOn: 1 })
          const viewEnd = endOfWeek(addWeeks(newDate, 6), { weekStartsOn: 1 })

          console.log('📅 날짜 변경 → 스케줄 체크:', newDate.toLocaleDateString())
          await ensureScheduleInRange(projects, viewStart, viewEnd)
          refetchTasks() // UI 즉시 반영
        } finally {
          isCheckingRef.current = false
          pendingCheckRef.current = null
        }
      }
    }, 500)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,  // 8 → 3px로 줄여서 더 빠른 반응
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
      y: transform.y - 10, // 커서가 박스 상단 근처에 위치
      scaleX: 1,
      scaleY: 1
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
            <Panel defaultSize={18} minSize={12} maxSize={25}>
              <LeftPanel
                tasks={tasks}
                createTask={createTask}
                updateTask={updateTask}
                deleteTask={deleteTask}
                reorderTasks={reorderTasks}
                toggleTaskStatus={toggleTaskStatus}
                projects={projects}
                createProject={createProject}
                updateProject={updateProject}
                deleteProject={deleteProject}
              />
            </Panel>

            <PanelResizeHandle className="w-px bg-gray-200 hover:bg-gray-400 transition-colors" />

            {/* Center Panel */}
            {/* Center Panel */}
            <Panel defaultSize={64} minSize={40}>
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
                onDateChange={handleDateChange}
                pendingCancelTask={pendingCancelTask}
                setPendingCancelTask={setPendingCancelTask}
                onSelectMakeupProject={setMakeupProject}
              />
            </Panel>

            <PanelResizeHandle className="w-px bg-gray-200 hover:bg-gray-400 transition-colors" />

            {/* Right Panel */}
            <Panel defaultSize={18} minSize={15} maxSize={30}>
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
                onDateChange={handleDateChange}
                refetchTasks={refetchTasks}
                selectedTags={selectedTags}
                onTagsChange={setSelectedTags}
                onOpenTagModal={handleOpenTagModal}
                onOpenArchive={() => setIsArchiveOpen(true)}
              />
            </Panel>
          </PanelGroup>
        </div>

        {/* Mobile: Single Panel with Bottom Navigation */}
        <div className="md:hidden h-full flex flex-col">
          <div className="flex-1 overflow-hidden">
            {activePanel === 'focus' && (
              <MobileFocusView
                tasks={tasks}
                createTask={createTask}
                updateTask={updateTask}
                deleteTask={deleteTask}
                toggleTaskStatus={toggleTaskStatus}
                projects={projects}
                onNavigateToTab={(tab) => setActivePanel(tab)}
              />
            )}
            {activePanel === 'today' && (
              <MobileTodayView
                tasks={tasks}
                createTask={createTask}
                updateTask={updateTask}
                deleteTask={deleteTask}
                toggleTaskStatus={toggleTaskStatus}
                projects={projects}
                onNavigateToTab={(tab) => setActivePanel(tab)}
              />
            )}
            {activePanel === 'inbox' && (
              <MobileInboxView
                tasks={tasks}
                updateTask={updateTask}
                deleteTask={deleteTask}
                toggleTaskStatus={toggleTaskStatus}
                projects={projects}
                onNavigateToTab={(tab) => setActivePanel(tab)}
              />
            )}
            {activePanel === 'schedule' && (
              <MobileScheduleView
                tasks={tasks}
                updateTask={updateTask}
                deleteTask={deleteTask}
                projects={projects}
                createTask={createTask}
              />
            )}
            {activePanel === 'notes' && (
              <MobileNotesView
                tasks={tasks}
                updateTask={updateTask}
                deleteTask={deleteTask}
                toggleTaskStatus={toggleTaskStatus}
                projects={projects}
              />
            )}
          </div>
          <MobileNavigation activePanel={activePanel} onPanelChange={setActivePanel} />
        </div>

        <DragOverlay modifiers={[customModifier]}>
          {activeTask ? (
            <div
              style={{ height: `${(activeTask.duration || 60) * 1.4}px` }}
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

        {/* Tag Modal */}
        <TagModal
          isOpen={isTagModalOpen}
          onClose={() => setIsTagModalOpen(false)}
          selectedTags={modalSelectedTags}
          tasks={tasks}
          projects={projects}
          updateTask={updateTask}
          deleteTask={deleteTask}
          onTagSelect={handleModalTagSelect}
          allTags={allTags}
        />

        {/* Archive Dashboard */}
        <TagArchiveDashboard
          isOpen={isArchiveOpen}
          onClose={() => setIsArchiveOpen(false)}
          tasks={tasks}
          projects={projects}
          updateTask={updateTask}
          deleteTask={deleteTask}
          onTagClick={handleOpenTagModal}
        />

        {/* Mobile Note Modal */}
        {mobileSelectedTask && (
          <TaskDetailPopover
            task={mobileSelectedTask}
            updateTask={updateTask}
            deleteTask={deleteTask}
            onClose={() => setMobileSelectedTask(null)}
            projects={projects}
            tasks={tasks}
            createTask={createTask}
            toggleTaskStatus={toggleTaskStatus}
          />
        )}
      </div>
    </DndContext>
  )
}
