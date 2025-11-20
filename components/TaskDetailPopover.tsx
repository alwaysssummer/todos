'use client'

import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { X, Calendar, Clock, Repeat, CheckSquare, Trash2, FileText, MoreHorizontal, ChevronLeft, ChevronRight, FolderInput, StickyNote, Folder, UserCheck, BookCheck, AlertCircle } from 'lucide-react'
import type { Task, Project } from '@/types/database'

interface TaskDetailPopoverProps {
    task: Task
    updateTask: (id: string, updates: Partial<Task>) => Promise<void>
    deleteTask: (id: string) => Promise<void>
    onClose: () => void
    position?: { x: number, y: number }
    projects?: Project[]
}

export default function TaskDetailPopover({ task, updateTask, deleteTask, onClose, position, projects = [] }: TaskDetailPopoverProps) {
    const [title, setTitle] = useState(task.title)
    const [description, setDescription] = useState(task.description || '')
    const [duration, setDuration] = useState(task.duration || 30) // 기본값 30분
    const [startTime, setStartTime] = useState(task.start_time || '')
    const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(task.project_id)
    const popoverRef = useRef<HTMLDivElement>(null)

    // 학생 시간표 전용 state
    const [attendance, setAttendance] = useState(task.attendance || undefined)
    const [homeworkStatus, setHomeworkStatus] = useState(task.homework_status || undefined)
    const [lessonNote, setLessonNote] = useState(task.lesson_note || '')

    // Top 5 상태 (실시간 업데이트용)
    const [isTop5, setIsTop5] = useState(task.is_top5 || false)

    // 학생 시간표 태스크인지 확인
    const isStudentLesson = task.is_auto_generated || task.is_makeup

    // 주 단위 네비게이션을 위한 기준 날짜 (기본값: 오늘)
    const [baseDate, setBaseDate] = useState(new Date())

    // baseDate가 포함된 주의 월~일 날짜 배열 생성
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(baseDate)
        const day = d.getDay()
        const diff = d.getDate() - day + (day === 0 ? -6 : 1)
        d.setDate(diff + i)
        return d
    })

    const moveWeek = (direction: 'prev' | 'next') => {
        const newBase = new Date(baseDate)
        newBase.setDate(newBase.getDate() + (direction === 'next' ? 7 : -7))
        setBaseDate(newBase)
    }

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose()
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [onClose])

    useEffect(() => {
        if (task.start_time) {
            setStartTime(task.start_time)
            setBaseDate(new Date(task.start_time))
        } else {
            setStartTime('')
        }
    }, [task.start_time])

    const handleDateSelect = (date: Date) => {
        const newDate = new Date(date)

        if (startTime) {
            const current = new Date(startTime)
            newDate.setHours(current.getHours(), current.getMinutes())
        } else {
            newDate.setHours(9, 0, 0, 0)
        }

        const iso = newDate.toISOString()
        setStartTime(iso)
        updateTask(task.id, { start_time: iso, status: 'scheduled' })
    }

    // 시간/분 분리 선택을 위한 헬퍼
    const currentHour = startTime ? new Date(startTime).getHours() : 9
    const currentMinute = startTime ? new Date(startTime).getMinutes() : 0

    // 10분 단위로 내림 처리 (예: 15분 -> 10분)
    const roundedMinute = Math.floor(currentMinute / 10) * 10

    const updateTime = (h: number, m: number) => {
        let targetDate = startTime ? new Date(startTime) : new Date()
        targetDate.setHours(h, m, 0, 0)
        const iso = targetDate.toISOString()
        setStartTime(iso)
        updateTask(task.id, { start_time: iso, status: 'scheduled' })
    }

    const toggleTop5 = async () => {
        const newValue = !isTop5
        setIsTop5(newValue) // 즉시 UI 업데이트
        await updateTask(task.id, { is_top5: newValue })
    }

    const toggleComplete = async () => {
        await updateTask(task.id, { status: task.status === 'completed' ? 'inbox' : 'completed' })
        onClose()
    }

    const handleConvertToMemo = () => {
        if (confirm('이 태스크를 메모로 전환하시겠습니까? (기능 준비중)')) {
            // TODO: Implement conversion
            onClose()
        }
    }

    const handleMoveToProject = () => {
        alert('프로젝트 선택 기능 준비중')
    }

    // 학생 시간표 전용 함수들
    const updateAttendance = async (status: 'present' | 'absent' | 'late') => {
        setAttendance(status)
        await updateTask(task.id, { attendance: status })
    }

    const updateHomeworkStatus = async (status: 'done' | 'pending' | 'none') => {
        setHomeworkStatus(status)
        await updateTask(task.id, { homework_status: status })
    }

    const convertToMakeup = async () => {
        if (confirm('이 수업을 보충 수업으로 전환하시겠습니까?')) {
            await updateTask(task.id, { is_makeup: true })
            onClose()
        }
    }

    const cancelLesson = async () => {
        if (confirm('이 수업을 취소하시겠습니까?')) {
            await updateTask(task.id, { is_cancelled: true })
            onClose()
        }
    }

    // 항상 화면 정중앙에 표시
    const style: React.CSSProperties = {
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)'
    }

    return (
        <div
            ref={popoverRef}
            style={style}
            className="z-50 w-[400px] bg-white rounded-xl shadow-xl border border-gray-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
            {/* Header */}
            <div className="p-4 flex items-start gap-3 border-b border-gray-50">
                <button
                    onClick={toggleComplete}
                    className={`mt-1 w-5 h-5 rounded border flex items-center justify-center transition-colors ${task.status === 'completed'
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'border-gray-300 hover:border-blue-400 text-transparent'
                        }`}
                >
                    <CheckSquare size={14} />
                </button>

                <div className="flex-1">
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={() => updateTask(task.id, { title })}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault()
                                e.currentTarget.blur() // blur 시 updateTask 호출됨
                                onClose()
                            }
                        }}
                        className="w-full text-lg font-semibold text-gray-900 placeholder-gray-400 focus:outline-none"
                        placeholder="Task name"
                        autoFocus
                    />
                </div>

                {/* 상태 인디케이터들 */}
                <div className="flex items-center gap-2">
                    {/* Scheduled - 노란색 원 */}
                    {task.status === 'scheduled' && (
                        <div
                            className="w-5 h-5 rounded-full bg-yellow-400 border-2 border-yellow-400"
                            title="Scheduled"
                        />
                    )}

                    {/* Top 5 - 빨간색 원 */}
                    <button
                        onClick={toggleTop5}
                        className="transition-colors"
                    >
                        <div className={`w-5 h-5 rounded-full border-2 transition-all ${isTop5
                            ? 'bg-red-500 border-red-500'
                            : 'border-gray-300 hover:border-red-400'
                            }`} />
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="p-4 space-y-5">
                {/* Date Picker Section */}
                <div className="space-y-2">
                    {/* Week Navigator */}
                    <div className="flex items-center justify-between mb-2">
                        <button
                            onClick={() => moveWeek('prev')}
                            className="p-1 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <span className="text-sm font-medium text-gray-600">
                            {format(weekDays[0], 'M월 d일', { locale: ko })} - {format(weekDays[6], 'M월 d일', { locale: ko })}
                        </span>
                        <button
                            onClick={() => moveWeek('next')}
                            className="p-1 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {weekDays.map((date, index) => {
                            const isSelected = startTime && new Date(startTime).toDateString() === date.toDateString()
                            const isToday = new Date().toDateString() === date.toDateString()

                            return (
                                <button
                                    key={date.toISOString()}
                                    onClick={() => handleDateSelect(date)}
                                    className={`flex flex-col items-center justify-center py-2 rounded-lg transition-all ${isSelected
                                        ? 'bg-blue-600 text-white shadow-md scale-105'
                                        : isToday
                                            ? 'bg-blue-50 text-blue-600 border border-blue-100 font-medium'
                                            : 'bg-white text-gray-600 hover:bg-gray-50 border border-transparent'
                                        }`}
                                >
                                    <span className="text-xs font-semibold mb-0.5">{format(date, 'E', { locale: ko })}</span>
                                    <span className="text-[11px]">{format(date, 'd')}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Time & Options Row */}
                <div className="grid grid-cols-2 gap-4">
                    {/* Time Selector (Hour : Minute) */}
                    <div className="flex items-center gap-1 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                        <Clock size={16} className="text-gray-400 mr-1" />

                        {/* Hour */}
                        <select
                            value={currentHour}
                            onChange={(e) => updateTime(Number(e.target.value), roundedMinute)}
                            className="bg-transparent font-medium focus:outline-none cursor-pointer text-right"
                        >
                            {Array.from({ length: 24 }, (_, i) => (
                                <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                            ))}
                        </select>
                        <span className="text-gray-400">:</span>
                        {/* Minute (10 min step) */}
                        <select
                            value={roundedMinute}
                            onChange={(e) => updateTime(currentHour, Number(e.target.value))}
                            className="bg-transparent font-medium focus:outline-none cursor-pointer"
                        >
                            {[0, 10, 20, 30, 40, 50].map((m) => (
                                <option key={m} value={m}>{m.toString().padStart(2, '00')}</option>
                            ))}
                        </select>
                    </div>

                    {/* Duration Selector */}
                    <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                        <select
                            value={duration}
                            onChange={(e) => {
                                const val = Number(e.target.value)
                                setDuration(val)
                                updateTask(task.id, { duration: val })
                            }}
                            className="flex-1 bg-transparent focus:outline-none cursor-pointer text-gray-900 font-medium text-right pr-1"
                        >
                            {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120].map(min => (
                                <option key={min} value={min}>
                                    {min}분 {min >= 60 ? `(${Math.floor(min / 60)}시간${min % 60 ? ' ' + min % 60 + '분' : ''})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Project Selector */}
                <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                    <Folder size={16} className="text-gray-400" />
                    <select
                        value={selectedProjectId || ''}
                        onChange={(e) => {
                            const val = e.target.value || undefined
                            setSelectedProjectId(val)
                            updateTask(task.id, { project_id: val })
                        }}
                        className="flex-1 bg-transparent focus:outline-none cursor-pointer text-gray-900 font-medium"
                    >
                        <option value="">프로젝트 없음</option>
                        {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                                {project.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Memo */}
                <div className="flex gap-3 text-sm text-gray-600 items-start bg-gray-50 p-3 rounded-lg">
                    <FileText size={16} className="text-gray-400 mt-0.5" />
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        onBlur={() => updateTask(task.id, { description })}
                        placeholder="메모 추가..."
                        className="flex-1 bg-transparent resize-none focus:outline-none text-sm min-h-[60px] placeholder-gray-400 text-gray-900"
                    />
                </div>

                {/* 학생 시간표 전용 섹션 */}
                {isStudentLesson && (
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                        {/* 출결 상태 */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <UserCheck size={16} />
                                출결 상태
                            </label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => updateAttendance('present')}
                                    className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${attendance === 'present'
                                        ? 'border-green-500 bg-green-50 text-green-700'
                                        : 'border-gray-200 text-gray-600 hover:border-green-300'
                                        }`}
                                >
                                    출석
                                </button>
                                <button
                                    onClick={() => updateAttendance('late')}
                                    className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${attendance === 'late'
                                        ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                                        : 'border-gray-200 text-gray-600 hover:border-yellow-300'
                                        }`}
                                >
                                    지각
                                </button>
                                <button
                                    onClick={() => updateAttendance('absent')}
                                    className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${attendance === 'absent'
                                        ? 'border-red-500 bg-red-50 text-red-700'
                                        : 'border-gray-200 text-gray-600 hover:border-red-300'
                                        }`}
                                >
                                    결석
                                </button>
                            </div>
                        </div>

                        {/* 과제 상태 */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <BookCheck size={16} />
                                과제 상태
                            </label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => updateHomeworkStatus('done')}
                                    className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${homeworkStatus === 'done'
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-gray-200 text-gray-600 hover:border-blue-300'
                                        }`}
                                >
                                    완료
                                </button>
                                <button
                                    onClick={() => updateHomeworkStatus('pending')}
                                    className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${homeworkStatus === 'pending'
                                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                                        : 'border-gray-200 text-gray-600 hover:border-orange-300'
                                        }`}
                                >
                                    대기
                                </button>
                                <button
                                    onClick={() => updateHomeworkStatus('none')}
                                    className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${homeworkStatus === 'none'
                                        ? 'border-gray-400 bg-gray-50 text-gray-700'
                                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                        }`}
                                >
                                    없음
                                </button>
                            </div>
                        </div>

                        {/* 수업 메모 */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <FileText size={16} />
                                수업 메모
                            </label>
                            <textarea
                                value={lessonNote}
                                onChange={(e) => setLessonNote(e.target.value)}
                                onBlur={() => updateTask(task.id, { lesson_note: lessonNote })}
                                placeholder="수업 내용, 진도, 특이사항 등을 기록하세요..."
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                rows={3}
                            />
                        </div>

                        {/* 수업 관리 버튼 */}
                        <div className="flex gap-2 pt-2">
                            {!task.is_makeup && !task.is_cancelled && (
                                <button
                                    onClick={convertToMakeup}
                                    className="flex-1 py-2 px-3 rounded-lg border border-yellow-300 bg-yellow-50 text-yellow-700 text-sm font-medium hover:bg-yellow-100 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Calendar size={16} />
                                    보충으로 전환
                                </button>
                            )}
                            {!task.is_cancelled && (
                                <button
                                    onClick={cancelLesson}
                                    className="flex-1 py-2 px-3 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    <AlertCircle size={16} />
                                    수업 취소
                                </button>
                            )}
                        </div>

                        {/* 상태 표시 */}
                        <div className="flex gap-2 text-xs">
                            {task.is_makeup && (
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full font-medium">
                                    보충 수업
                                </span>
                            )}
                            {task.is_cancelled && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full font-medium">
                                    취소됨
                                </span>
                            )}
                            {task.is_auto_generated && !task.is_makeup && (
                                <span className="px-2 py-1 bg-sky-100 text-sky-700 rounded-full font-medium">
                                    정규 수업
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-gray-50 flex justify-between items-center border-t border-gray-100">
                <div className="flex gap-1">
                    <button
                        onClick={handleConvertToMemo}
                        className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors tooltip"
                        title="메모로 전환"
                    >
                        <StickyNote size={16} />
                    </button>
                    <button
                        onClick={handleMoveToProject}
                        className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors tooltip"
                        title="프로젝트로 이동"
                    >
                        <FolderInput size={16} />
                    </button>
                    <div className="w-px h-4 bg-gray-300 mx-2 self-center"></div>
                    <button
                        onClick={() => {
                            if (confirm('이 태스크를 삭제하시겠습니까?')) {
                                deleteTask(task.id)
                                onClose()
                            }
                        }}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="삭제"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
                <div className="text-xs text-gray-400 px-2">
                    {format(new Date(task.created_at), 'yyyy. MM. dd')}
                </div>
            </div>
        </div>
    )
}
