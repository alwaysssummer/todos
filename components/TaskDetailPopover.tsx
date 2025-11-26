'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { format, isSameDay, startOfWeek, endOfWeek } from 'date-fns'
import { ko } from 'date-fns/locale'
import { X, Calendar, Clock, Repeat, CheckSquare, Trash2, FileText, MoreHorizontal, ChevronLeft, ChevronRight, FolderInput, StickyNote, Folder, UserCheck, BookCheck, AlertCircle, PlusCircle, BookOpen } from 'lucide-react'
import type { Task, Project, HomeworkCheckItem, HomeworkAssignmentItem } from '@/types/database'
import { useTextbooks } from '@/hooks/useTextbooks'
import { supabase } from '@/lib/supabase'
import { extractTags } from '@/utils/textParser'
import ChapterGrid from './ChapterGrid'
import ChecklistMemo from './ChecklistMemo'

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
    onNavigateToTask?: (task: Task) => void
}

export default function TaskDetailPopover({ task, updateTask, deleteTask, onClose, position, projects = [], tasks = [], createTask, toggleTaskStatus, setPendingCancelTask, onSelectMakeupProject, onNavigateToTask }: TaskDetailPopoverProps) {
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
    
    // 시간 설정 드롭다운 상태
    const [showTimeDropdown, setShowTimeDropdown] = useState(false)


    // 과제 관리 state (Phase 6)
    const [homeworkChecks, setHomeworkChecks] = useState<HomeworkCheckItem[]>(task.homework_checks || [])
    const [homeworkAssignments, setHomeworkAssignments] = useState<HomeworkAssignmentItem[]>(task.homework_assignments || [])
    const { textbooks } = useTextbooks()

    // 현재 태스크의 프로젝트 (먼저 정의!)
    const project = projects.find(p => p.id === task.project_id)
    
    // 학생 시간표 태스크인지 확인
    const isStudentLesson = task.is_auto_generated || task.is_makeup

    // 페이지네이션 state (교재별)
    const [currentPages, setCurrentPages] = useState<Record<string, number>>({})
    // Shift 선택용 마지막 클릭 단원 (교재별)
    const [lastClicked, setLastClicked] = useState<Record<string, string>>({})

    // task 변경 시 state 초기화 (네비게이터 이동 시 필수!)
    useEffect(() => {
        setTitle(task.title)
        setDescription(task.description || '')
        setDuration(task.duration || 30)
        setStartTime(task.start_time || '')
        setSelectedProjectId(task.project_id)
        setAttendance(task.attendance || undefined)
        setHomeworkStatus(task.homework_status || undefined)
        setIsTop5(task.is_top5 || false)
        setHomeworkChecks(task.homework_checks || [])
        setHomeworkAssignments(task.homework_assignments || [])
        
        // 각 교재의 초기 페이지 자동 설정 (진도 기반)
        if (project?.textbooks) {
            const initialPages: Record<string, number> = {}
            project.textbooks.forEach(tbId => {
                const checks = (task.homework_checks || []).filter(c => c.textbook_id === tbId)
                if (checks.length > 0) {
                    const maxChapter = Math.max(...checks.map(c => parseInt(c.chapter)))
                    initialPages[tbId] = Math.floor((maxChapter - 1) / 20)
                } else {
                    initialPages[tbId] = 0
                }
            })
            setCurrentPages(initialPages)
        }
    }, [task.id, project])

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

    // 학생의 모든 수업 메모 (학생 태그로 필터링, 날짜 무관)
    const lessonMemos = useMemo(() => {
        if (!project || !isStudentLesson) return []
        
        const studentTag = project.name
        return tasks.filter(t => 
            t.status === 'inbox' &&
            t.tags?.includes(studentTag) &&
            t.project_id === project.id  // 같은 학생 프로젝트
        ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }, [tasks, project, isStudentLesson])

    // 이전 수업 찾기 헬퍼 함수
    const findPreviousLesson = (projectId: string, currentStartTime: string) => {
        return tasks
            .filter(t =>
                t.project_id === projectId &&
                t.start_time &&
                new Date(t.start_time) < new Date(currentStartTime) &&
                !t.is_cancelled &&
                (t.is_auto_generated || t.is_makeup)
            )
            .sort((a, b) => new Date(b.start_time!).getTime() - new Date(a.start_time!).getTime())
            [0] // 가장 가까운 이전 수업
    }

    // 과제 배정 → 과제 체크 자동 전환 (핵심 로직!)
    useEffect(() => {
        if (!isStudentLesson || !task.start_time || !project || !task.id) return

        // 이전 수업 찾기
        const previousLesson = findPreviousLesson(project.id, task.start_time)
        
        // 이전 수업에 배정된 과제가 있으면
        if (previousLesson?.homework_assignments && previousLesson.homework_assignments.length > 0) {
            // 과제 배정 → 과제 체크로 변환
            const newChecks: HomeworkCheckItem[] = previousLesson.homework_assignments.flatMap(
                assignment => assignment.chapters.map(chapter => ({
                    textbook_id: assignment.textbook_id,
                    textbook_name: assignment.textbook_name,
                    chapter: chapter,
                    is_completed: false,
                    note: undefined
                }))
            )

            // 중복 체크 (같은 교재-단원 조합 제거)
            const existingKeys = new Set(
                homeworkChecks.map(c => `${c.textbook_id}-${c.chapter}`)
            )
            const uniqueNewChecks = newChecks.filter(
                c => !existingKeys.has(`${c.textbook_id}-${c.chapter}`)
            )

            // 새로운 체크 항목이 있으면 추가 (기존 + 신규 병합)
            if (uniqueNewChecks.length > 0) {
                const updatedChecks = [...homeworkChecks, ...uniqueNewChecks]
                setHomeworkChecks(updatedChecks)
                updateTask(task.id, { homework_checks: updatedChecks })
            }
        }
    }, [task.id, isStudentLesson, task.start_time, project])

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

    // 페이지 변경 핸들러 (ChapterGrid용)
    const handlePageChange = useCallback((textbookId: string, page: number) => {
        setCurrentPages(prev => ({ ...prev, [textbookId]: page }))
    }, [])

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

    // 단원 선택 (Ctrl/Shift 지원)
    const toggleAssignmentChapter = (
        textbookId: string, 
        chapter: string, 
        e?: React.MouseEvent
    ) => {
        const textbook = textbooks.find(t => t.id === textbookId)
        if (!textbook) return

        const existingIdx = homeworkAssignments.findIndex(a => a.textbook_id === textbookId)
        const currentChapters = existingIdx >= 0 ? homeworkAssignments[existingIdx].chapters : []

        let newChapters: string[] = []

        // Shift + 클릭: 범위 선택
        if (e?.shiftKey && lastClicked[textbookId]) {
            const start = parseInt(lastClicked[textbookId])
            const end = parseInt(chapter)
            const [min, max] = [Math.min(start, end), Math.max(start, end)]
            
            // 범위 내 모든 단원 생성
            const rangeChapters = Array.from(
                { length: max - min + 1 },
                (_, i) => (min + i).toString()
            )
            
            // 기존 선택과 병합 (중복 제거)
            newChapters = [...new Set([...currentChapters, ...rangeChapters])]
                .sort((a, b) => parseInt(a) - parseInt(b))
        }
        // Ctrl + 클릭: 다중 선택 (토글)
        else if (e?.ctrlKey || e?.metaKey) {
            const isSelected = currentChapters.includes(chapter)
            newChapters = isSelected
                ? currentChapters.filter(c => c !== chapter)  // 해제
                : [...currentChapters, chapter].sort((a, b) => parseInt(a) - parseInt(b))  // 추가
            
            setLastClicked({ ...lastClicked, [textbookId]: chapter })
        }
        // 일반 클릭: 단일 토글
        else {
            const isSelected = currentChapters.includes(chapter)
            newChapters = isSelected
                ? currentChapters.filter(c => c !== chapter)
                : [...currentChapters, chapter].sort((a, b) => parseInt(a) - parseInt(b))
            
            setLastClicked({ ...lastClicked, [textbookId]: chapter })
        }

        // DB 업데이트
        const updated = [...homeworkAssignments]
        if (newChapters.length === 0) {
            // 모든 단원 제거 시 교재도 제거
            if (existingIdx >= 0) {
                updated.splice(existingIdx, 1)
            }
        } else {
            const newAssignment: HomeworkAssignmentItem = {
                textbook_id: textbookId,
                textbook_name: textbook.name,
                chapters: newChapters
            }
            
            if (existingIdx >= 0) {
                updated[existingIdx] = newAssignment
            } else {
                updated.push(newAssignment)
            }
        }

        setHomeworkAssignments(updated)
        updateTask(task.id, {
            homework_assignments: updated.length > 0 ? updated : undefined
        })
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
            '보충 수업을 추가할 시간을 시간표에서 클릭하세요.\n' +
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


    // 항상 화면 정중앙에 표시
    const style: React.CSSProperties = {
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)'
    }

    return (
        <>
            {/* 어두운 배경 오버레이 */}
            <div 
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200"
                onClick={onClose}
            />
            
            {/* 모달 */}
            <div
                ref={popoverRef}
                style={style}
                className="z-50 w-[900px] h-[700px] bg-white rounded-xl shadow-2xl border-2 border-gray-300 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
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
            <div className="p-4 space-y-5 flex-1 flex flex-col overflow-auto">
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
                                                // 해당 수업으로 전환
                                                if (onNavigateToTask) {
                                                    onNavigateToTask(lessonOnThisDay)
                                                }
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

                        {/* 시간 수정 UI - 즉시 편집 */}
                        {startTime && (
                            <div className="flex items-center gap-2 p-1.5 bg-gray-50 rounded-lg mt-1">
                                <Calendar size={12} className="text-gray-500" />
                                <span className="text-[10px] text-gray-600">
                                    {format(new Date(startTime), 'M/d (E)', { locale: ko })}
                                </span>
                                
                                <Clock size={12} className="text-gray-500 ml-1" />
                                
                                {/* 시간 선택 - 즉시 편집 모드 */}
                                <select 
                                    value={new Date(startTime).getHours()}
                                    onChange={(e) => {
                                        const newHour = Number(e.target.value)
                                        const newDate = new Date(startTime)
                                        newDate.setHours(newHour)
                                        const newIso = newDate.toISOString()
                                        setStartTime(newIso)  // 즉시 UI 업데이트!
                                        updateTask(task.id, { start_time: newIso })  // 백그라운드 저장
                                    }}
                                    className="text-xs px-1 py-0.5 border border-gray-300 rounded bg-white font-medium hover:border-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                >
                                    {Array.from({length: 24}, (_, i) => (
                                        <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                                    ))}
                                </select>
                                
                                <span className="text-xs text-gray-500">:</span>
                                
                                {/* 분 선택 - 10분 단위, 즉시 편집 모드 */}
                                <select 
                                    value={Math.floor(new Date(startTime).getMinutes() / 10) * 10}
                                    onChange={(e) => {
                                        const newMinute = Number(e.target.value)
                                        const newDate = new Date(startTime)
                                        newDate.setMinutes(newMinute)
                                        const newIso = newDate.toISOString()
                                        setStartTime(newIso)  // 즉시 UI 업데이트!
                                        updateTask(task.id, { start_time: newIso })  // 백그라운드 저장
                                    }}
                                    className="text-xs px-1 py-0.5 border border-gray-300 rounded bg-white font-medium hover:border-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                >
                                    {[0, 10, 20, 30, 40, 50].map(m => (
                                        <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                )}


                {/* Memo - 체크리스트 지원 메모 */}
                {!isStudentLesson && (
                    <div className="flex-1 flex flex-col min-h-0">
                        <ChecklistMemo
                            value={description}
                            onChange={setDescription}
                            onSave={(val) => updateTask(task.id, { description: val })}
                            placeholder="메모 입력... ([] 로 체크리스트 생성)"
                            className="flex-1"
                        />
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
                                        const selectedChapters = assignment?.chapters || []
                                        const page = currentPages[textbookId] || 0

                                        return (
                                            <ChapterGrid
                                                key={textbookId}
                                                textbook={textbook}
                                                selectedChapters={selectedChapters}
                                                page={page}
                                                onPageChange={(p) => handlePageChange(textbookId, p)}
                                                onToggle={toggleAssignmentChapter}
                                            />
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
                                                onClick={async () => {
                                                    // toggleTaskStatus가 있으면 사용, 없으면 updateTask 직접 사용
                                                    if (toggleTaskStatus) {
                                                        toggleTaskStatus(memo.id, memo.status)
                                                    } else {
                                                        const newStatus = memo.status === 'completed' ? 'inbox' : 'completed'
                                                        await updateTask(memo.id, { status: newStatus })
                                                    }
                                                }}
                                                className={`mt-0.5 w-3 h-3 rounded border flex-shrink-0 transition-colors ${
                                                    memo.status === 'completed'
                                                        ? 'bg-blue-500 border-blue-500'
                                                        : 'border-gray-300 hover:border-blue-400'
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
                {/* 왼쪽: 삭제 버튼 */}
                <button
                    onClick={() => {
                        if (confirm('이 태스크를 삭제하시겠습니까?')) {
                            deleteTask(task.id)
                            onClose()
                        }
                    }}
                    className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
                >
                    🗑️ 삭제
                </button>

                {/* 중앙: 수정 시간 + 시계 아이콘 (일반 태스크용) */}
                {!isStudentLesson && (
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                        {/* 최종 수정 시간 */}
                        <span>
                            수정: {format(new Date(task.updated_at), 'M/d HH:mm', { locale: ko })}
                        </span>
                        
                        {/* 시계 아이콘 + 드롭다운 */}
                        <div className="relative">
                            <button
                                onClick={() => setShowTimeDropdown(!showTimeDropdown)}
                                className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                                    startTime 
                                        ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' 
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                                title={startTime ? '시간표 설정됨' : '시간표에 추가'}
                            >
                                <Clock size={14} />
                                {startTime && (
                                    <span className="text-[10px] font-medium">
                                        {format(new Date(startTime), 'HH:mm')}
                                    </span>
                                )}
                            </button>
                            
                            {/* 시간 설정 드롭다운 */}
                            {showTimeDropdown && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 p-3 min-w-[180px] z-50">
                                    <div className="space-y-3">
                                        {/* 날짜 선택 */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-500">📅 날짜</span>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => moveWeek('prev')}
                                                    className="p-0.5 hover:bg-gray-100 rounded text-gray-400"
                                                >
                                                    <ChevronLeft size={12} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const today = new Date()
                                                        handleDateSelect(today)
                                                    }}
                                                    className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-xs font-medium text-gray-700"
                                                >
                                                    {startTime 
                                                        ? format(new Date(startTime), 'M/d (E)', { locale: ko })
                                                        : '오늘'}
                                                </button>
                                                <button
                                                    onClick={() => moveWeek('next')}
                                                    className="p-0.5 hover:bg-gray-100 rounded text-gray-400"
                                                >
                                                    <ChevronRight size={12} />
                                                </button>
                                            </div>
                                        </div>
                                        
                                        {/* 시작 시간 */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-500">⏰ 시작</span>
                                            <div className="flex items-center gap-1">
                                                <select
                                                    value={currentHour}
                                                    onChange={(e) => updateTime(Number(e.target.value), roundedMinute)}
                                                    className="px-1 py-0.5 bg-gray-100 rounded text-xs font-medium text-gray-700 focus:outline-none"
                                                >
                                                    {Array.from({ length: 24 }, (_, i) => (
                                                        <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                                                    ))}
                                                </select>
                                                <span className="text-gray-400">:</span>
                                                <select
                                                    value={roundedMinute}
                                                    onChange={(e) => updateTime(currentHour, Number(e.target.value))}
                                                    className="px-1 py-0.5 bg-gray-100 rounded text-xs font-medium text-gray-700 focus:outline-none"
                                                >
                                                    {[0, 10, 20, 30, 40, 50].map((m) => (
                                                        <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        
                                        {/* 지속 시간 */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-500">⏱️ 기간</span>
                                            <select
                                                value={duration}
                                                onChange={(e) => {
                                                    const val = Number(e.target.value)
                                                    setDuration(val)
                                                    updateTask(task.id, { duration: val })
                                                }}
                                                className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium text-gray-700 focus:outline-none"
                                            >
                                                {[10, 20, 30, 40, 50, 60, 90, 120].map(min => (
                                                    <option key={min} value={min}>{min}분</option>
                                                ))}
                                            </select>
                                        </div>
                                        
                                        {/* 시간 제거 버튼 */}
                                        {startTime && (
                                            <button
                                                onClick={() => {
                                                    setStartTime('')
                                                    updateTask(task.id, { start_time: null, status: 'inbox' })
                                                    setShowTimeDropdown(false)
                                                }}
                                                className="w-full text-xs text-red-500 hover:text-red-600 py-1"
                                            >
                                                시간표에서 제거
                                            </button>
                                        )}
                                    </div>
                                    
                                    {/* 화살표 */}
                                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-gray-200 rotate-45" />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 오른쪽: 버튼 그룹 */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        닫기
                    </button>
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                        저장
                    </button>
                </div>
            </div>
        </div>
        </>
    )
}
