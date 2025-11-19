'use client'

import { useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor, DragStartEvent } from '@dnd-kit/core'
import LeftPanel from '@/components/LeftPanel'
import CenterPanel from '@/components/CenterPanel'
import RightPanel from '@/components/RightPanel'
import MobileNavigation from '@/components/MobileNavigation'
import { useTasks } from '@/hooks/useTasks'
import { useProjects } from '@/hooks/useProjects'
import type { Task } from '@/types/database'

type PanelType = 'left' | 'center' | 'right'

export default function Home() {
  const [activePanel, setActivePanel] = useState<PanelType>('left')
  const { tasks, createTask, updateTask, deleteTask, reorderTasks } = useTasks()
  const { projects, createProject, updateProject, deleteProject } = useProjects()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  
  // 보충 수업 추가 모드
  const [makeupProject, setMakeupProject] = useState<any>(null)

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
            <Panel defaultSize={20} minSize={15} maxSize={30}>
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
              />
            </Panel>

            <PanelResizeHandle className="w-px bg-gray-200 hover:bg-gray-400 transition-colors" />

            {/* Right Panel */}
            <Panel defaultSize={20} minSize={15} maxSize={30}>
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
              />
            )}
          </div>
          <MobileNavigation activePanel={activePanel} onPanelChange={setActivePanel} />
        </div>

        <DragOverlay modifiers={[customModifier]}>
          {activeTask ? (
            <div
              style={{ height: `${(activeTask.duration || 60) * 2}px` }}
              className={`text-[10px] rounded-sm border px-1 py-0.5 leading-tight shadow-xl cursor-grabbing overflow-hidden min-w-[100px] max-w-[200px] ${
                // 학생 시간표 색상 로직
                activeTask.is_auto_generated || activeTask.is_makeup
                  ? activeTask.is_cancelled
                    ? 'bg-gray-100 text-gray-500 border-gray-300' // 취소된 수업
                    : activeTask.is_makeup
                    ? 'bg-yellow-100 text-yellow-700 border-yellow-500' // 보충 수업
                    : 'bg-sky-100 text-sky-700 border-sky-500' // 정규 수업
                  : 'bg-blue-100 text-blue-700 border-blue-500' // 일반 태스크
              }`}
            >
              <div className="truncate font-medium">{activeTask.title}</div>
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  )
}
