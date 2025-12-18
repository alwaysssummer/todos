'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, Plus, GripVertical, Pencil, X, BarChart3, Trash2, Flame, Trophy, Clock, Target, Calendar, TrendingUp, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Routine, RoutineStats, RoutineCalendarLog, RoutineRecentNote } from '@/types/database'
import { useRoutines } from '@/hooks/useRoutines'
import { getKoreanToday } from '@/utils/dateUtils'

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

// Sortable 루틴 아이템
function SortableRoutineItem({
  routine,
  onEdit,
  onDelete,
  onStats
}: {
  routine: Routine
  onEdit: () => void
  onDelete: () => void
  onStats: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: routine.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms ease',
    zIndex: isDragging ? 999 : 1,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-orange-300 transition-all ${
        isDragging ? 'shadow-lg' : ''
      }`}
    >
      {/* 드래그 핸들 */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500"
      >
        <GripVertical size={18} />
      </div>

      {/* 제목 & 요일 */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-800">{routine.title}</div>
        <div className="text-xs text-gray-400 mt-0.5">
          {routine.repeat_days.map(d => DAY_LABELS[d]).join(', ')}
          {routine.target_time && ` · ${routine.target_time}`}
        </div>
      </div>

      {/* 버튼들 */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onStats}
          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
          title="통계 보기"
        >
          <BarChart3 size={16} />
        </button>
        <button
          onClick={onEdit}
          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title="수정"
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
          title="삭제"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}

// 루틴 생성/수정 폼
function RoutineForm({
  routine,
  onClose,
  onSave
}: {
  routine?: Routine
  onClose: () => void
  onSave: (title: string, repeatDays: number[], targetTime?: string) => void
}) {
  const [title, setTitle] = useState(routine?.title || '')
  const [repeatDays, setRepeatDays] = useState<number[]>(routine?.repeat_days || [0, 1, 2, 3, 4, 5, 6])
  const [targetTime, setTargetTime] = useState(routine?.target_time || '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const toggleDay = (day: number) => {
    setRepeatDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim() && repeatDays.length > 0) {
      onSave(title.trim(), repeatDays, targetTime || undefined)
    }
  }

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
      <h4 className="text-sm font-semibold text-orange-800 mb-3">
        {routine ? '루틴 수정' : '새 루틴 추가'}
      </h4>
      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="루틴 제목 (예: 운동하기)"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 mb-3"
        />
        
        <div className="flex gap-1 mb-3">
          {DAY_LABELS.map((label, day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${
                repeatDays.includes(day)
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <label className="text-xs text-gray-500">목표 시간:</label>
          <input
            type="time"
            value={targetTime}
            onChange={e => setTargetTime(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!title.trim() || repeatDays.length === 0}
            className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-300"
          >
            {routine ? '수정' : '추가'}
          </button>
        </div>
      </form>
    </div>
  )
}

// 통계 뷰
function StatsView({
  routine,
  stats,
  calendarLogs,
  recentNotes,
  currentYear,
  currentMonth,
  onMonthChange,
  onClose
}: {
  routine: Routine
  stats: RoutineStats | null
  calendarLogs: RoutineCalendarLog[]
  recentNotes: RoutineRecentNote[]
  currentYear: number
  currentMonth: number
  onMonthChange: (year: number, month: number) => void
  onClose: () => void
}) {
  if (!stats) return null

  const weekPercentage = stats.week_total > 0 
    ? Math.round((stats.week_count / stats.week_total) * 100) 
    : 0
  const monthPercentage = stats.month_total > 0 
    ? Math.round((stats.month_count / stats.month_total) * 100) 
    : 0

  // 달력 생성
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
  const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1).getDay()
  const monthName = `${currentYear}년 ${currentMonth}월`
  
  const logMap = new Map<string, RoutineCalendarLog>()
  calendarLogs.forEach(log => logMap.set(log.date, log))

  const today = getKoreanToday()
  const todayStr = today.toISOString().split('T')[0]

  const goToPrevMonth = () => {
    if (currentMonth === 1) {
      onMonthChange(currentYear - 1, 12)
    } else {
      onMonthChange(currentYear, currentMonth - 1)
    }
  }

  const goToNextMonth = () => {
    if (currentMonth === 12) {
      onMonthChange(currentYear + 1, 1)
    } else {
      onMonthChange(currentYear, currentMonth + 1)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-800 flex items-center gap-2">
          <BarChart3 size={18} className="text-orange-500" />
          {routine.title} 통계
        </h4>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white rounded-lg p-3 text-center">
          <Flame className="mx-auto text-orange-500 mb-1" size={20} />
          <p className="text-xl font-bold text-orange-600">{stats.streak}</p>
          <p className="text-[10px] text-gray-500">연속</p>
        </div>
        <div className="bg-white rounded-lg p-3 text-center">
          <Trophy className="mx-auto text-yellow-500 mb-1" size={20} />
          <p className="text-xl font-bold text-yellow-600">{stats.best_streak}</p>
          <p className="text-[10px] text-gray-500">최장</p>
        </div>
        <div className="bg-white rounded-lg p-3 text-center">
          <Target className="mx-auto text-green-500 mb-1" size={20} />
          <p className="text-xl font-bold text-green-600">{stats.total_rate}%</p>
          <p className="text-[10px] text-gray-500">달성률</p>
        </div>
      </div>

      {/* 주간/월간 */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-white rounded-lg p-2">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500">이번 주</span>
            <span className="font-medium">{stats.week_count}/{stats.week_total}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-orange-400 rounded-full" style={{ width: `${weekPercentage}%` }} />
          </div>
        </div>
        <div className="bg-white rounded-lg p-2">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500">이번 달</span>
            <span className="font-medium">{stats.month_count}/{stats.month_total}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-400 rounded-full" style={{ width: `${monthPercentage}%` }} />
          </div>
        </div>
      </div>

      {/* 미니 달력 */}
      <div className="bg-white rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <button onClick={goToPrevMonth} className="p-1 hover:bg-gray-100 rounded">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium">{monthName}</span>
          <button onClick={goToNextMonth} className="p-1 hover:bg-gray-100 rounded">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center text-[10px]">
          {DAY_LABELS.map((d, i) => (
            <div key={d} className={`py-0.5 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
              {d}
            </div>
          ))}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const dayOfWeek = new Date(currentYear, currentMonth - 1, day).getDay()
            const isRoutineDay = routine.repeat_days.includes(dayOfWeek)
            const log = logMap.get(dateStr)
            const isToday = dateStr === todayStr
            const isFuture = new Date(dateStr) > today

            let bgColor = 'bg-gray-50'
            if (isRoutineDay && !isFuture) {
              bgColor = log?.is_completed ? 'bg-green-500 text-white' : 'bg-red-100 text-red-600'
            }

            return (
              <div
                key={day}
                className={`aspect-square flex items-center justify-center rounded text-[10px] ${bgColor} ${
                  isToday ? 'ring-1 ring-blue-500' : ''
                }`}
              >
                {day}
              </div>
            )
          })}
        </div>
      </div>

      {/* 최근 메모 */}
      {recentNotes.length > 0 && (
        <div className="bg-white rounded-lg p-3">
          <h5 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
            <FileText size={12} /> 최근 메모
          </h5>
          <div className="space-y-1">
            {recentNotes.slice(0, 3).map((note, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="text-gray-400 flex-shrink-0">{formatDate(note.date)}</span>
                <span className="text-gray-600 truncate">{note.note}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// 메인 대시보드 모달
export default function RoutineDashboardModal({ onClose }: { onClose: () => void }) {
  const {
    routines,
    createRoutine,
    updateRoutine,
    deleteRoutine,
    reorderRoutines,
    getStats,
    getCalendarLogs,
    getRecentNotes
  } = useRoutines()

  const [showForm, setShowForm] = useState(false)
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null)
  const [statsRoutine, setStatsRoutine] = useState<Routine | null>(null)
  const [stats, setStats] = useState<RoutineStats | null>(null)
  const [calendarLogs, setCalendarLogs] = useState<RoutineCalendarLog[]>([])
  const [recentNotes, setRecentNotes] = useState<RoutineRecentNote[]>([])
  const [statsYear, setStatsYear] = useState(new Date().getFullYear())
  const [statsMonth, setStatsMonth] = useState(new Date().getMonth() + 1)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = routines.findIndex(r => r.id === active.id)
    const newIndex = routines.findIndex(r => r.id === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(routines, oldIndex, newIndex).map((r, i) => ({
        ...r,
        order_index: i
      }))
      await reorderRoutines(reordered)
    }
  }

  const handleSave = async (title: string, repeatDays: number[], targetTime?: string) => {
    if (editingRoutine) {
      await updateRoutine(editingRoutine.id, { title, repeat_days: repeatDays, target_time: targetTime })
      setEditingRoutine(null)
    } else {
      await createRoutine(title, repeatDays, targetTime)
      setShowForm(false)
    }
  }

  const handleDelete = async (routine: Routine) => {
    if (confirm(`"${routine.title}" 루틴을 삭제하시겠습니까?`)) {
      await deleteRoutine(routine.id)
    }
  }

  const handleShowStats = async (routine: Routine) => {
    setStatsRoutine(routine)
    const year = new Date().getFullYear()
    const month = new Date().getMonth() + 1
    setStatsYear(year)
    setStatsMonth(month)

    const [statsResult, logsResult, notesResult] = await Promise.all([
      getStats(routine.id),
      getCalendarLogs(routine.id, year, month),
      getRecentNotes(routine.id, 5)
    ])

    setStats(statsResult)
    setCalendarLogs(logsResult)
    setRecentNotes(notesResult)
  }

  const handleMonthChange = async (year: number, month: number) => {
    if (!statsRoutine) return
    setStatsYear(year)
    setStatsMonth(month)
    const logsResult = await getCalendarLogs(statsRoutine.id, year, month)
    setCalendarLogs(logsResult)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            🔄 루틴 관리
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 바디 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 통계 뷰 */}
          {statsRoutine ? (
            <StatsView
              routine={statsRoutine}
              stats={stats}
              calendarLogs={calendarLogs}
              recentNotes={recentNotes}
              currentYear={statsYear}
              currentMonth={statsMonth}
              onMonthChange={handleMonthChange}
              onClose={() => {
                setStatsRoutine(null)
                setStats(null)
              }}
            />
          ) : (
            <>
              {/* 추가 버튼 */}
              {!showForm && !editingRoutine && (
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full mb-4 py-3 border-2 border-dashed border-orange-300 text-orange-500 rounded-lg hover:bg-orange-50 hover:border-orange-400 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  새 루틴 추가
                </button>
              )}

              {/* 생성/수정 폼 */}
              {(showForm || editingRoutine) && (
                <RoutineForm
                  routine={editingRoutine || undefined}
                  onClose={() => {
                    setShowForm(false)
                    setEditingRoutine(null)
                  }}
                  onSave={handleSave}
                />
              )}

              {/* 루틴 목록 */}
              {routines.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-2">🔄</div>
                  <p>등록된 루틴이 없습니다</p>
                  <p className="text-sm">위 버튼을 눌러 루틴을 추가하세요</p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={routines.map(r => r.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {routines.map(routine => (
                        <SortableRoutineItem
                          key={routine.id}
                          routine={routine}
                          onEdit={() => setEditingRoutine(routine)}
                          onDelete={() => handleDelete(routine)}
                          onStats={() => handleShowStats(routine)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            총 {routines.length}개의 루틴
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

