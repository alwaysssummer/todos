'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { format, parseISO, isBefore, isAfter, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { BookOpen, Calendar, Clock, CheckCircle, User, Share2, Copy, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Project, Task, Textbook, HomeworkCheckItem } from '@/types/database'

interface StudentProgress {
    textbook: Textbook
    completedChapters: number[]
    totalChapters: number
    progressPercent: number
    lastCompletedChapter: number
}

interface UpcomingLesson {
    date: Date
    time: string
    duration: number
}

export default function StudentDashboard() {
    const params = useParams()
    const studentId = params.id as string

    const [student, setStudent] = useState<Project | null>(null)
    const [textbooks, setTextbooks] = useState<Textbook[]>([])
    const [progress, setProgress] = useState<StudentProgress[]>([])
    const [upcomingLessons, setUpcomingLessons] = useState<UpcomingLesson[]>([])
    const [totalLessons, setTotalLessons] = useState(0)
    const [completedLessons, setCompletedLessons] = useState(0)
    const [loading, setLoading] = useState(true)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        if (studentId) {
            loadStudentData()
        }
    }, [studentId])

    const loadStudentData = async () => {
        try {
            setLoading(true)

            // 1. 학생 정보 조회
            const { data: studentData, error: studentError } = await supabase
                .from('projects')
                .select('*')
                .eq('id', studentId)
                .single()

            if (studentError) throw studentError
            setStudent(studentData)

            // 2. 배정된 교재 조회
            if (studentData.textbooks && studentData.textbooks.length > 0) {
                const { data: textbookData, error: textbookError } = await supabase
                    .from('textbooks')
                    .select('*')
                    .in('id', studentData.textbooks)

                if (!textbookError && textbookData) {
                    setTextbooks(textbookData)
                }
            }

            // 3. 수업 이력 조회 (진도 계산용)
            const { data: lessonsData, error: lessonsError } = await supabase
                .from('tasks')
                .select('*')
                .eq('project_id', studentId)
                .eq('is_auto_generated', true)
                .order('start_time', { ascending: false })

            if (!lessonsError && lessonsData) {
                // 완료된 수업 수 계산
                const completed = lessonsData.filter(l => 
                    l.status === 'completed' || 
                    (l.homework_checks && l.homework_checks.length > 0)
                ).length
                setCompletedLessons(completed)
                setTotalLessons(lessonsData.length)

                // 진도 계산
                calculateProgress(lessonsData, studentData.textbooks || [])
            }

            // 4. 다음 수업 일정 계산
            calculateUpcomingLessons(studentData)

        } catch (error) {
            console.error('Error loading student data:', error)
        } finally {
            setLoading(false)
        }
    }

    const calculateProgress = async (lessons: Task[], textbookIds: string[]) => {
        if (textbookIds.length === 0) return

        // 교재 정보 조회
        const { data: textbookData } = await supabase
            .from('textbooks')
            .select('*')
            .in('id', textbookIds)

        if (!textbookData) return

        // 각 교재별 완료된 단원 수집
        const progressMap: Record<string, Set<number>> = {}
        textbookIds.forEach(id => progressMap[id] = new Set())

        lessons.forEach(lesson => {
            if (lesson.homework_checks) {
                lesson.homework_checks.forEach((check: HomeworkCheckItem) => {
                    if (check.is_completed && progressMap[check.textbook_id]) {
                        const chapterNum = parseInt(check.chapter)
                        if (!isNaN(chapterNum)) {
                            progressMap[check.textbook_id].add(chapterNum)
                        }
                    }
                })
            }
        })

        // 진도 데이터 생성
        const progressData: StudentProgress[] = textbookData.map(tb => {
            const completed = Array.from(progressMap[tb.id] || [])
            const lastCompleted = completed.length > 0 ? Math.max(...completed) : 0
            return {
                textbook: tb,
                completedChapters: completed.sort((a, b) => a - b),
                totalChapters: tb.total_chapters,
                progressPercent: Math.round((completed.length / tb.total_chapters) * 100),
                lastCompletedChapter: lastCompleted
            }
        })

        setProgress(progressData)
    }

    const calculateUpcomingLessons = (studentData: Project) => {
        if (!studentData.schedule_template || studentData.schedule_template.length === 0) {
            setUpcomingLessons([])
            return
        }

        const upcoming: UpcomingLesson[] = []
        const today = new Date()
        const endDate = studentData.end_date ? parseISO(studentData.end_date) : addDays(today, 30)

        // 다음 4주간의 수업 일정 계산
        for (let i = 0; i < 28 && upcoming.length < 5; i++) {
            const checkDate = addDays(today, i)
            if (studentData.end_date && isAfter(checkDate, endDate)) break

            const dayOfWeek = checkDate.getDay()
            const matchingSchedule = studentData.schedule_template.find(s => s.day === dayOfWeek)

            if (matchingSchedule) {
                // 오늘인 경우 현재 시간 이후의 수업만
                if (i === 0) {
                    const [hours, minutes] = matchingSchedule.time.split(':').map(Number)
                    const lessonTime = new Date(checkDate)
                    lessonTime.setHours(hours, minutes, 0, 0)
                    if (isBefore(lessonTime, today)) continue
                }

                upcoming.push({
                    date: checkDate,
                    time: matchingSchedule.time,
                    duration: matchingSchedule.duration
                })
            }
        }

        setUpcomingLessons(upcoming)
    }

    const copyShareLink = () => {
        const url = window.location.href
        navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const getChapterUnit = (textbook: Textbook) => {
        if (textbook.chapter_unit === '직접입력') {
            return textbook.custom_chapter_unit || '강'
        }
        return textbook.chapter_unit
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">학습 현황을 불러오는 중...</p>
                </div>
            </div>
        )
    }

    if (!student) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center">
                    <User size={48} className="mx-auto mb-4 text-gray-400" />
                    <h2 className="text-xl font-bold text-gray-700 mb-2">학생을 찾을 수 없습니다</h2>
                    <p className="text-gray-500">올바른 링크인지 확인해주세요.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
            <div className="max-w-2xl mx-auto">
                {/* 헤더 */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div 
                                className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold"
                                style={{ backgroundColor: student.color }}
                            >
                                {student.name.charAt(0)}
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
                                <p className="text-gray-500 text-sm">학습 현황</p>
                            </div>
                        </div>
                        <button
                            onClick={copyShareLink}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-600 transition-colors"
                        >
                            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                            {copied ? '복사됨!' : '링크 복사'}
                        </button>
                    </div>

                    {/* 수업 통계 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 rounded-xl p-4 text-center">
                            <div className="text-3xl font-bold text-blue-600">{completedLessons}</div>
                            <div className="text-sm text-gray-600">완료 수업</div>
                        </div>
                        <div className="bg-green-50 rounded-xl p-4 text-center">
                            <div className="text-3xl font-bold text-green-600">{progress.length}</div>
                            <div className="text-sm text-gray-600">배정 교재</div>
                        </div>
                    </div>
                </div>

                {/* 교재별 진도 */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <BookOpen size={20} className="text-blue-600" />
                        교재별 학습 진도
                    </h2>

                    {progress.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            <BookOpen size={40} className="mx-auto mb-2 opacity-30" />
                            <p>배정된 교재가 없습니다</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {progress.map(p => (
                                <div key={p.textbook.id} className="border border-gray-200 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium text-gray-900">{p.textbook.name}</span>
                                        <span className="text-sm text-gray-500">
                                            {p.completedChapters.length}/{p.totalChapters}{getChapterUnit(p.textbook)}
                                        </span>
                                    </div>
                                    <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
                                        <div 
                                            className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                                            style={{ width: `${p.progressPercent}%` }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-xs text-gray-500">
                                            {p.lastCompletedChapter > 0 
                                                ? `최근 진행: ${p.lastCompletedChapter}${getChapterUnit(p.textbook)}`
                                                : '아직 시작 전'
                                            }
                                        </span>
                                        <span className="text-sm font-bold text-blue-600">{p.progressPercent}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 다음 수업 일정 - 미니 달력 */}
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Calendar size={20} className="text-green-600" />
                        수업 일정
                    </h2>

                    {/* 미니 달력 */}
                    {(() => {
                        const today = new Date()
                        const monthStart = startOfMonth(today)
                        const monthEnd = endOfMonth(today)
                        const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
                        const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
                        const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
                        const lessonDates = new Set(upcomingLessons.map(l => format(l.date, 'yyyy-MM-dd')))
                        const nextLesson = upcomingLessons[0]

                        return (
                            <div>
                                {/* 월 표시 */}
                                <div className="text-center mb-3">
                                    <span className="text-sm font-medium text-gray-700">
                                        {format(today, 'yyyy년 M월', { locale: ko })}
                                    </span>
                                </div>
                                
                                {/* 요일 헤더 */}
                                <div className="grid grid-cols-7 mb-1">
                                    {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                                        <div key={day} className={`text-center text-xs font-medium py-1 ${
                                            i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
                                        }`}>
                                            {day}
                                        </div>
                                    ))}
                                </div>
                                
                                {/* 날짜 그리드 */}
                                <div className="grid grid-cols-7 gap-1">
                                    {calendarDays.map((day, idx) => {
                                        const dateKey = format(day, 'yyyy-MM-dd')
                                        const hasLesson = lessonDates.has(dateKey)
                                        const isToday = isSameDay(day, today)
                                        const isCurrentMonth = isSameMonth(day, today)
                                        const isNextLesson = nextLesson && isSameDay(day, nextLesson.date)
                                        const dayOfWeek = day.getDay()

                                        return (
                                            <div
                                                key={idx}
                                                className={`
                                                    relative aspect-square flex items-center justify-center text-sm rounded-lg
                                                    ${!isCurrentMonth ? 'text-gray-300' : ''}
                                                    ${isCurrentMonth && dayOfWeek === 0 ? 'text-red-500' : ''}
                                                    ${isCurrentMonth && dayOfWeek === 6 ? 'text-blue-500' : ''}
                                                    ${isToday ? 'bg-gray-100 font-bold' : ''}
                                                    ${isNextLesson ? 'bg-green-500 text-white font-bold' : ''}
                                                    ${hasLesson && !isNextLesson ? 'bg-green-100 text-green-700 font-medium' : ''}
                                                `}
                                            >
                                                {format(day, 'd')}
                                                {hasLesson && !isNextLesson && (
                                                    <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-green-500 rounded-full" />
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* 다음 수업 정보 */}
                                {nextLesson && (
                                    <div className="mt-4 p-3 bg-green-50 rounded-xl border border-green-200">
                                        <div className="flex items-center gap-3">
                                            <div className="text-center">
                                                <div className="text-lg font-bold text-green-600">
                                                    {format(nextLesson.date, 'M/d')}
                                                </div>
                                                <div className="text-xs text-green-600">
                                                    {format(nextLesson.date, 'EEE', { locale: ko })}
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <Clock size={14} className="text-green-500" />
                                                    <span className="font-medium text-green-700">{nextLesson.time}</span>
                                                    <span className="text-xs text-green-500">({nextLesson.duration}분)</span>
                                                </div>
                                                <span className="text-xs text-green-600">다음 수업</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })()}

                    {/* 수업 기간 */}
                    {student.start_date && (
                        <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
                            <span>수업 기간: </span>
                            <span className="font-medium text-gray-700">
                                {format(parseISO(student.start_date), 'yyyy.M.d')}
                            </span>
                            <span> ~ </span>
                            <span className="font-medium text-gray-700">
                                {student.end_date 
                                    ? format(parseISO(student.end_date), 'yyyy.M.d')
                                    : '진행 중'
                                }
                            </span>
                        </div>
                    )}
                </div>

                {/* 푸터 */}
                <div className="text-center mt-8 text-sm text-gray-400">
                    학습 현황은 실시간으로 업데이트됩니다
                </div>
            </div>
        </div>
    )
}

