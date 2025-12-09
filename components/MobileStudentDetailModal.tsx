'use client'

import { useState, useEffect } from 'react'
import { format, parseISO, startOfWeek, addDays, isSameDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { X, Check, BookOpen, Calendar, MessageSquare, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Task, Project, Textbook, HomeworkCheckItem } from '@/types/database'
import { supabase } from '@/lib/supabase'

interface MobileStudentDetailModalProps {
  task: Task // 수업 태스크
  project: Project | null // 학생 프로젝트
  onClose: () => void
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  tasks: Task[] // 전체 태스크 (같은 학생의 다른 수업들)
}

type TabType = 'lesson' | 'progress' | 'textbook' | 'memo'

export default function MobileStudentDetailModal({
  task,
  project,
  onClose,
  updateTask,
  tasks
}: MobileStudentDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('lesson')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }))
  const [textbooks, setTextbooks] = useState<Textbook[]>([])
  const [memo, setMemo] = useState(task.description || '')
  const [isSaving, setIsSaving] = useState(false)

  // 학생의 모든 수업
  const studentLessons = tasks.filter(t => 
    t.project_id === task.project_id && 
    (t.is_auto_generated || t.is_makeup)
  )

  // 완료된 수업 수
  const completedLessons = studentLessons.filter(t => t.status === 'completed').length

  // 주간 수업 데이터
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekLessons = weekDays.map(day => 
    studentLessons.filter(t => t.start_time && isSameDay(parseISO(t.start_time), day))
  )

  // 교재 불러오기
  useEffect(() => {
    if (project?.textbooks && project.textbooks.length > 0) {
      loadTextbooks()
    }
  }, [project?.textbooks])

  const loadTextbooks = async () => {
    if (!project?.textbooks) return
    const { data } = await supabase
      .from('textbooks')
      .select('*')
      .in('id', project.textbooks)
    if (data) setTextbooks(data)
  }

  // 수업 완료 토글
  const handleToggleComplete = async () => {
    const newStatus = task.status === 'completed' ? 'scheduled' : 'completed'
    await updateTask(task.id, {
      status: newStatus,
      attendance: newStatus === 'completed' ? 'present' : undefined
    })
  }

  // 메모 저장
  const handleSaveMemo = async () => {
    setIsSaving(true)
    await updateTask(task.id, { description: memo })
    setIsSaving(false)
  }

  // 주간 네비게이션
  const goToPrevWeek = () => setWeekStart(prev => addDays(prev, -7))
  const goToNextWeek = () => setWeekStart(prev => addDays(prev, 7))

  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: 'lesson', label: '수업', icon: <Clock size={16} /> },
    { key: 'progress', label: '진도', icon: <Calendar size={16} /> },
    { key: 'textbook', label: '교재', icon: <BookOpen size={16} /> },
    { key: 'memo', label: '메모', icon: <MessageSquare size={16} /> },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div 
        className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: project?.color || '#6366f1' }}
            >
              {project?.name?.charAt(0) || task.title.charAt(0)}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{project?.name || task.title}</h2>
              <p className="text-xs text-gray-500">
                {task.start_time && format(parseISO(task.start_time), 'M월 d일 (EEE) HH:mm', { locale: ko })}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex border-b border-gray-100">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors
                ${activeTab === tab.key 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500'
                }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <div className="flex-1 overflow-y-auto">
          {/* 수업 탭 */}
          {activeTab === 'lesson' && (
            <div className="p-4 space-y-4">
              {/* 수업 완료 상태 */}
              <div 
                onClick={handleToggleComplete}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer
                  ${task.status === 'completed' 
                    ? 'bg-green-50 border-green-300' 
                    : 'bg-gray-50 border-gray-200'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center
                      ${task.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                      <Check size={18} className="text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">
                        {task.status === 'completed' ? '수업 완료' : '수업 진행 전'}
                      </div>
                      <div className="text-xs text-gray-500">
                        탭하여 {task.status === 'completed' ? '취소' : '완료 처리'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">{task.duration}분</div>
                    <div className="text-xs text-gray-500">수업 시간</div>
                  </div>
                </div>
              </div>

              {/* 수업 통계 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{completedLessons}</div>
                  <div className="text-xs text-gray-600">완료 수업</div>
                </div>
                <div className="bg-purple-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">{studentLessons.length}</div>
                  <div className="text-xs text-gray-600">전체 수업</div>
                </div>
              </div>

              {/* 수업 정보 */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">수업 시간</span>
                  <span className="font-medium">{task.start_time && format(parseISO(task.start_time), 'HH:mm')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">수업 분량</span>
                  <span className="font-medium">{task.duration}분</span>
                </div>
                {task.is_makeup && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">수업 유형</span>
                    <span className="font-medium text-yellow-600">보충 수업</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 진도 탭 */}
          {activeTab === 'progress' && (
            <div className="p-4 space-y-4">
              {/* 주간 네비게이션 */}
              <div className="flex items-center justify-between">
                <button onClick={goToPrevWeek} className="p-2 hover:bg-gray-100 rounded-lg">
                  <ChevronLeft size={20} />
                </button>
                <span className="font-medium text-gray-900">
                  {format(weekStart, 'M.d')} - {format(addDays(weekStart, 6), 'M.d')}
                </span>
                <button onClick={goToNextWeek} className="p-2 hover:bg-gray-100 rounded-lg">
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* 주간 달력 */}
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map((day, idx) => {
                  const dayLessons = weekLessons[idx]
                  const hasLesson = dayLessons.length > 0
                  const allCompleted = hasLesson && dayLessons.every(l => l.status === 'completed')
                  const isToday = isSameDay(day, new Date())

                  return (
                    <div key={idx} className="text-center">
                      <div className={`text-xs mb-1 ${idx === 0 ? 'text-red-400' : idx === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
                        {format(day, 'EEE', { locale: ko })}
                      </div>
                      <div className={`
                        aspect-square rounded-lg flex items-center justify-center text-sm font-medium
                        ${isToday ? 'ring-2 ring-blue-500' : ''}
                        ${allCompleted ? 'bg-green-500 text-white' : hasLesson ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 text-gray-400'}
                      `}>
                        {format(day, 'd')}
                      </div>
                      {hasLesson && (
                        <div className="text-[10px] mt-1 text-gray-500">
                          {dayLessons[0].start_time && format(parseISO(dayLessons[0].start_time), 'HH:mm')}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* 진도율 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">수업 진도율</span>
                  <span className="text-sm font-bold text-blue-600">
                    {studentLessons.length > 0 ? Math.round((completedLessons / studentLessons.length) * 100) : 0}%
                  </span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all"
                    style={{ width: `${studentLessons.length > 0 ? (completedLessons / studentLessons.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 교재 탭 */}
          {activeTab === 'textbook' && (
            <div className="p-4 space-y-3">
              {textbooks.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <BookOpen size={40} className="mx-auto mb-2 opacity-30" />
                  <p>배정된 교재가 없습니다</p>
                </div>
              ) : (
                textbooks.map(tb => {
                  // 이 교재의 완료된 단원 수 계산
                  const completedChapters = new Set<number>()
                  studentLessons.forEach(lesson => {
                    if (lesson.homework_checks) {
                      lesson.homework_checks.forEach((check: HomeworkCheckItem) => {
                        if (check.is_completed && check.textbook_id === tb.id) {
                          const chapterNum = parseInt(check.chapter)
                          if (!isNaN(chapterNum)) completedChapters.add(chapterNum)
                        }
                      })
                    }
                  })
                  const progress = Math.round((completedChapters.size / tb.total_chapters) * 100)

                  return (
                    <div key={tb.id} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{tb.name}</span>
                        <span className="text-xs text-gray-500">
                          {completedChapters.size}/{tb.total_chapters}
                          {tb.chapter_unit === '직접입력' ? tb.custom_chapter_unit : tb.chapter_unit}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="text-right mt-1">
                        <span className="text-xs font-bold text-green-600">{progress}%</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* 메모 탭 */}
          {activeTab === 'memo' && (
            <div className="p-4 space-y-4">
              <textarea
                value={memo}
                onChange={e => setMemo(e.target.value)}
                placeholder="수업 메모를 입력하세요...&#10;&#10;[] 체크리스트 형식도 지원됩니다"
                className="w-full h-48 p-4 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button
                onClick={handleSaveMemo}
                disabled={isSaving}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSaving ? '저장 중...' : '메모 저장'}
              </button>
            </div>
          )}
        </div>

        {/* 하단 안전 영역 */}
        <div className="h-6 bg-white" />
      </div>
    </div>
  )
}

