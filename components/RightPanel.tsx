'use client'

import { useState } from 'react'
import { Plus, Calendar, Folder, GraduationCap, Repeat, X } from 'lucide-react'
import type { Project, Task } from '@/types/database'
import ProjectCreateModal from './ProjectCreateModal'
import ProjectDetailModal from './ProjectDetailModal'

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
}

export default function RightPanel({ projects, createProject, updateProject, deleteProject, createTask, tasks = [], updateTask, deleteTask, onSelectMakeupProject, selectedMakeupProject }: RightPanelProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  const handleGenerateTasks = async (newTasks: any[]) => {
    if (!createTask) return
    for (const task of newTasks) {
      await createTask(task)
    }
  }

  const handleRegenerateSchedule = async (project: Project) => {
    if (!createTask || !deleteTask) return

    // 1. 해당 프로젝트의 미래 자동 생성 수업 삭제
    const now = new Date()
    const projectTasks = tasks.filter(
      t => t.project_id === project.id && t.is_auto_generated && new Date(t.start_time || '') > now
    )
    
    for (const task of projectTasks) {
      await deleteTask(task.id)
    }

    // 2. 새로운 시간표로 향후 4주치 재생성
    const newTasks = generateTasksFromProject(project)
    await handleGenerateTasks(newTasks)
  }

  const generateTasksFromProject = (project: Project): any[] => {
    const generatedTasks: any[] = []
    const startDate = project.start_date ? new Date(project.start_date) : new Date()
    const now = new Date()

    if (project.type === 'student' && project.schedule_template) {
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

          // 과거 날짜는 생성하지 않음 (시간 설정 후 비교)
          if (lessonDate < now) return

          // 종료일 체크
          if (project.end_date && lessonDate > new Date(project.end_date)) {
            return
          }

          generatedTasks.push({
            title: project.name,
            project_id: project.id,
            start_time: lessonDate.toISOString(),
            duration: schedule.duration || 40,
            status: 'scheduled',
            is_auto_generated: true,
            is_top5: false,
          })
        })
      }
    } else if (project.type === 'habit' && project.repeat_days) {
      // 습관 로직도 동일하게 월요일 기준으로 수정
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
        project.repeat_days.forEach(dayOfWeek => {
          // 각 주의 월요일에서 시작
          const instanceDate = new Date(weekStart)
          instanceDate.setDate(instanceDate.getDate() + (week * 7))
          
          // 해당 요일로 이동
          const currentDay = instanceDate.getDay() // 1(월)
          let daysToAdd = dayOfWeek - currentDay
          if (dayOfWeek === 0) daysToAdd = 6 // 일요일은 +6일
          instanceDate.setDate(instanceDate.getDate() + daysToAdd)

          // 시간 설정
          if (project.target_time) {
            const [hour, minute] = project.target_time.split(':').map(Number)
            instanceDate.setHours(hour, minute, 0, 0)
          }

          // 과거 날짜는 생성하지 않음
          if (instanceDate < now) return

          generatedTasks.push({
            title: project.name,
            project_id: project.id,
            start_time: instanceDate.toISOString(),
            duration: project.target_duration || 30,
            status: 'scheduled',
            is_auto_generated: true,
            is_top5: false,
            habit_completed: false,
          })
        })
      }
    }

    return generatedTasks
  }

  const folderProjects = projects.filter(p => p.type === 'folder')
  const studentProjects = projects.filter(p => p.type === 'student')
  const habitProjects = projects.filter(p => p.type === 'habit')

  const handleProjectClick = (project: Project) => {
    setSelectedProject(project)
    // TODO: 상세 모달 열기
  }

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">📋 Projects</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-gray-900 transition-colors"
            title="새 프로젝트"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Minimalist Calendar */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-center mb-2">
            <div className="text-sm font-medium text-gray-600">
              {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-xs">
            {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
              <div key={i} className="text-center font-medium text-gray-500 py-1">
                {day}
              </div>
            ))}
            {(() => {
              const now = new Date()
              const year = now.getFullYear()
              const month = now.getMonth()
              const firstDay = new Date(year, month, 1).getDay()
              const daysInMonth = new Date(year, month + 1, 0).getDate()
              const today = now.getDate()
              
              const cells = []
              for (let i = 0; i < firstDay; i++) {
                cells.push(<div key={`empty-${i}`} />)
              }
              for (let day = 1; day <= daysInMonth; day++) {
                const isToday = day === today
                cells.push(
                  <div
                    key={day}
                    className={`text-center py-1 rounded ${
                      isToday
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {day}
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
            <div className="flex items-center gap-2 mb-3">
              <GraduationCap size={16} className="text-green-600" />
              <h2 className="text-sm font-semibold text-gray-900">학생 시간표</h2>
              <span className="text-xs text-gray-400">({studentProjects.length})</span>
            </div>
            <div className="space-y-2">
              {studentProjects.map((project) => {
                const isSelected = selectedMakeupProject?.id === project.id
                return (
                  <div key={project.id} className="flex items-center p-2 rounded-lg hover:bg-gray-50 border border-gray-200 hover:border-gray-300 transition-all group">
                    <button
                      onClick={() => handleProjectClick(project)}
                      className="flex-1 flex items-center gap-3 text-left min-w-0"
                    >
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: project.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {project.name}
                        </div>
                        {project.schedule_template && project.schedule_template.length > 0 && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            주 {project.schedule_template.length}회
                          </div>
                        )}
                      </div>
                    </button>
                    
                    {/* 보충 수업 추가 버튼 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectMakeupProject?.(isSelected ? null : project)
                      }}
                      className={`ml-2 p-1.5 rounded-md flex-shrink-0 transition-colors ${
                        isSelected 
                          ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' 
                          : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100 border border-yellow-200'
                      }`}
                      title={isSelected ? "보충 수업 모드 취소" : "보충 수업 추가"}
                    >
                      {isSelected ? <X size={16} /> : <Plus size={16} />}
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
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <ProjectCreateModal
          onClose={() => setShowCreateModal(false)}
          onCreateProject={createProject}
          onGenerateTasks={handleGenerateTasks}
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
    </div>
  )
}
