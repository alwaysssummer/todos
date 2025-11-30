'use client'

import { useState } from 'react'
import { Plus, Calendar, Folder, GraduationCap, Repeat, X, BookOpen } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Project, Task } from '@/types/database'
import ProjectCreateModal from './ProjectCreateModal'
import ProjectDetailModal from './ProjectDetailModal'
import TagPanel from './TagPanel'
import TextbookManagementModal from './TextbookManagementModal'
import { DailyNoteModal } from './DailyNoteModal'
import { useScheduleManager } from '@/hooks/useScheduleManager'
import { useTextbooks } from '@/hooks/useTextbooks'
import { useTextbookGroups } from '@/hooks/useTextbookGroups'
import { useTextbookSubgroups } from '@/hooks/useTextbookSubgroups'
import { useDailyNotes } from '@/hooks/useDailyNotes'

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
  const [showTextbookModal, setShowTextbookModal] = useState(false)
  const [showDailyNoteModal, setShowDailyNoteModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const { syncProjectSchedule } = useScheduleManager()
  const { 
    textbooks, 
    createTextbook, 
    deleteTextbook, 
    updateTextbookGroup, 
    updateTextbookSubgroup, 
    updateTextbookChapters,
    updateTextbookLocalPath,
    updateTextbookMemo,
    updateTextbookName,
    reorderTextbooks 
  } = useTextbooks()
  const { 
    groups, 
    createGroup, 
    updateGroup, 
    deleteGroup, 
    reorderGroups 
  } = useTextbookGroups()
  const { 
    subgroups, 
    createSubgroup, 
    updateSubgroup, 
    deleteSubgroup, 
    reorderSubgroups
  } = useTextbookSubgroups()
  const { hasNoteOnDate, getNoteByDate, createNote, updateNote, deleteNote } = useDailyNotes()

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
  const studentProjects = projects
    .filter(p => p.type === 'student')
    .sort((a, b) => {
      // start_date의 '일(day)'만 기준으로 오름차순 정렬 (월은 무시)
      if (!a.start_date && !b.start_date) return 0
      if (!a.start_date) return 1
      if (!b.start_date) return -1
      
      const dayA = new Date(a.start_date).getDate() // 1~31
      const dayB = new Date(b.start_date).getDate() // 1~31
      
      return dayA - dayB
    })
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
      <div className="px-0 py-3">
        {/* Minimalist Calendar */}
        <div className="bg-gray-50 rounded-lg p-0.5">
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
                const hasNote = hasNoteOnDate(cellDate)

                // 선택된 주간에 속하는지 확인 (날짜만 비교)
                const weekStartTime = weekStart.getTime()
                const weekEndTime = weekEnd.getTime()
                const cellDateTime = cellDate.getTime()
                const isInSelectedWeek = cellDateTime >= weekStartTime && cellDateTime <= weekEndTime

                cells.push(
                  <div
                    key={day}
                    onClick={() => {
                      setSelectedDate(cellDate)
                      setShowDailyNoteModal(true)
                    }}
                    className={`text-center py-0.5 rounded relative cursor-pointer ${isToday
                      ? 'bg-blue-600 text-white font-bold shadow-md ring-2 ring-blue-400'
                      : isInSelectedWeek
                        ? 'bg-blue-100 text-blue-900 font-medium'
                        : 'text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    {day}
                    {hasNote && (
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-orange-500 rounded-full" />
                    )}
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
      <div className="flex-1 overflow-y-auto px-0 py-4 space-y-6">
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
            {/* 2줄 통계 */}
            <div className="mb-2 px-1 space-y-1">
              {/* 1줄: 인원 통계 */}
              <div className="flex items-center gap-3 text-xs">
                {/* 총원 */}
                <span className="text-gray-600">
                  <span className="font-semibold text-gray-900">{studentProjects.length}</span>
                </span>
                
                <span className="text-gray-300">/</span>
                
                {/* 공개학생 수 */}
                <span className="text-gray-600">
                  <span className="font-semibold text-gray-900">
                    {studentProjects.filter(p => !p.is_private).length}
                  </span>
                </span>
                
                <span className="text-gray-300">/</span>
                
                {/* 비공개학생 수 */}
                <span className="text-gray-600">
                  <span className="font-semibold text-gray-900">
                    {studentProjects.filter(p => p.is_private).length}
                  </span>
                </span>
                
                <span className="text-gray-300">/</span>
                
                {/* 색상별 학생 수 (연한하늘색, 하늘색, 파란색만) */}
                {(() => {
                  const targetColors = ['#bae6fd', '#38bdf8', '#2563eb']
                  return targetColors.map((color) => {
                    const count = studentProjects.filter(p => p.color === color).length
                    if (count === 0) return null
                    return (
                      <div key={color} className="flex items-center gap-1">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-semibold text-gray-900">{count}</span>
                      </div>
                    )
                  }).filter(Boolean)
                })()}
              </div>
              
              {/* 2줄: 금액 통계 */}
              <div className="flex items-center gap-2 text-xs">
                {(() => {
                  // 총 금액 계산
                  const totalAmount = studentProjects.reduce((sum, p) => sum + (p.tuition || 0), 0)
                  const totalPaid = studentProjects.filter(p => p.tuition_paid).reduce((sum, p) => sum + (p.tuition || 0), 0)
                  const totalUnpaid = totalAmount - totalPaid
                  
                  // 공개학생 금액
                  const publicProjects = studentProjects.filter(p => !p.is_private)
                  const publicAmount = publicProjects.reduce((sum, p) => sum + (p.tuition || 0), 0)
                  const publicPaid = publicProjects.filter(p => p.tuition_paid).reduce((sum, p) => sum + (p.tuition || 0), 0)
                  const publicUnpaid = publicAmount - publicPaid
                  
                  // 비공개학생 금액
                  const privateProjects = studentProjects.filter(p => p.is_private)
                  const privateAmount = privateProjects.reduce((sum, p) => sum + (p.tuition || 0), 0)
                  const privatePaid = privateProjects.filter(p => p.tuition_paid).reduce((sum, p) => sum + (p.tuition || 0), 0)
                  const privateUnpaid = privateAmount - privatePaid
                  
                  return (
                    <>
                      {/* 총 금액 */}
                      <span className="text-gray-600">
                        <span className="font-semibold text-gray-900">{totalAmount}</span>
                        <span className="text-xs"> (<span className="text-green-600 font-medium">{totalPaid}</span>/<span className="text-yellow-600 font-medium">{totalUnpaid}</span>)</span>
                      </span>
                      
                      <span className="text-gray-300">|</span>
                      
                      {/* 공개학생 금액 */}
                      <span className="text-gray-600">
                        <span className="font-semibold text-gray-900">{publicAmount}</span>
                        <span className="text-xs"> (<span className="text-green-600 font-medium">{publicPaid}</span>/<span className="text-yellow-600 font-medium">{publicUnpaid}</span>)</span>
                      </span>
                      
                      <span className="text-gray-300">|</span>
                      
                      {/* 비공개학생 금액 */}
                      <span className="text-gray-600">
                        <span className="font-semibold text-gray-900">{privateAmount}</span>
                        <span className="text-xs"> (<span className="text-green-600 font-medium">{privatePaid}</span>/<span className="text-yellow-600 font-medium">{privateUnpaid}</span>)</span>
                      </span>
                    </>
                  )
                })()}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {studentProjects.map((project) => {
                const isSelected = selectedMakeupProject?.id === project.id
                return (
                  <div key={project.id} className="flex items-center p-1.5 rounded-lg hover:bg-gray-50 border border-gray-200 hover:border-gray-300 transition-all group">
                    <button
                      onClick={() => handleProjectClick(project)}
                      className="flex-1 flex items-center gap-1.5 text-left min-w-0"
                    >
                      <div className="flex-1 min-w-0 flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {project.name}
                        </span>
                        {project.start_date && (
                          <span className={`text-xs flex-shrink-0 ${
                            (() => {
                              // 납부 완료 시 녹색
                              if (project.tuition_paid) {
                                return 'text-green-600 font-semibold'
                              }
                              
                              // 미납 시: 이번 달 시작일 기준으로 경과 일수 계산
                              const startDate = new Date(project.start_date)
                              const startDay = startDate.getDate() // 시작일의 날짜 (예: 19일)
                              
                              const today = new Date()
                              const currentDay = today.getDate() // 현재 날짜 (예: 24일)
                              
                              // 이번 달 시작일부터 경과 일수
                              const daysPassed = currentDay - startDay
                              
                              if (daysPassed >= 7) {
                                return 'text-red-600 font-semibold'      // 7일 이상: 빨간색
                              } else if (daysPassed >= 1) {
                                return 'text-yellow-600 font-semibold'   // 1일 이상: 노란색
                              } else {
                                return 'text-gray-400'                    // 1일 미만: 회색
                              }
                            })()
                          }`}>
                            {String(new Date(project.start_date).getDate()).padStart(2, '0')}.
                            {project.tuition && ` ${project.tuition}`}
                            {project.is_private && ' 🔒'}
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
                        : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
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

      {/* 교재 관리 버튼 - TagPanel 위 */}
      <div className="px-0 py-2 border-t border-gray-200">
        <button
          onClick={() => setShowTextbookModal(true)}
          className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors flex items-center gap-2 text-gray-700"
        >
          <BookOpen size={16} />
          <span className="font-medium">교재 관리</span>
        </button>
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

      {/* Textbook Management Modal */}
      {showTextbookModal && (
        <TextbookManagementModal
          onClose={() => setShowTextbookModal(false)}
          textbooks={textbooks}
          groups={groups}
          subgroups={subgroups}
          onCreateTextbook={createTextbook}
          onDeleteTextbook={deleteTextbook}
          onUpdateTextbookGroup={updateTextbookGroup}
          onUpdateTextbookSubgroup={updateTextbookSubgroup}
          onUpdateTextbookChapters={updateTextbookChapters}
          onUpdateTextbookLocalPath={updateTextbookLocalPath}
          onUpdateTextbookMemo={updateTextbookMemo}
          onUpdateTextbookName={updateTextbookName}
          onReorderTextbooks={reorderTextbooks}
          onCreateGroup={createGroup}
          onUpdateGroup={updateGroup}
          onDeleteGroup={deleteGroup}
          onReorderGroups={reorderGroups}
          onCreateSubgroup={createSubgroup}
          onUpdateSubgroup={updateSubgroup}
          onDeleteSubgroup={deleteSubgroup}
          onReorderSubgroups={reorderSubgroups}
        />
      )}

      {/* Daily Note Modal */}
      {showDailyNoteModal && selectedDate && (
        <DailyNoteModal
          date={selectedDate}
          existingNote={getNoteByDate(selectedDate)}
          onSave={createNote}
          onUpdate={updateNote}
          onDelete={deleteNote}
          onClose={() => {
            setShowDailyNoteModal(false)
            setSelectedDate(null)
          }}
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
