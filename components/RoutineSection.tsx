'use client'

import { useState, useRef, useEffect } from 'react'
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
import { Check, Plus, GripVertical, Pencil, X, FileText, BarChart3, ChevronLeft, ChevronRight, Flame, Trophy, Clock, Target, Calendar, TrendingUp } from 'lucide-react'
import { Routine, RoutineLog, RoutineStats, RoutineCalendarLog, RoutineRecentNote } from '@/types/database'
import { useRoutines } from '@/hooks/useRoutines'

// 요일 표시용 상수
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const DAY_LABELS_FULL = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

// Sortable 루틴 아이템 컴포넌트
function SortableRoutineItem({
  routine,
  isCompleted,
  note,
  onToggle,
  onNoteClick,
  onEdit,
  onDelete,
  onStats
}: {
  routine: Routine
  isCompleted: boolean
  note: string
  onToggle: () => void
  onNoteClick: () => void
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
      className={`group flex items-center gap-1.5 py-0.5 text-sm transition-all ${
        isDragging ? 'opacity-60' : ''
      }`}
    >
      {/* 드래그 핸들 */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors"
      >
        <GripVertical size={12} />
      </div>

      {/* 체크박스 */}
      <button
        onClick={onToggle}
        className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all ${
          isCompleted
            ? 'bg-green-500 border-green-500 text-white'
            : 'border-orange-400 hover:border-orange-500 bg-white'
        }`}
      >
        {isCompleted && <Check size={10} strokeWidth={3} />}
      </button>

      {/* 제목 */}
      <span className={`flex-1 text-xs truncate ${
        isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'
      }`}>
        {routine.title}
      </span>

      {/* 메모 표시 (있으면) */}
      {note && (
        <span className="text-[10px] text-gray-400 truncate max-w-[60px]" title={note}>
          📝
        </span>
      )}

      {/* 호버 시 버튼들 */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onStats}
          className="text-gray-400 hover:text-green-600 p-0.5"
          title="통계 보기"
        >
          <BarChart3 size={12} />
        </button>
        <button
          onClick={onNoteClick}
          className="text-gray-400 hover:text-blue-600 p-0.5"
          title="메모 추가"
        >
          <FileText size={12} />
        </button>
        <button
          onClick={onEdit}
          className="text-gray-400 hover:text-blue-600 p-0.5"
          title="수정"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={onDelete}
          className="text-gray-400 hover:text-red-500 p-0.5"
          title="삭제"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}

// 루틴 생성/수정 모달
function RoutineModal({
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4">
          {routine ? '루틴 수정' : '🔄 새 루틴 추가'}
        </h3>

        <form onSubmit={handleSubmit}>
          {/* 제목 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              루틴 제목
            </label>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="예: 운동하기, 영어 공부..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* 반복 요일 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              반복 요일
            </label>
            <div className="flex gap-1">
              {DAY_LABELS.map((label, day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`w-9 h-9 rounded-full text-sm font-medium transition-all ${
                    repeatDays.includes(day)
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setRepeatDays([0, 1, 2, 3, 4, 5, 6])}
                className="text-xs text-gray-500 hover:text-orange-600"
              >
                매일
              </button>
              <button
                type="button"
                onClick={() => setRepeatDays([1, 2, 3, 4, 5])}
                className="text-xs text-gray-500 hover:text-orange-600"
              >
                평일
              </button>
              <button
                type="button"
                onClick={() => setRepeatDays([0, 6])}
                className="text-xs text-gray-500 hover:text-orange-600"
              >
                주말
              </button>
            </div>
          </div>

          {/* 목표 시간 (선택) */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              목표 시간 (선택)
            </label>
            <input
              type="time"
              value={targetTime}
              onChange={e => setTargetTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* 버튼 */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!title.trim() || repeatDays.length === 0}
              className="px-4 py-2 text-sm bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {routine ? '수정' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// 메모 입력 모달
function NoteModal({
  routine,
  currentNote,
  onClose,
  onSave
}: {
  routine: Routine
  currentNote: string
  onClose: () => void
  onSave: (note: string) => void
}) {
  const [note, setNote] = useState(currentNote)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-2">📝 오늘의 메모</h3>
        <p className="text-sm text-gray-500 mb-4">{routine.title}</p>

        <textarea
          ref={textareaRef}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="오늘 루틴에 대한 메모를 남겨보세요..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
          rows={4}
        />

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            취소
          </button>
          <button
            onClick={() => onSave(note)}
            className="px-4 py-2 text-sm bg-orange-500 text-white rounded-md hover:bg-orange-600"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}

// 통계 모달 (대형 - 달력 포함)
function StatsModal({
  routine,
  stats,
  calendarLogs,
  recentNotes,
  currentMonth,
  currentYear,
  onClose,
  onMonthChange
}: {
  routine: Routine
  stats: RoutineStats | null
  calendarLogs: RoutineCalendarLog[]
  recentNotes: RoutineRecentNote[]
  currentMonth: number
  currentYear: number
  onClose: () => void
  onMonthChange: (year: number, month: number) => void
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
  
  // 달력 로그 맵 생성
  const logMap = new Map<string, RoutineCalendarLog>()
  calendarLogs.forEach(log => {
    logMap.set(log.date, log)
  })

  // 이전/다음 달 이동
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

  // 오늘 날짜
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const isCurrentMonth = today.getFullYear() === currentYear && today.getMonth() + 1 === currentMonth

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <BarChart3 className="text-orange-500" size={24} />
              {routine.title}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              반복: {routine.repeat_days.map(d => DAY_LABELS[d]).join(', ')}
              {routine.target_time && ` · 목표 시간: ${routine.target_time}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {/* 상단 통계 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            {/* 현재 연속 */}
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 text-center">
              <Flame className="mx-auto text-orange-500 mb-1" size={28} />
              <p className="text-3xl font-bold text-orange-600">{stats.streak}</p>
              <p className="text-xs text-orange-600/70 font-medium">연속 달성</p>
            </div>

            {/* 최장 연속 */}
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4 text-center">
              <Trophy className="mx-auto text-yellow-500 mb-1" size={28} />
              <p className="text-3xl font-bold text-yellow-600">{stats.best_streak}</p>
              <p className="text-xs text-yellow-600/70 font-medium">최장 기록</p>
            </div>

            {/* 전체 달성률 */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 text-center">
              <Target className="mx-auto text-green-500 mb-1" size={28} />
              <p className="text-3xl font-bold text-green-600">{stats.total_rate}%</p>
              <p className="text-xs text-green-600/70 font-medium">전체 달성률</p>
            </div>

            {/* 총 달성 횟수 */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 text-center">
              <TrendingUp className="mx-auto text-blue-500 mb-1" size={28} />
              <p className="text-3xl font-bold text-blue-600">{stats.total_count}</p>
              <p className="text-xs text-blue-600/70 font-medium">총 달성</p>
            </div>

            {/* 평균 완료 시간 */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 text-center">
              <Clock className="mx-auto text-purple-500 mb-1" size={28} />
              <p className="text-2xl font-bold text-purple-600">
                {stats.avg_completion_time || '--:--'}
              </p>
              <p className="text-xs text-purple-600/70 font-medium">평균 시간</p>
            </div>

            {/* 시작일 */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 text-center">
              <Calendar className="mx-auto text-gray-500 mb-1" size={28} />
              <p className="text-lg font-bold text-gray-600">
                {stats.first_completed ? formatDate(stats.first_completed) : '-'}
              </p>
              <p className="text-xs text-gray-500 font-medium">시작일</p>
            </div>
          </div>

          {/* 주간/월간 달성률 */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">이번 주</span>
                <span className="text-sm font-bold text-orange-600">
                  {stats.week_count}/{stats.week_total} ({weekPercentage}%)
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-500"
                  style={{ width: `${weekPercentage}%` }}
                />
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">이번 달</span>
                <span className="text-sm font-bold text-green-600">
                  {stats.month_count}/{stats.month_total} ({monthPercentage}%)
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${monthPercentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* 달력 */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            {/* 달력 헤더 */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={goToPrevMonth}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <h4 className="text-lg font-bold text-gray-800">{monthName}</h4>
              <button
                onClick={goToNextMonth}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAY_LABELS.map((day, i) => (
                <div
                  key={day}
                  className={`text-center text-xs font-medium py-1 ${
                    i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div className="grid grid-cols-7 gap-1">
              {/* 빈 칸 (월 시작 전) */}
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}

              {/* 날짜 */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const dayOfWeek = new Date(currentYear, currentMonth - 1, day).getDay()
                const isRoutineDay = routine.repeat_days.includes(dayOfWeek)
                const log = logMap.get(dateStr)
                const isToday = dateStr === todayStr
                const isFuture = new Date(dateStr) > today

                let bgColor = 'bg-white'
                let textColor = 'text-gray-400'
                let border = ''

                if (isToday) {
                  border = 'ring-2 ring-blue-500'
                }

                if (isRoutineDay && !isFuture) {
                  if (log?.is_completed) {
                    bgColor = 'bg-green-500'
                    textColor = 'text-white'
                  } else {
                    bgColor = 'bg-red-100'
                    textColor = 'text-red-600'
                  }
                } else if (!isRoutineDay) {
                  bgColor = 'bg-gray-100'
                  textColor = 'text-gray-300'
                }

                return (
                  <div
                    key={day}
                    className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm font-medium ${bgColor} ${textColor} ${border} transition-all`}
                    title={log?.note || ''}
                  >
                    <span>{day}</span>
                    {log?.is_completed && (
                      <Check size={12} className="mt-0.5" strokeWidth={3} />
                    )}
                    {log?.note && (
                      <div className="w-1 h-1 bg-blue-400 rounded-full mt-0.5" />
                    )}
                  </div>
                )
              })}
            </div>

            {/* 범례 */}
            <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded" />
                <span>완료</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-100 rounded" />
                <span>미완료</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-gray-100 rounded" />
                <span>해당없음</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-white ring-2 ring-blue-500 rounded" />
                <span>오늘</span>
              </div>
            </div>
          </div>

          {/* 최근 메모 */}
          {recentNotes.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <FileText size={16} className="text-gray-500" />
                최근 메모
              </h4>
              <div className="space-y-2">
                {recentNotes.map((note, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <span className="text-gray-400 flex-shrink-0 w-12">
                      {formatDate(note.date)}
                    </span>
                    <span className="text-gray-700">{note.note}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

// 메인 루틴 섹션 컴포넌트
export default function RoutineSection() {
  const {
    todayRoutines,
    loading,
    getRoutineCompleted,
    getRoutineNote,
    createRoutine,
    updateRoutine,
    deleteRoutine,
    reorderRoutines,
    toggleComplete,
    saveNote,
    getStats,
    getCalendarLogs,
    getRecentNotes
  } = useRoutines()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null)
  const [noteRoutine, setNoteRoutine] = useState<Routine | null>(null)
  const [statsRoutine, setStatsRoutine] = useState<Routine | null>(null)
  const [stats, setStats] = useState<RoutineStats | null>(null)
  const [calendarLogs, setCalendarLogs] = useState<RoutineCalendarLog[]>([])
  const [recentNotes, setRecentNotes] = useState<RoutineRecentNote[]>([])
  const [statsYear, setStatsYear] = useState(new Date().getFullYear())
  const [statsMonth, setStatsMonth] = useState(new Date().getMonth() + 1)

  // 드래그 앤 드롭 센서
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 드래그 종료 핸들러
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = todayRoutines.findIndex(r => r.id === active.id)
    const newIndex = todayRoutines.findIndex(r => r.id === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(todayRoutines, oldIndex, newIndex).map((r, i) => ({
        ...r,
        order_index: i
      }))
      await reorderRoutines(reordered)
    }
  }

  // 루틴 생성/수정 저장
  const handleSaveRoutine = async (title: string, repeatDays: number[], targetTime?: string) => {
    if (editingRoutine) {
      await updateRoutine(editingRoutine.id, { title, repeat_days: repeatDays, target_time: targetTime })
      setEditingRoutine(null)
    } else {
      await createRoutine(title, repeatDays, targetTime)
      setShowCreateModal(false)
    }
  }

  // 루틴 삭제
  const handleDeleteRoutine = async (routine: Routine) => {
    if (confirm(`"${routine.title}" 루틴을 삭제하시겠습니까?\n(기록은 모두 삭제됩니다)`)) {
      await deleteRoutine(routine.id)
    }
  }

  // 메모 저장
  const handleSaveNote = async (note: string) => {
    if (noteRoutine) {
      await saveNote(noteRoutine.id, note)
      setNoteRoutine(null)
    }
  }

  // 통계 조회
  const handleShowStats = async (routine: Routine) => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    
    setStatsRoutine(routine)
    setStatsYear(year)
    setStatsMonth(month)
    
    // 병렬로 데이터 로드
    const [statsResult, logsResult, notesResult] = await Promise.all([
      getStats(routine.id),
      getCalendarLogs(routine.id, year, month),
      getRecentNotes(routine.id, 5)
    ])
    
    setStats(statsResult)
    setCalendarLogs(logsResult)
    setRecentNotes(notesResult)
  }

  // 달력 월 변경
  const handleMonthChange = async (year: number, month: number) => {
    if (!statsRoutine) return
    
    setStatsYear(year)
    setStatsMonth(month)
    
    const logsResult = await getCalendarLogs(statsRoutine.id, year, month)
    setCalendarLogs(logsResult)
  }

  // 미완료 루틴 수
  const incompleteCount = todayRoutines.filter(r => !getRoutineCompleted(r.id)).length

  if (loading) {
    return (
      <div className="border-b border-gray-200 flex-shrink-0">
        <div className="px-4 py-3">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
            <div className="h-8 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="border-b border-gray-200 flex-shrink-0">
        <h2 className="text-sm mb-2 px-4 pt-4 font-semibold text-gray-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>🔄 ROUTINES</span>
            {incompleteCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-orange-100 text-orange-600 rounded-full">
                {incompleteCount}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="루틴 추가"
          >
            <Plus size={16} />
          </button>
        </h2>

        <div className="px-4 pb-3">
          {todayRoutines.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-3">
              + 버튼을 눌러 루틴을 추가하세요
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={todayRoutines.map(r => r.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-0">
                  {todayRoutines.map(routine => (
                    <SortableRoutineItem
                      key={routine.id}
                      routine={routine}
                      isCompleted={getRoutineCompleted(routine.id)}
                      note={getRoutineNote(routine.id)}
                      onToggle={() => toggleComplete(routine.id)}
                      onNoteClick={() => setNoteRoutine(routine)}
                      onEdit={() => setEditingRoutine(routine)}
                      onDelete={() => handleDeleteRoutine(routine)}
                      onStats={() => handleShowStats(routine)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* 생성 모달 */}
      {showCreateModal && (
        <RoutineModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleSaveRoutine}
        />
      )}

      {/* 수정 모달 */}
      {editingRoutine && (
        <RoutineModal
          routine={editingRoutine}
          onClose={() => setEditingRoutine(null)}
          onSave={handleSaveRoutine}
        />
      )}

      {/* 메모 모달 */}
      {noteRoutine && (
        <NoteModal
          routine={noteRoutine}
          currentNote={getRoutineNote(noteRoutine.id)}
          onClose={() => setNoteRoutine(null)}
          onSave={handleSaveNote}
        />
      )}

      {/* 통계 모달 */}
      {statsRoutine && (
        <StatsModal
          routine={statsRoutine}
          stats={stats}
          calendarLogs={calendarLogs}
          recentNotes={recentNotes}
          currentYear={statsYear}
          currentMonth={statsMonth}
          onClose={() => {
            setStatsRoutine(null)
            setStats(null)
            setCalendarLogs([])
            setRecentNotes([])
          }}
          onMonthChange={handleMonthChange}
        />
      )}
    </>
  )
}

