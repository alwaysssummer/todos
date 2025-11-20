'use client'

import { useState } from 'react'
import { Plus, Calendar, Folder, GraduationCap, Repeat, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Project, Task } from '@/types/database'
import ProjectCreateModal from './ProjectCreateModal'
import ProjectDetailModal from './ProjectDetailModal'
import TagPanel from './TagPanel'
import { useScheduleManager } from '@/hooks/useScheduleManager'

interface RightPanelProps {
  projects: Project[]
  createTask?: (task: Partial<any>) => Promise<any>
  tasks?: Task[]
  updateTask?: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask?: (id: string) => Promise<void>
  createProject: (project: Partial<Project>) => Promise<Project>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  onSelectMakeupProject?: (project: Project | null) => void
  selectedMakeupProject?: Project | null
  currentDate?: Date
  onDateChange?: (date: Date) => void
  refetchTasks?: () => void
  selectedTags?: string[]
  onTagsChange?: (tags: string[]) => void
  onOpenTagModal?: (tag: string) => void
  onOpenArchive?: () => void
}

export default function RightPanel({ projects, createProject, updateProject, deleteProject, createTask, tasks = [], updateTask, deleteTask, onSelectMakeupProject, selectedMakeupProject, currentDate = new Date(), onDateChange, refetchTasks, selectedTags = [], onTagsChange, onOpenTagModal, onOpenArchive }: RightPanelProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const { syncProjectSchedule } = useScheduleManager()

  const handleGenerateTasks = async (newTasks: any[]) => {
    if (!createTask) return
    for (const task of newTasks) {
      await createTask(task)
    }
  }

  // 스케줄 매니저를 통한 동기화 (수정 시 호출)
  const handleRegenerateSchedule = async (project: Project) => {
    try {
      await syncProjectSchedule(project)
      // ✅ window.location.reload() 제거 - 중복 호출 방지
      // 대신 tasks refetch로 UI 업데이트
      if (refetchTasks) {
        refetchTasks()
      }
    } catch (error) {
      console.error('스케줄 동기화 오류:', error)
      alert('시간표 동기화 중 오류가 발생했습니다.')
    }
  }

  const folderProjects = projects.filter(p => p.type === 'folder')
  const studentProjects = projects.filter(p => p.type === 'student')
  const habitProjects = projects.filter(p => p.type === 'habit')

  const handleProjectClick = (project: Project) => {
    setSelectedProject(project)
  }

  const handleTagClick = (tag: string) => {
    if (onOpenTagModal) {
      onOpenTagModal(tag)
    }
  }

  const handleArchiveOpen = () => {
    if (onOpenArchive) {
      onOpenArchive()
    }
  }

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200 relative">
      {/* Header - 미니 달력만 */}
      <div className="p-4">
        {/* Minimalist Calendar */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-center mb-2">
            <div className="text-sm font-medium text-gray-600">
              {(() => {
                // currentDate가 속한 주의 월요일 기준으로 달 표시
                const getWeekStart = (date: Date): Date => {
                  const d = new Date(date)
                  const day = d.getDay()
                  const diff = day === 0 ? -6 : 1 - day
                  d.setDate(d.getDate() + diff)
                  d.setHours(0, 0, 0, 0)
                  return d
                }

                const weekStart = getWeekStart(currentDate)
                return weekStart.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })
              })()}
            </div>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-xs">
            {['월', '화', '수', '목', '금', '토', '일'].map((day, i) => (
              <div
                key={day}
                className={`text-center py-0.5 font-medium ${i >= 5 ? 'text-red-500' : 'text-gray-600'}`}
              >
                {day}
              </div>
            ))}
            {(() => {
              const cells = []

              // currentDate가 속한 주의 월요일 계산
              const getWeekStart = (date: Date): Date => {
                const d = new Date(date)
                const day = d.getDay()
                const diff = day === 0 ? -6 : 1 - day
                d.setDate(d.getDate() + diff)
                d.setHours(0, 0, 0, 0)
                return d
              }

              const weekStart = getWeekStart(currentDate)
              const weekEnd = new Date(weekStart)
              weekEnd.setDate(weekEnd.getDate() + 6)
              weekEnd.setHours(23, 59, 59, 999)

              const year = weekStart.getFullYear()
              const month = weekStart.getMonth()

              const firstDay = new Date(year, month, 1)
              const lastDay = new Date(year, month + 1, 0)
              const daysInMonth = lastDay.getDate()

              const startDayOfWeek = firstDay.getDay()
              const emptyDays = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1

              const today = new Date()
              today.setHours(0, 0, 0, 0)

              // 이전 달의 날짜들로 채우기 (한 주만큼만)
              const prevMonth = month === 0 ? 11 : month - 1
              const prevYear = month === 0 ? year - 1 : year
              const prevMonthLastDay = new Date(prevYear, prevMonth + 1, 0).getDate()

              for (let i = emptyDays - 1; i >= 0; i--) {
                const day = prevMonthLastDay - i
                const cellDate = new Date(prevYear, prevMonth, day)
                cellDate.setHours(0, 0, 0, 0)

                const weekStartTime = weekStart.getTime()
                const weekEndTime = weekEnd.getTime()
                const cellDateTime = cellDate.getTime()
                const isInSelectedWeek = cellDateTime >= weekStartTime && cellDateTime <= weekEndTime

                cells.push(
                  <div
                    key={`prev-${day}`}
                    className={`text-center py-0.5 rounded relative ${isInSelectedWeek
                      ? 'bg-blue-100 text-blue-900 font-medium opacity-50'
                      : 'text-gray-400 hover:bg-gray-100'
                      }`}
                  >
                    {day}
                  </div>
                )
              }

              // 현재 달의 날짜들
              for (let day = 1; day <= daysInMonth; day++) {
                const cellDate = new Date(year, month, day)
                cellDate.setHours(0, 0, 0, 0)
                const isToday = cellDate.getTime() === today.getTime()

                // 선택된 주간에 속하는지 확인 (날짜만 비교)
                const weekStartTime = weekStart.getTime()
                const weekEndTime = weekEnd.getTime()
                const cellDateTime = cellDate.getTime()
                const isInSelectedWeek = cellDateTime >= weekStartTime && cellDateTime <= weekEndTime

                cells.push(
                  <div
                    key={day}
                    className={`text-center py-0.5 rounded relative ${isToday
                      ? 'bg-blue-600 text-white font-bold shadow-md ring-2 ring-blue-400'
                      : isInSelectedWeek
                        ? 'bg-blue-100 text-blue-900 font-medium'
                        : 'text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    {day}
                  </div>
                )
              }

              // 다음 달의 날짜들로 채우기 (한 주만큼만)
              const totalCells = emptyDays + daysInMonth
              const currentWeekCount = Math.ceil(totalCells / 7)
              const remainingCells = (currentWeekCount * 7) - totalCells

              const nextMonth = month === 11 ? 0 : month + 1
              const nextYear = month === 11 ? year + 1 : year

              for (let i = 1; i <= remainingCells; i++) {
                const cellDate = new Date(nextYear, nextMonth, i)
                cellDate.setHours(0, 0, 0, 0)

                const weekStartTime = weekStart.getTime()
                const weekEndTime = weekEnd.getTime()
                const cellDateTime = cellDate.getTime()
                const isInSelectedWeek = cellDateTime >= weekStartTime && cellDateTime <= weekEndTime

                cells.push(
                  <div
                    key={`next-${i}`}
                    className={`text-center py-0.5 rounded relative ${isInSelectedWeek
                      ? 'bg-blue-100 text-blue-900 font-medium opacity-50'
                      : 'text-gray-400 hover:bg-gray-100'
                      }`}
                  >
                    {i}
                  </div>
                )
              }

              return cells
            })()}
          </div>
        </div>
      </div>

      {/* Project Lists */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Folder Projects */}
        {folderProjects.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Folder size={16} className="text-gray-600" />
              <h2 className="text-sm font-semibold text-gray-900">일반 폴더</h2>
              <span className="text-xs text-gray-400">({folderProjects.length})</span>
            </div>
            <div className="space-y-2">
              {folderProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleProjectClick(project)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border border-gray-200 hover:border-gray-300 transition-all text-left"
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="flex-1 text-sm font-medium text-gray-900 truncate">
                    {project.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {project.status === 'active' ? '진행중' : '완료'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Student Projects */}
        {studentProjects.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap size={16} className="text-green-600" />
              <span className="text-xs text-gray-400">({studentProjects.length})</span>

              {/* 색상별 학생 수 요약 */}
              <div className="flex gap-1.5 ml-auto">
                {(() => {
                  const colorGroups: Record<string, number> = {}
                  studentProjects.forEach(p => {
                    colorGroups[p.color] = (colorGroups[p.color] || 0) + 1
                  })
                  return Object.entries(colorGroups).map(([color, count]) => (
                    <div key={color} className="flex items-center gap-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs font-medium text-gray-600">{count}</span>
                    </div>
                  ))
                })()}
              </div>
            </div>
            <div className="space-y-1">
              {studentProjects.map((project) => {
                const isSelected = selectedMakeupProject?.id === project.id
                return (
                  <div key={project.id} className="flex items-center p-1.5 rounded-lg hover:bg-gray-50 border border-gray-200 hover:border-gray-300 transition-all group">
                    <button
                      onClick={() => handleProjectClick(project)}
                      className="flex-1 flex items-center gap-2 text-left min-w-0"
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: project.color }}
                      />
                      <div className="flex-1 min-w-0 flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {project.name}
                        </span>
                        {project.schedule_template && project.schedule_template.length > 0 && (
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            (주 {project.schedule_template.length}회)
                          </span>
                        )}
                      </div>
                    </button>

                    {/* 보충 수업 추가 버튼 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectMakeupProject?.(isSelected ? null : project)
                      }}
                      className={`ml-1 p-1 rounded-md flex-shrink-0 transition-colors ${isSelected
                        ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100 border border-yellow-200'
                        }`}
                      title={isSelected ? "보충 수업 모드 취소" : "보충 수업 추가"}
                    >
                      {isSelected ? <X size={14} /> : <Plus size={14} />}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Habit Projects */}
        {habitProjects.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Repeat size={16} className="text-amber-600" />
              <h2 className="text-sm font-semibold text-gray-900">루틴/습관</h2>
              <span className="text-xs text-gray-400">({habitProjects.length})</span>
            </div>
            <div className="space-y-2">
              {habitProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleProjectClick(project)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border border-gray-200 hover:border-gray-300 transition-all text-left"
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: project.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {project.name}
                    </div>
                    {project.repeat_days && project.repeat_days.length > 0 && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        주 {project.repeat_days.length}일
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {project.status === 'active' ? '진행중' : '완료'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {projects.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Plus size={48} className="mx-auto opacity-30" />
            </div>
            <p className="text-sm text-gray-500 mb-2">프로젝트가 없습니다</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              첫 프로젝트 만들기
            </button>
          </div>
        )}

        {/* Tag Panel - 하단 (Removed from here) */}
      </div>

      {/* Tag Panel - Fixed Bottom */}
      <TagPanel
        tasks={tasks}
        selectedTags={selectedTags}
        onTagClick={handleTagClick}
        onHeaderClick={handleArchiveOpen}
      />

      {/* Create Modal */}
      {showCreateModal && (
        <ProjectCreateModal
          onClose={() => setShowCreateModal(false)}
          onCreateProject={createProject}
          onGenerateTasks={handleGenerateTasks}
          refetchTasks={refetchTasks}
        />
      )}

      {/* Detail Modal */}
      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onUpdateProject={updateProject}
          onDeleteProject={deleteProject}
          onRegenerateSchedule={handleRegenerateSchedule}
        />
      )}

      {/* 우측 하단 고정 버튼 */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="absolute bottom-20 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-50"
        title="새 프로젝트"
      >
        <Plus size={24} />
      </button>
    </div>
  )
}
