'use client'

import { useState, useEffect } from 'react'
import { format, parseISO, startOfWeek, addDays, isSameDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { ChevronLeft, Check, Trash2 } from 'lucide-react'
import type { Task, Project, HomeworkCheckItem } from '@/types/database'
import { supabase } from '@/lib/supabase'

interface MobileStudentDetailViewProps {
  task: Task
  project: Project | null
  onBack: () => void
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask?: (id: string) => Promise<void>
  tasks: Task[]
}

export default function MobileStudentDetailView({
  task,
  project,
  onBack,
  updateTask,
  deleteTask,
  tasks
}: MobileStudentDetailViewProps) {
  const [memo, setMemo] = useState(task.description || '')
  const [textbooks, setTextbooks] = useState<{ id: string; name: string; total_chapters: number }[]>([])

  // 학생의 모든 수업
  const studentLessons = tasks.filter(t => 
    t.project_id === task.project_id && 
    (t.is_auto_generated || t.is_makeup)
  )
  const completedLessons = studentLessons.filter(t => t.status === 'completed').length

  // 주간 데이터
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  useEffect(() => {
    if (project?.textbooks?.length) {
      supabase
        .from('textbooks')
        .select('id, name, total_chapters')
        .in('id', project.textbooks)
        .then(({ data }) => data && setTextbooks(data))
    }
  }, [project?.textbooks])

  // 수업 완료 토글
  const toggleComplete = () => {
    const newStatus = task.status === 'completed' ? 'scheduled' : 'completed'
    updateTask(task.id, {
      status: newStatus,
      attendance: newStatus === 'completed' ? 'present' : undefined
    })
  }

  // 메모 저장
  const saveMemo = () => {
    updateTask(task.id, { description: memo })
  }

  // 교재 진도 계산
  const getTextbookProgress = (textbookId: string, totalChapters: number) => {
    const completed = new Set<number>()
    studentLessons.forEach(lesson => {
      lesson.homework_checks?.forEach((c: HomeworkCheckItem) => {
        if (c.is_completed && c.textbook_id === textbookId) {
          const num = parseInt(c.chapter)
          if (!isNaN(num)) completed.add(num)
        }
      })
    })
    return { count: completed.size, percent: Math.round((completed.size / totalChapters) * 100) }
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b px-3 py-2 flex items-center gap-3">
        <button onClick={onBack} className="p-1">
          <ChevronLeft size={24} />
        </button>
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
          style={{ backgroundColor: project?.color || '#6366f1' }}
        >
          {(project?.name || task.title).charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-gray-900 truncate">{project?.name || task.title}</div>
          <div className="text-xs text-gray-500">
            {task.start_time && format(parseISO(task.start_time), 'M/d HH:mm', { locale: ko })} · {task.duration}분
          </div>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-20">
        
        {/* 수업 완료 */}
        <div 
          onClick={toggleComplete}
          className={`p-3 rounded-lg flex items-center justify-between cursor-pointer
            ${task.status === 'completed' ? 'bg-green-50 border border-green-200' : 'bg-white border border-gray-200'}`}
        >
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center
              ${task.status === 'completed' ? 'bg-green-500' : 'bg-gray-200'}`}>
              <Check size={14} className="text-white" />
            </div>
            <span className="font-medium">{task.status === 'completed' ? '수업 완료' : '수업 전'}</span>
          </div>
          <span className="text-xs text-gray-400">탭하여 변경</span>
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-lg p-3 text-center border border-gray-100">
            <div className="text-xl font-bold text-blue-600">{completedLessons}</div>
            <div className="text-[10px] text-gray-500">완료</div>
          </div>
          <div className="bg-white rounded-lg p-3 text-center border border-gray-100">
            <div className="text-xl font-bold text-gray-600">{studentLessons.length}</div>
            <div className="text-[10px] text-gray-500">전체</div>
          </div>
        </div>

        {/* 주간 진도 */}
        <div className="bg-white rounded-lg p-3 border border-gray-100">
          <div className="text-xs text-gray-500 mb-2">이번 주</div>
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((day, i) => {
              const hasLesson = studentLessons.some(l => l.start_time && isSameDay(parseISO(l.start_time), day))
              const isComplete = studentLessons.some(l => 
                l.start_time && isSameDay(parseISO(l.start_time), day) && l.status === 'completed'
              )
              const isToday = isSameDay(day, new Date())
              
              return (
                <div key={i} className="text-center">
                  <div className={`text-[10px] ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
                    {format(day, 'EEE', { locale: ko })}
                  </div>
                  <div className={`
                    w-7 h-7 mx-auto rounded-full flex items-center justify-center text-xs
                    ${isToday ? 'ring-1 ring-blue-500' : ''}
                    ${isComplete ? 'bg-green-500 text-white' : hasLesson ? 'bg-blue-100 text-blue-600' : 'text-gray-400'}
                  `}>
                    {format(day, 'd')}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 교재 진도 */}
        {textbooks.length > 0 && (
          <div className="bg-white rounded-lg p-3 border border-gray-100">
            <div className="text-xs text-gray-500 mb-2">교재</div>
            <div className="space-y-2">
              {textbooks.map(tb => {
                const { count, percent } = getTextbookProgress(tb.id, tb.total_chapters)
                return (
                  <div key={tb.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="truncate">{tb.name}</span>
                      <span className="text-gray-400">{count}/{tb.total_chapters}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div 
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 메모 */}
        <div className="bg-white rounded-lg p-3 border border-gray-100">
          <div className="text-xs text-gray-500 mb-2">메모</div>
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            onBlur={saveMemo}
            placeholder="수업 메모..."
            className="w-full h-20 text-sm resize-none border-0 focus:outline-none"
          />
        </div>

        {/* 보충 수업 삭제 버튼 */}
        {task.is_makeup && deleteTask && (
          <button
            onClick={() => {
              if (confirm('보충 수업을 삭제하시겠습니까?')) {
                deleteTask(task.id)
                onBack()
              }
            }}
            className="w-full bg-white rounded-lg p-3 border border-red-200 text-red-500 font-medium active:bg-red-50 flex items-center justify-center gap-2"
          >
            <Trash2 size={16} />
            <span>삭제하기</span>
          </button>
        )}

      </div>
    </div>
  )
}

