'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { format, isSameDay, startOfWeek, endOfWeek } from 'date-fns'
import { ko } from 'date-fns/locale'
import { X, Calendar, Clock, Repeat, CheckSquare, Trash2, FileText, MoreHorizontal, ChevronLeft, ChevronRight, FolderInput, StickyNote, Folder, UserCheck, BookCheck, AlertCircle, PlusCircle, BookOpen } from 'lucide-react'
import type { Task, Project, HomeworkCheckItem, HomeworkAssignmentItem } from '@/types/database'
import { useTextbooks } from '@/hooks/useTextbooks'
import { supabase } from '@/lib/supabase'
import { extractTags } from '@/utils/textParser'

interface TaskDetailPopoverProps {
    task: Task
    updateTask: (id: string, updates: Partial<Task>) => Promise<void>
    deleteTask: (id: string) => Promise<void>
    onClose: () => void
    position?: { x: number, y: number }
    projects?: Project[]
    tasks?: Task[]
    createTask?: (task: Partial<Task>) => Promise<any>
    toggleTaskStatus?: (id: string, currentStatus: string) => void
    setPendingCancelTask?: (task: any) => void
    onSelectMakeupProject?: (project: Project | null) => void
}

export default function TaskDetailPopover({ task, updateTask, deleteTask, onClose, position, projects = [], tasks = [], createTask, toggleTaskStatus, setPendingCancelTask, onSelectMakeupProject }: TaskDetailPopoverProps) {
    const [title, setTitle] = useState(task.title)
    const [description, setDescription] = useState(task.description || '')
    const [duration, setDuration] = useState(task.duration || 30) // 기본값 30분
    const [startTime, setStartTime] = useState(task.start_time || '')
    const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(task.project_id)
    const popoverRef = useRef<HTMLDivElement>(null)

    // 학생 시간표 전용 state
    const [attendance, setAttendance] = useState(task.attendance || undefined)
    const [homeworkStatus, setHomeworkStatus] = useState(task.homework_status || undefined)
    const [quickInput, setQuickInput] = useState('') // 통합 입력용 (INBOX Task 생성)

    // Top 5 상태 (실시간 업데이트용)
    const [isTop5, setIsTop5] = useState(task.is_top5 || false)

    // 태그 편집 state
    const [editedTags, setEditedTags] = useState<string[]>(task.tags || [])
    const [newTag, setNewTag] = useState('')

    // 과제 관리 state (Phase 6)
    const [homeworkChecks, setHomeworkChecks] = useState<HomeworkCheckItem[]>(task.homework_checks || [])
    const [homeworkAssignments, setHomeworkAssignments] = useState<HomeworkAssignmentItem[]>(task.homework_assignments || [])
    const { textbooks } = useTextbooks()

    // 학생 시간표 태스크인지 확인
    const isStudentLesson = task.is_auto_generated || task.is_makeup
    
    // 현재 태스크의 프로젝트
    const project = projects.find(p => p.id === task.project_id)

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

    // 이번 주의 모든 수업 찾기 (학생 수업 네비게이터용)
    const thisWeekLessons = useMemo(() => {
        if (!project || !isStudentLesson) return []
        
        return tasks.filter(t => 
            t.project_id === project.id &&
            t.start_time &&
            (t.is_auto_generated || t.is_makeup) &&
            weekDays.some(day => isSameDay(new Date(t.start_time!), day))
        ).sort((a, b) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime())
    }, [tasks, project, weekDays, isStudentLesson])

    // 이 수업 날짜의 INBOX 메모들 (학생 태그 + 수업 날짜)
    const lessonMemos = useMemo(() => {
        if (!project || !isStudentLesson || !task.start_time) return []
        
        const studentTag = project.name
        return tasks.filter(t => 
            t.status === 'inbox' &&
            t.tags?.includes(studentTag) &&
            t.start_time &&
            isSameDay(new Date(t.start_time), new Date(task.start_time!))
        ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }, [tasks, project, isStudentLesson, task.start_time])

    // 통합 입력 핸들러 (LeftPanel의 빠른 입력과 동일한 로직)
    const handleQuickInput = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (!quickInput.trim() || !createTask) return

            let title = quickInput.trim()
            let isTop5 = false
            let dueDate: string | undefined = undefined

            // LeftPanel과 동일: * = Focus, / = Today
            if (title.startsWith('*')) {
                isTop5 = true
                title = title.substring(1).trim()
            } else if (title.startsWith('/')) {
                dueDate = new Date().toISOString()
                title = title.substring(1).trim()
            }

            // 태그 추출 (LeftPanel과 동일)
            const { cleanTitle, tags } = extractTags(title)

            // 학생 이름 자동 태그 추가 (유일한 차이점!)
            const studentTag = project?.name || ''
            const allTags = [...new Set([...tags, studentTag])]

            // INBOX에 새 Task 생성 (LeftPanel과 동일!)
            await createTask({
                title: cleanTitle,
                status: 'inbox',
                is_top5: isTop5,
                due_date: dueDate,
                project_id: task.project_id,  // 학생 프로젝트 연결
                tags: allTags,  // #서원 자동 포함
                start_time: task.start_time  // 수업 날짜/시간
            })

            setQuickInput('')  // 입력 초기화
        }
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

    const toggleComplete = () => {
        // 체크박스 전용 초고속 함수가 있으면 사용, 없으면 일반 updateTask 사용
        if (toggleTaskStatus) {
            toggleTaskStatus(task.id, task.status)
        } else {
            updateTask(task.id, { status: task.status === 'completed' ? 'inbox' : 'completed' })
                .catch(error => {
                    console.error('Failed to toggle task:', error)
                })
        }
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

    // ===== 과제 체크 함수들 (Phase 6) =====
    
    // 과제 체크 토글
    const toggleHomeworkCheck = (index: number) => {
        const updated = [...homeworkChecks]
        updated[index] = {
            ...updated[index],
            is_completed: !updated[index].is_completed,
            completed_at: !updated[index].is_completed ? new Date().toISOString() : undefined
        }
        setHomeworkChecks(updated)
        updateTask(task.id, { homework_checks: updated })
    }

    // 과제 체크 메모 업데이트
    const updateCheckNote = (index: number, note: string) => {
        const updated = [...homeworkChecks]
        updated[index] = {
            ...updated[index],
            note
        }
        setHomeworkChecks(updated)
        // 디바운스 없이 즉시 저장
        updateTask(task.id, { homework_checks: updated })
    }

    // 과제 체크 항목 삭제
    const removeHomeworkCheck = (index: number) => {
        const updated = homeworkChecks.filter((_, i) => i !== index)
        setHomeworkChecks(updated)
        updateTask(task.id, { 
            homework_checks: updated.length > 0 ? updated : undefined 
        })
    }

    // 중복 제거 (같은 교재 + 단원)
    const removeDuplicateChecks = (textbookId: string) => {
        const seen = new Set<string>()
        const cleaned = homeworkChecks.filter(check => {
            if (check.textbook_id !== textbookId) return true
            
            const key = `${check.textbook_id}-${check.chapter}`
            if (seen.has(key)) {
                return false // 중복 제거
            }
            seen.add(key)
            return true
        })
        
        const removed = homeworkChecks.length - cleaned.length
        
        if (removed > 0) {
            setHomeworkChecks(cleaned)
            updateTask(task.id, { homework_checks: cleaned })
            alert(`${removed}개의 중복 항목이 제거되었습니다.`)
        } else {
            alert('중복 항목이 없습니다.')
        }
    }

    // ===== 다음 과제 배정 함수들 (Phase 7) =====

    // 단원 선택 토글
    const toggleAssignmentChapter = (textbookId: string, chapter: string) => {
        const textbook = textbooks.find(t => t.id === textbookId)
        if (!textbook) return

        const existingIdx = homeworkAssignments.findIndex(a => a.textbook_id === textbookId)

        if (existingIdx >= 0) {
            // 이미 있는 교재
            const existing = homeworkAssignments[existingIdx]
            const chapters = existing.chapters.includes(chapter)
                ? existing.chapters.filter(c => c !== chapter) // 제거
                : [...existing.chapters, chapter].sort((a, b) => parseInt(a) - parseInt(b)) // 추가 및 정렬

            const updated = [...homeworkAssignments]
            if (chapters.length === 0) {
                // 모든 단원이 제거되면 교재도 제거
                updated.splice(existingIdx, 1)
            } else {
                updated[existingIdx] = { ...existing, chapters }
            }

            setHomeworkAssignments(updated)
            updateTask(task.id, {
                homework_assignments: updated.length > 0 ? updated : undefined
            })
        } else {
            // 새 교재 추가
            const newAssignment: HomeworkAssignmentItem = {
                textbook_id: textbookId,
                textbook_name: textbook.name,
                chapters: [chapter]
            }

            const updated = [...homeworkAssignments, newAssignment]
            setHomeworkAssignments(updated)
            updateTask(task.id, { homework_assignments: updated })
        }
    }

    // ===== 수업 취소 로직 (Phase 8) =====
    
    // 다음 수업 찾기 헬퍼 함수
    const findNextLesson = async (projectId: string, currentStartTime: string) => {
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('project_id', projectId)
            .gt('start_time', currentStartTime)
            .eq('is_cancelled', false)
            .order('start_time', { ascending: true })
            .limit(1)
            .single()

        return error ? null : data
    }

    // 보충 먼저 잡기
    const handleCancelWithMakeup = () => {
        if (!setPendingCancelTask || !onSelectMakeupProject || !project) return

        // 취소할 수업 정보 저장
        setPendingCancelTask({
            taskId: task.id,
            projectId: task.project_id!,
            homeworkAssignments: homeworkAssignments
        })

        // 보충 모드 활성화
        onSelectMakeupProject(project)

        alert(
            '보충 수업을 추가할 시간을 시간표에서 더블클릭하세요.\n' +
            '보충이 추가되면 자동으로 과제가 배정되고 이 수업이 취소됩니다.'
        )

        onClose()
    }

    // 바로 다음 수업으로 이전
    const handleCancelWithoutMakeup = async () => {
        try {
            // 다음 수업 찾기
            const nextLesson = await findNextLesson(task.project_id!, task.start_time!)

            if (!nextLesson) {
                alert('다음 수업이 없어 과제를 이전할 수 없습니다.')
                return
            }

            // 과제 배정 → 과제 체크로 변환
            const transferredChecks: HomeworkCheckItem[] =
                homeworkAssignments.flatMap(assignment =>
                    assignment.chapters.map(chapter => ({
                        textbook_id: assignment.textbook_id,
                        textbook_name: assignment.textbook_name,
                        chapter: chapter,
                        is_completed: false,
                        note: '(취소된 수업에서 이전)'
                    }))
                )

            // 다음 수업에 과제 추가
            await updateTask(nextLesson.id, {
                homework_checks: [
                    ...(nextLesson.homework_checks || []),
                    ...transferredChecks
                ]
            })

            // 현재 수업 취소
            await updateTask(task.id, {
                is_cancelled: true,
                status: 'cancelled',
                homework_assignments: []
            })

            const nextLessonDate = new Date(nextLesson.start_time)
            alert(
                `수업이 취소되었습니다.\n\n` +
                `과제가 다음 수업(${nextLessonDate.toLocaleDateString()} ${nextLessonDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })})으로 이전되었습니다.`
            )

            onClose()

        } catch (error) {
            console.error('수업 취소 실패:', error)
            alert('오류가 발생했습니다.')
        }
    }

    const cancelLesson = () => {
        const wantMakeup = confirm(
            '이 수업을 취소하시겠습니까?\n\n' +
            '확인: 보충 수업을 먼저 잡겠습니다\n' +
            '취소: 다음 수업으로 과제를 바로 이전합니다'
        )

        if (wantMakeup) {
            handleCancelWithMakeup()
        } else {
            handleCancelWithoutMakeup()
        }
    }

    // 태그 추가
    const handleAddTag = () => {
        if (newTag.trim() && !editedTags.includes(newTag.trim())) {
            const updated = [...editedTags, newTag.trim()]
            setEditedTags(updated)
            updateTask(task.id, { tags: updated })
            setNewTag('')
        }
    }

    // 태그 제거
    const handleRemoveTag = (tag: string) => {
        const updated = editedTags.filter(t => t !== tag)
        setEditedTags(updated)
        updateTask(task.id, { tags: updated.length > 0 ? updated : undefined })
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
            className="z-50 w-[900px] bg-white rounded-xl shadow-xl border border-gray-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
            {/* Header */}
            <div className="p-2 flex items-start gap-2 border-b border-gray-50">
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
                {/* 학생 수업 네비게이터 (이번 주 수업 표시) */}
                {isStudentLesson && (
                    <div className="space-y-1">
                        {/* Week Navigator */}
                        <div className="flex items-center justify-between">
                            <button
                                onClick={() => moveWeek('prev')}
                                className="p-0.5 hover:bg-gray-100 rounded text-gray-500 transition-colors"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="text-xs font-medium text-gray-600">
                                {format(weekDays[0], 'M.d', { locale: ko })} - {format(weekDays[6], 'M.d', { locale: ko })}
                            </span>
                            <button
                                onClick={() => moveWeek('next')}
                                className="p-0.5 hover:bg-gray-100 rounded text-gray-500 transition-colors"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>

                        {/* Days Grid - 수업이 있는 날 표시 */}
                        <div className="grid grid-cols-7 gap-0.5">
                            {weekDays.map((date) => {
                                const lessonOnThisDay = thisWeekLessons.find(
                                    lesson => isSameDay(new Date(lesson.start_time!), date)
                                )
                                const isCurrentLesson = lessonOnThisDay?.id === task.id
                                const isToday = isSameDay(new Date(), date)

                                return (
                                    <button
                                        key={date.toISOString()}
                                        onClick={() => {
                                            if (lessonOnThisDay && lessonOnThisDay.id !== task.id) {
                                                // 해당 수업으로 전환 (popover 닫고 다시 열기)
                                                onClose()
                                                // Note: 부모 컴포넌트에서 처리 필요
                                            } else if (!isStudentLesson) {
                                                handleDateSelect(date)
                                            }
                                        }}
                                        className={`flex flex-col items-center justify-center py-1 px-0.5 rounded text-[10px] transition-all ${
                                            isCurrentLesson
                                                ? 'bg-blue-600 text-white font-bold'
                                                : lessonOnThisDay
                                                    ? 'bg-blue-100 text-blue-700 font-semibold hover:bg-blue-200'
                                                    : isToday
                                                        ? 'bg-gray-100 text-gray-600'
                                                        : 'bg-gray-50 text-gray-400'
                                        }`}
                                        disabled={!lessonOnThisDay && isStudentLesson}
                                    >
                                        <div className="leading-tight">{format(date, 'E', { locale: ko })}</div>
                                        <div className="leading-tight font-bold">{format(date, 'd')}</div>
                                        {lessonOnThisDay && <div className="text-blue-600 leading-tight">●</div>}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Date Picker Section - 일반 태스크용 */}
                {!isStudentLesson && (
                    <div className="space-y-1">
                        {/* Week Navigator */}
                        <div className="flex items-center justify-between mb-1">
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
                )}

                {/* Time & Options Row - 학생 수업에서는 숨김 */}
                {!isStudentLesson && (
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
                )}

                {/* Project Selector - 학생 수업에서는 숨김 */}
                {!isStudentLesson && (
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
                )}

                {/* Memo - 학생 수업에서는 숨김 (수업 메모 별도 있음) */}
                {!isStudentLesson && (
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
                )}

                {/* Tags - 학생 수업에서는 숨김 */}
                {!isStudentLesson && (
                    <div className="space-y-2">
                        <label className="text-xs text-gray-500 font-medium">Tags</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {editedTags.map(tag => (
                                <span
                                    key={tag}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                                >
                                    #{tag}
                                    <button
                                        onClick={() => handleRemoveTag(tag)}
                                        className="hover:text-red-500 transition-colors"
                                    >
                                        <X size={12} />
                                    </button>
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        handleAddTag()
                                    }
                                }}
                                placeholder="태그 추가..."
                                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                onClick={handleAddTag}
                                className="px-4 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors font-medium"
                            >
                                추가
                            </button>
                        </div>
                    </div>
                )}

                {/* 학생 시간표 전용 섹션 */}
                {isStudentLesson && (
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                        {/* ===== 과제 체크 (Phase 6) - 가로 4열 레이아웃 ===== */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-700 flex items-center gap-2">
                                <BookCheck size={14} />
                                과제 체크
                            </label>

                            {project?.textbooks && project.textbooks.length > 0 ? (
                                <div className="grid grid-cols-4 gap-2">
                                    {project.textbooks.map(textbookId => {
                                        const textbook = textbooks.find(t => t.id === textbookId)
                                        if (!textbook) return null

                                        const checksForTextbook = homeworkChecks.filter(
                                            check => check.textbook_id === textbookId
                                        )

                                        return (
                                            <div key={textbookId} className="border rounded-md p-1.5 bg-white">
                                                {/* 교재명 */}
                                                <div className="text-xs font-semibold text-gray-900 mb-1 truncate" title={textbook.name}>
                                                    {textbook.name}
                                                </div>

                                                {checksForTextbook.length === 0 ? (
                                                    <div className="text-xs text-gray-400">
                                                        없음
                                                    </div>
                                                ) : (
                                                    <div className="space-y-0.5">
                                                        {checksForTextbook.map((check, idx) => {
                                                            const globalIdx = homeworkChecks.indexOf(check)
                                                            return (
                                                                <div key={idx} className="flex items-center gap-1">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={check.is_completed}
                                                                        onChange={() => toggleHomeworkCheck(globalIdx)}
                                                                        className="w-3 h-3 rounded border-gray-300 text-blue-600"
                                                                    />
                                                                    <span className={`text-xs flex-1 ${check.is_completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                                                        {check.chapter}
                                                                        {textbook.chapter_unit === '직접입력' 
                                                                            ? textbook.custom_chapter_unit 
                                                                            : textbook.chapter_unit}
                                                                    </span>
                                                                    <button
                                                                        onClick={() => removeHomeworkCheck(globalIdx)}
                                                                        className="text-red-400 hover:text-red-600 p-0.5"
                                                                        title="삭제"
                                                                    >
                                                                        <X size={10} />
                                                                    </button>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="text-xs text-gray-400 text-center py-3 bg-gray-50 rounded-lg">
                                    배정된 교재가 없습니다
                                </div>
                            )}
                        </div>

                        {/* ===== 다음 과제 배정 (Phase 7) - 가로 4열 레이아웃 ===== */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-700 flex items-center gap-2">
                                <PlusCircle size={14} />
                                다음 과제 배정
                            </label>

                            {project?.textbooks && project.textbooks.length > 0 ? (
                                <div className="grid grid-cols-4 gap-2">
                                    {project.textbooks.map(textbookId => {
                                        const textbook = textbooks.find(t => t.id === textbookId)
                                        if (!textbook) return null

                                        const assignment = homeworkAssignments.find(a => a.textbook_id === textbookId)

                                        return (
                                            <div key={textbookId} className="border rounded-md p-1.5 bg-white">
                                                {/* 교재명 */}
                                                <div className="text-xs font-semibold text-gray-900 mb-1 truncate" title={textbook.name}>
                                                    {textbook.name}
                                                </div>

                                                {/* 단원 선택 그리드 (5열 → 4열로 축소) */}
                                                <div className="grid grid-cols-4 gap-0.5">
                                                    {Array.from({ length: Math.min(textbook.total_chapters, 20) }, (_, i) => {
                                                        const chapter = (i + 1).toString()
                                                        const isSelected = assignment?.chapters.includes(chapter)

                                                        return (
                                                            <button
                                                                key={chapter}
                                                                onClick={() => toggleAssignmentChapter(textbookId, chapter)}
                                                                className={`px-1 py-0.5 text-[10px] rounded transition-colors font-medium ${
                                                                    isSelected
                                                                        ? 'bg-blue-500 text-white'
                                                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                                                }`}
                                                            >
                                                                {chapter}
                                                            </button>
                                                        )
                                                    })}
                                                </div>

                                                {/* 20개 초과시 안내 */}
                                                {textbook.total_chapters > 20 && (
                                                    <div className="text-[9px] text-gray-400 mt-1">
                                                        1-20만 표시 (총 {textbook.total_chapters}개)
                                                    </div>
                                                )}

                                                {/* 선택된 단원 요약 */}
                                                {assignment && assignment.chapters.length > 0 && (
                                                    <div className="mt-1 text-[10px] text-blue-600 font-medium">
                                                        ✓ {assignment.chapters.join(',')} ({assignment.chapters.length})
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="text-xs text-gray-400 text-center py-3 bg-gray-50 rounded-lg">
                                    배정된 교재가 없습니다
                                </div>
                            )}
                        </div>

                        {/* Phase 9: 출결상태/과제상태 숨김 (나중에 필요시 복원 가능) */}
                        {/* 
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <UserCheck size={16} />
                                출결 상태
                            </label>
                            ...
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <BookCheck size={16} />
                                과제 상태
                            </label>
                            ...
                        </div>
                        */}

                        {/* 빠른 입력 (INBOX Task 생성) */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                                <FileText size={14} />
                                수업 메모
                                <span className="text-[10px] text-gray-400 ml-auto">
                                    (*Focus /Today [[태그]] #태그 #{project?.name}자동)
                                </span>
                            </label>
                            <textarea
                                value={quickInput}
                                onChange={(e) => setQuickInput(e.target.value)}
                                onKeyDown={handleQuickInput}
                                placeholder="예: Unit 5 완료 [[문법]] #복습 (Enter로 INBOX 추가)"
                                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                rows={2}
                            />
                            
                            {/* 이 수업의 메모 목록 (INBOX에서 가져옴) */}
                            {lessonMemos.length > 0 && (
                                <div className="space-y-0.5 max-h-24 overflow-y-auto">
                                    {lessonMemos.map(memo => (
                                        <div
                                            key={memo.id}
                                            className="flex items-start gap-1 text-xs bg-gray-50 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                                        >
                                            <button
                                                onClick={() => toggleTaskStatus?.(memo.id, memo.status)}
                                                className={`mt-0.5 w-3 h-3 rounded border flex-shrink-0 ${
                                                    memo.status === 'completed'
                                                        ? 'bg-blue-500 border-blue-500'
                                                        : 'border-gray-300'
                                                }`}
                                            />
                                            <span className={`flex-1 ${memo.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                                                {memo.title}
                                            </span>
                                            {memo.is_top5 && <span className="text-red-500 text-[10px]">★</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 수업 관리 버튼 */}
                        <div className="flex gap-2 pt-1">
                            {!task.is_cancelled && (
                                <button
                                    onClick={cancelLesson}
                                    className="w-full py-2 px-3 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
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
