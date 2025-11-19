'use client'

import { useState } from 'react'
import { Plus, Calendar, Folder, GraduationCap, Repeat, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
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
  currentDate?: Date
}

export default function RightPanel({ projects, createProject, updateProject, deleteProject, createTask, tasks = [], updateTask, deleteTask, onSelectMakeupProject, selectedMakeupProject, currentDate = new Date() }: RightPanelProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  const handleGenerateTasks = async (newTasks: any[]) => {
    if (!createTask) return
    for (const task of newTasks) {
      await createTask(task)
    }
  }

  const handleRegenerateSchedule = async (project: Project) => {
    try {
      console.log(`🔄 [${project.name}] 시간표 스마트 재정비 시작...`)
      const now = new Date()

      // 1. 프로젝트의 "완료되지 않은" 모든 태스크 가져오기 (정밀 분석을 위해)
      const { data: existingTasks, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', project.id)
        .neq('status', 'completed')

      if (fetchError) throw fetchError

      // 2. 삭제 대상 정밀 선별 (Smart Cleanup)
      // 조건: "미래의 수업" AND "취소 안 됨" AND "보충 수업 아님"
      // -> 즉, 앞으로 예정된 '정규 수업'은 싹 지우고 다시 깝니다. (자동 생성 플래그 무관)
      const tasksToDelete = existingTasks.filter(t => {
        const taskTime = new Date(t.start_time!)
        
        // 과거의 수업은 건드리지 않음 (기록 보존)
        if (taskTime <= now) return false
        
        // 취소된 수업은 유지 (이력 관리)
        if (t.status === 'cancelled') return false
        
        // 보충 수업은 유지 (별도 스케줄)
        if (t.is_makeup) return false
        
        // 그 외(미래의 scheduled 상태인 모든 정규 수업)는 삭제 대상
        return true
      })

      const deleteIds = tasksToDelete.map(t => t.id)

      // 3. 선별된 태스크 삭제
      if (deleteIds.length > 0) {
        console.log(`🗑️ 미래 정규 수업 ${deleteIds.length}개 정리 중...`)
        const { error: deleteError } = await supabase
          .from('tasks')
          .delete()
          .in('id', deleteIds)
        
        if (deleteError) throw deleteError
      }

      // 4. 새로운 시간표 생성
      const newTasks = generateTasksFromProject(project)

      // 5. 일괄 생성
      if (newTasks.length > 0) {
        const { error: insertError } = await supabase
          .from('tasks')
          .insert(newTasks)
        
        if (insertError) throw insertError
      }

      // 6. 페이지 새로고침
      window.location.reload()

    } catch (error) {
      console.error('Error regenerating schedule:', error)
      alert('시간표 재생성 중 오류가 발생했습니다.')
    }
  }

  const generateTasksFromProject = (project: Project): any[] => {
    const generatedTasks: any[] = []
    const startDate = project.start_date ? new Date(project.start_date) : new Date()
    const now = new Date()

    if (project.type === 'student' && project.schedule_template) {
      // 중복 생성 방지용 Set
      const createdTimeKeys = new Set<string>()

      // 시작일이 속한 주의 월요일을 찾기 (week의 기준점)
      const getWeekStart = (date: Date): Date => {
        const d = new Date(date)
        const day = d.getDay() // 0(일) ~ 6(토)
        const diff = day === 0 ? -6 : 1 - day // 월요일을 기준으로
        d.setDate(d.getDate() + diff)
        d.setHours(0, 0, 0, 0)
        return d
      }
      
      // startDate와 now 중 더 최근 날짜를 기준으로
      const baseDate = startDate > now ? startDate : now
      const weekStart = getWeekStart(baseDate)

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

          // 과거 날짜는 생성하지 않음
          if (lessonDate < now) return

          // 종료일 체크
          if (project.end_date && lessonDate > new Date(project.end_date)) {
            return
          }

          // ✨ 중복 방지: 이미 같은 시간에 생성된 수업이 있다면 건너뜀
          const timeKey = lessonDate.toISOString()
          if (createdTimeKeys.has(timeKey)) {
            return
          }
          createdTimeKeys.add(timeKey)

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
      
      // ✨ 수정: startDate와 now 중 더 최근 날짜를 기준으로
      const baseDate = startDate > now ? startDate : now
      const weekStart = getWeekStart(baseDate)

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
              <div key={i} className="text-center font-medium text-gray-500 py-0.5">
                {day}
              </div>
            ))}
            {(() => {
              // 선택된 주간 계산 (월요일 시작)
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
              
              // 주의 월요일 기준으로 달력 표시
              const year = weekStart.getFullYear()
              const month = weekStart.getMonth()
              const firstDay = new Date(year, month, 1).getDay()
              const daysInMonth = new Date(year, month + 1, 0).getDate()
              
              const now = new Date()
              const today = now.getDate()
              const todayMonth = now.getMonth()
              const todayYear = now.getFullYear()
              
              const cells = []
              
              // 월요일 기준으로 빈 칸 계산 (0=일요일 -> 6칸, 1=월요일 -> 0칸)
              const emptyDays = firstDay === 0 ? 6 : firstDay - 1
              
              // 이전 달의 날짜들로 채우기
              const prevMonth = month === 0 ? 11 : month - 1
              const prevYear = month === 0 ? year - 1 : year
              const prevMonthDays = new Date(prevYear, prevMonth + 1, 0).getDate()
              
              for (let i = 0; i < emptyDays; i++) {
                const prevDay = prevMonthDays - emptyDays + i + 1
                const prevCellDate = new Date(prevYear, prevMonth, prevDay)
                prevCellDate.setHours(0, 0, 0, 0)
                
                // 선택된 주간에 속하는지 확인
                const weekStartTime = weekStart.getTime()
                const weekEndTime = weekEnd.getTime()
                const cellDateTime = prevCellDate.getTime()
                const isInSelectedWeek = cellDateTime >= weekStartTime && cellDateTime <= weekEndTime
                
                cells.push(
                  <div
                    key={`prev-${prevDay}`}
                    className={`text-center py-0.5 rounded relative ${
                      isInSelectedWeek
                        ? 'bg-blue-100 text-blue-900 font-medium opacity-50'
                        : 'text-gray-400 hover:bg-gray-100'
                    }`}
                  >
                    {prevDay}
                  </div>
                )
              }
              
              // 현재 달의 날짜들
              for (let day = 1; day <= daysInMonth; day++) {
                const cellDate = new Date(year, month, day)
                cellDate.setHours(0, 0, 0, 0)
                const isToday = day === today && month === todayMonth && year === todayYear
                
                // 선택된 주간에 속하는지 확인 (날짜만 비교)
                const weekStartTime = weekStart.getTime()
                const weekEndTime = weekEnd.getTime()
                const cellDateTime = cellDate.getTime()
                const isInSelectedWeek = cellDateTime >= weekStartTime && cellDateTime <= weekEndTime
                
                cells.push(
                  <div
                    key={day}
                    className={`text-center py-0.5 rounded relative ${
                      isToday
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
                const nextCellDate = new Date(nextYear, nextMonth, i)
                nextCellDate.setHours(0, 0, 0, 0)
                
                // 선택된 주간에 속하는지 확인
                const weekStartTime = weekStart.getTime()
                const weekEndTime = weekEnd.getTime()
                const cellDateTime = nextCellDate.getTime()
                const isInSelectedWeek = cellDateTime >= weekStartTime && cellDateTime <= weekEndTime
                
                cells.push(
                  <div
                    key={`next-${i}`}
                    className={`text-center py-0.5 rounded relative ${
                      isInSelectedWeek
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

      {/* 우측 하단 고정 버튼 */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-50"
        title="새 프로젝트"
      >
        <Plus size={24} />
      </button>
    </div>
  )
}
