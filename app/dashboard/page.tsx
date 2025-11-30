'use client'

import { useState, useEffect } from 'react'
import { format, parseISO, addDays, isBefore, isAfter } from 'date-fns'
import { ko } from 'date-fns/locale'
import { BookOpen, Users, TrendingUp, Calendar, ExternalLink, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Project, Task, Textbook, HomeworkCheckItem } from '@/types/database'

interface StudentWithProgress {
    student: Project
    textbooks: Textbook[]
    totalProgress: number
    completedLessons: number
    nextLesson?: { date: Date; time: string }
    progressByTextbook: {
        textbook: Textbook
        completed: number
        total: number
        percent: number
    }[]
}

export default function DashboardPage() {
    const [students, setStudents] = useState<StudentWithProgress[]>([])
    const [textbooks, setTextbooks] = useState<Textbook[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState<'name' | 'progress' | 'lessons'>('name')
    const [sortDesc, setSortDesc] = useState(false)
    const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set())

    useEffect(() => {
        loadDashboardData()
    }, [])

    const loadDashboardData = async () => {
        try {
            setLoading(true)

            // 1. 모든 학생(student 타입 프로젝트) 조회
            const { data: projectsData, error: projectsError } = await supabase
                .from('projects')
                .select('*')
                .eq('type', 'student')
                .eq('status', 'active')
                .order('name')

            if (projectsError) throw projectsError

            // 2. 모든 교재 조회
            const { data: textbooksData, error: textbooksError } = await supabase
                .from('textbooks')
                .select('*')

            if (textbooksError) throw textbooksError
            setTextbooks(textbooksData || [])

            // 3. 모든 수업(task) 조회
            const { data: lessonsData, error: lessonsError } = await supabase
                .from('tasks')
                .select('*')
                .eq('is_auto_generated', true)

            if (lessonsError) throw lessonsError

            // 4. 각 학생별 진도 계산
            const studentsWithProgress: StudentWithProgress[] = (projectsData || []).map(student => {
                const studentLessons = (lessonsData || []).filter(l => l.project_id === student.id)
                const completedLessons = studentLessons.filter(l => 
                    l.status === 'completed' || 
                    (l.homework_checks && l.homework_checks.length > 0)
                ).length

                // 배정된 교재들
                const studentTextbooks = (textbooksData || []).filter(tb => 
                    student.textbooks?.includes(tb.id)
                )

                // 교재별 진도 계산
                const progressMap: Record<string, Set<number>> = {}
                student.textbooks?.forEach((id: string) => progressMap[id] = new Set())

                studentLessons.forEach(lesson => {
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

                const progressByTextbook = studentTextbooks.map(tb => ({
                    textbook: tb,
                    completed: progressMap[tb.id]?.size || 0,
                    total: tb.total_chapters,
                    percent: Math.round(((progressMap[tb.id]?.size || 0) / tb.total_chapters) * 100)
                }))

                // 전체 진도율 (모든 교재 평균)
                const totalProgress = progressByTextbook.length > 0
                    ? Math.round(progressByTextbook.reduce((sum, p) => sum + p.percent, 0) / progressByTextbook.length)
                    : 0

                // 다음 수업 계산
                let nextLesson: { date: Date; time: string } | undefined
                if (student.schedule_template && student.schedule_template.length > 0) {
                    const today = new Date()
                    const endDate = student.end_date ? parseISO(student.end_date) : addDays(today, 30)

                    for (let i = 0; i < 14; i++) {
                        const checkDate = addDays(today, i)
                        if (student.end_date && isAfter(checkDate, endDate)) break

                        const dayOfWeek = checkDate.getDay()
                        const matchingSchedule = student.schedule_template.find((s: any) => s.day === dayOfWeek)

                        if (matchingSchedule) {
                            if (i === 0) {
                                const [hours, minutes] = matchingSchedule.time.split(':').map(Number)
                                const lessonTime = new Date(checkDate)
                                lessonTime.setHours(hours, minutes, 0, 0)
                                if (isBefore(lessonTime, today)) continue
                            }
                            nextLesson = { date: checkDate, time: matchingSchedule.time }
                            break
                        }
                    }
                }

                return {
                    student,
                    textbooks: studentTextbooks,
                    totalProgress,
                    completedLessons,
                    nextLesson,
                    progressByTextbook
                }
            })

            setStudents(studentsWithProgress)
        } catch (error) {
            console.error('Error loading dashboard:', error)
        } finally {
            setLoading(false)
        }
    }

    const toggleExpand = (studentId: string) => {
        setExpandedStudents(prev => {
            const next = new Set(prev)
            if (next.has(studentId)) {
                next.delete(studentId)
            } else {
                next.add(studentId)
            }
            return next
        })
    }

    // 필터링 & 정렬
    const filteredStudents = students
        .filter(s => s.student.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            let compare = 0
            switch (sortBy) {
                case 'name':
                    compare = a.student.name.localeCompare(b.student.name)
                    break
                case 'progress':
                    compare = a.totalProgress - b.totalProgress
                    break
                case 'lessons':
                    compare = a.completedLessons - b.completedLessons
                    break
            }
            return sortDesc ? -compare : compare
        })

    const handleSort = (by: typeof sortBy) => {
        if (sortBy === by) {
            setSortDesc(!sortDesc)
        } else {
            setSortBy(by)
            setSortDesc(false)
        }
    }

    // 전체 통계
    const totalStudents = students.length
    const avgProgress = students.length > 0
        ? Math.round(students.reduce((sum, s) => sum + s.totalProgress, 0) / students.length)
        : 0
    const totalCompletedLessons = students.reduce((sum, s) => sum + s.completedLessons, 0)

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">대시보드를 불러오는 중...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-100 py-8 px-4">
            <div className="max-w-6xl mx-auto">
                {/* 헤더 */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">📊 학생 학습 현황</h1>
                    <p className="text-gray-600">전체 학생들의 학습 진도를 한눈에 확인하세요</p>
                </div>

                {/* 전체 통계 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white rounded-xl shadow p-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                <Users size={24} className="text-blue-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-gray-900">{totalStudents}</div>
                                <div className="text-sm text-gray-500">전체 학생</div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow p-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                                <TrendingUp size={24} className="text-green-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-gray-900">{avgProgress}%</div>
                                <div className="text-sm text-gray-500">평균 진도율</div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow p-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                                <Calendar size={24} className="text-purple-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-gray-900">{totalCompletedLessons}</div>
                                <div className="text-sm text-gray-500">총 완료 수업</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 검색 & 정렬 */}
                <div className="bg-white rounded-xl shadow p-4 mb-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="학생 이름 검색..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleSort('name')}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    sortBy === 'name' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                이름순 {sortBy === 'name' && (sortDesc ? '↓' : '↑')}
                            </button>
                            <button
                                onClick={() => handleSort('progress')}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    sortBy === 'progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                진도순 {sortBy === 'progress' && (sortDesc ? '↓' : '↑')}
                            </button>
                            <button
                                onClick={() => handleSort('lessons')}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    sortBy === 'lessons' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                수업순 {sortBy === 'lessons' && (sortDesc ? '↓' : '↑')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* 학생 목록 */}
                <div className="space-y-4">
                    {filteredStudents.length === 0 ? (
                        <div className="bg-white rounded-xl shadow p-12 text-center">
                            <Users size={48} className="mx-auto mb-4 text-gray-300" />
                            <p className="text-gray-500">
                                {searchQuery ? '검색 결과가 없습니다' : '등록된 학생이 없습니다'}
                            </p>
                        </div>
                    ) : (
                        filteredStudents.map(({ student, textbooks, totalProgress, completedLessons, nextLesson, progressByTextbook }) => (
                            <div key={student.id} className="bg-white rounded-xl shadow overflow-hidden">
                                {/* 학생 헤더 */}
                                <div 
                                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                                    onClick={() => toggleExpand(student.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div 
                                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                                            style={{ backgroundColor: student.color }}
                                        >
                                            {student.name.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-900">{student.name}</span>
                                                <a
                                                    href={`/student/${student.id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={e => e.stopPropagation()}
                                                    className="p-1 text-gray-400 hover:text-blue-500"
                                                    title="학생 페이지 열기"
                                                >
                                                    <ExternalLink size={14} />
                                                </a>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-gray-500">
                                                <span>📚 {textbooks.length}개 교재</span>
                                                <span>✅ {completedLessons}회 수업</span>
                                                {nextLesson && (
                                                    <span>📅 다음: {format(nextLesson.date, 'M/d')} {nextLesson.time}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <div className="text-xl font-bold text-blue-600">{totalProgress}%</div>
                                                <div className="text-xs text-gray-500">전체 진도</div>
                                            </div>
                                            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                                                    style={{ width: `${totalProgress}%` }}
                                                />
                                            </div>
                                            {expandedStudents.has(student.id) ? (
                                                <ChevronUp size={20} className="text-gray-400" />
                                            ) : (
                                                <ChevronDown size={20} className="text-gray-400" />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* 상세 진도 (펼쳐진 경우) */}
                                {expandedStudents.has(student.id) && progressByTextbook.length > 0 && (
                                    <div className="px-4 pb-4 border-t border-gray-100">
                                        <div className="pt-4 space-y-3">
                                            {progressByTextbook.map(p => (
                                                <div key={p.textbook.id} className="flex items-center gap-4">
                                                    <div className="w-40 truncate text-sm text-gray-700">
                                                        {p.textbook.name}
                                                    </div>
                                                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-green-500 rounded-full"
                                                            style={{ width: `${p.percent}%` }}
                                                        />
                                                    </div>
                                                    <div className="w-24 text-right text-sm">
                                                        <span className="font-medium text-gray-700">{p.completed}/{p.total}</span>
                                                        <span className="text-gray-400 ml-1">({p.percent}%)</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* 푸터 */}
                <div className="text-center mt-8 text-sm text-gray-400">
                    마지막 업데이트: {format(new Date(), 'yyyy.M.d HH:mm')}
                </div>
            </div>
        </div>
    )
}

