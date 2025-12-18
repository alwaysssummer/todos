'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Routine, RoutineLog, RoutineStats, RoutineCalendarLog, RoutineRecentNote } from '@/types/database'
import { getKoreanToday } from '@/utils/dateUtils'

export function useRoutines() {
  const [routines, setRoutines] = useState<Routine[]>([])
  const [todayLogs, setTodayLogs] = useState<RoutineLog[]>([])
  const [weekLogs, setWeekLogs] = useState<RoutineLog[]>([])  // 주간 로그
  const [loading, setLoading] = useState(true)

  // 오늘 날짜 (YYYY-MM-DD) - 한국 시간 기준
  const today = useMemo(() => {
    const now = getKoreanToday()
    return now.toISOString().split('T')[0]
  }, [])

  // 오늘 요일 (0=일, 1=월, ... 6=토) - 한국 시간 기준
  const todayDayOfWeek = useMemo(() => {
    return getKoreanToday().getDay()
  }, [])

  // ===== 루틴 조회 =====
  const fetchRoutines = useCallback(async () => {
    const { data, error } = await supabase
      .from('routines')
      .select('*')
      .eq('is_active', true)
      .order('order_index', { ascending: true })

    if (error) {
      console.error('❌ 루틴 조회 에러:', error.message)
    } else if (data) {
      setRoutines(data)
    }
  }, [])

  // ===== 오늘 로그 조회 =====
  const fetchTodayLogs = useCallback(async () => {
    const { data, error } = await supabase
      .from('routine_logs')
      .select('*')
      .eq('date', today)

    if (error) {
      console.error('❌ 오늘 로그 조회 에러:', error.message)
    } else if (data) {
      setTodayLogs(data)
    }
  }, [today])

  // ===== 주간 로그 조회 =====
  const fetchWeekLogs = useCallback(async (startDate: string, endDate: string) => {
    const { data, error } = await supabase
      .from('routine_logs')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)

    if (error) {
      console.error('❌ 주간 로그 조회 에러:', error.message)
    } else if (data) {
      setWeekLogs(data)
    }
  }, [])

  // ===== 초기 로드 =====
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchRoutines(), fetchTodayLogs()])
      setLoading(false)
    }
    loadData()
  }, [fetchRoutines, fetchTodayLogs])

  // ===== 오늘 표시할 루틴 (요일 필터) =====
  const todayRoutines = useMemo(() => {
    return routines.filter(r => r.repeat_days.includes(todayDayOfWeek))
  }, [routines, todayDayOfWeek])

  // ===== 루틴별 오늘 완료 여부 =====
  const getRoutineCompleted = useCallback((routineId: string): boolean => {
    const log = todayLogs.find(l => l.routine_id === routineId)
    return log?.is_completed ?? false
  }, [todayLogs])

  // ===== 루틴별 특정 날짜 완료 여부 =====
  const getRoutineCompletedByDate = useCallback((routineId: string, dateStr: string): boolean => {
    const log = weekLogs.find(l => l.routine_id === routineId && l.date === dateStr)
    return log?.is_completed ?? false
  }, [weekLogs])

  // ===== 루틴별 오늘 메모 =====
  const getRoutineNote = useCallback((routineId: string): string => {
    const log = todayLogs.find(l => l.routine_id === routineId)
    return log?.note ?? ''
  }, [todayLogs])

  // ===== 루틴 생성 =====
  const createRoutine = useCallback(async (
    title: string,
    repeatDays: number[] = [0, 1, 2, 3, 4, 5, 6],
    targetTime?: string
  ): Promise<boolean> => {
    const maxOrder = routines.length > 0 
      ? Math.max(...routines.map(r => r.order_index)) + 1 
      : 0

    const { error } = await supabase
      .from('routines')
      .insert({
        title,
        repeat_days: repeatDays,
        target_time: targetTime || null,
        is_active: true,
        order_index: maxOrder
      })

    if (error) {
      console.error('❌ 루틴 생성 에러:', error.message)
      alert('루틴 생성 실패: ' + error.message)
      return false
    }

    await fetchRoutines()
    return true
  }, [routines, fetchRoutines])

  // ===== 루틴 수정 =====
  const updateRoutine = useCallback(async (
    id: string,
    updates: Partial<Pick<Routine, 'title' | 'repeat_days' | 'target_time' | 'is_active'>>
  ): Promise<boolean> => {
    const { error } = await supabase
      .from('routines')
      .update(updates)
      .eq('id', id)

    if (error) {
      console.error('❌ 루틴 수정 에러:', error.message)
      return false
    }

    await fetchRoutines()
    return true
  }, [fetchRoutines])

  // ===== 루틴 삭제 =====
  const deleteRoutine = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('routines')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('❌ 루틴 삭제 에러:', error.message)
      return false
    }

    await fetchRoutines()
    return true
  }, [fetchRoutines])

  // ===== 루틴 순서 변경 =====
  const reorderRoutines = useCallback(async (reorderedRoutines: Routine[]): Promise<boolean> => {
    // 낙관적 업데이트
    setRoutines(reorderedRoutines)

    const updates = reorderedRoutines.map((r, index) => ({
      id: r.id,
      order_index: index
    }))

    for (const update of updates) {
      const { error } = await supabase
        .from('routines')
        .update({ order_index: update.order_index })
        .eq('id', update.id)

      if (error) {
        console.error('❌ 순서 변경 에러:', error.message)
        await fetchRoutines() // 롤백
        return false
      }
    }

    return true
  }, [fetchRoutines])

  // ===== 체크 토글 =====
  const toggleComplete = useCallback(async (routineId: string): Promise<boolean> => {
    const existingLog = todayLogs.find(l => l.routine_id === routineId)
    
    if (existingLog) {
      // 기존 로그 업데이트
      const newCompleted = !existingLog.is_completed
      const { error } = await supabase
        .from('routine_logs')
        .update({
          is_completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null
        })
        .eq('id', existingLog.id)

      if (error) {
        console.error('❌ 체크 토글 에러:', error.message)
        return false
      }
    } else {
      // 새 로그 생성 (체크됨)
      const { error } = await supabase
        .from('routine_logs')
        .insert({
          routine_id: routineId,
          date: today,
          is_completed: true,
          completed_at: new Date().toISOString()
        })

      if (error) {
        console.error('❌ 로그 생성 에러:', error.message)
        return false
      }
    }

    await fetchTodayLogs()
    return true
  }, [todayLogs, today, fetchTodayLogs])

  // ===== 특정 날짜 체크 토글 =====
  const toggleCompleteByDate = useCallback(async (routineId: string, dateStr: string, weekStart: string, weekEnd: string): Promise<boolean> => {
    const existingLog = weekLogs.find(l => l.routine_id === routineId && l.date === dateStr)
    
    if (existingLog) {
      // 기존 로그 업데이트
      const newCompleted = !existingLog.is_completed
      const { error } = await supabase
        .from('routine_logs')
        .update({
          is_completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null
        })
        .eq('id', existingLog.id)

      if (error) {
        console.error('❌ 체크 토글 에러:', error.message)
        return false
      }
    } else {
      // 새 로그 생성 (체크됨)
      const { error } = await supabase
        .from('routine_logs')
        .insert({
          routine_id: routineId,
          date: dateStr,
          is_completed: true,
          completed_at: new Date().toISOString()
        })

      if (error) {
        console.error('❌ 로그 생성 에러:', error.message)
        return false
      }
    }

    // 주간 로그 다시 조회
    await fetchWeekLogs(weekStart, weekEnd)
    // 오늘 날짜면 todayLogs도 업데이트
    if (dateStr === today) {
      await fetchTodayLogs()
    }
    return true
  }, [weekLogs, today, fetchWeekLogs, fetchTodayLogs])

  // ===== 메모 저장 =====
  const saveNote = useCallback(async (routineId: string, note: string): Promise<boolean> => {
    const existingLog = todayLogs.find(l => l.routine_id === routineId)
    
    if (existingLog) {
      // 기존 로그 업데이트
      const { error } = await supabase
        .from('routine_logs')
        .update({ note })
        .eq('id', existingLog.id)

      if (error) {
        console.error('❌ 메모 저장 에러:', error.message)
        return false
      }
    } else {
      // 새 로그 생성 (메모만)
      const { error } = await supabase
        .from('routine_logs')
        .insert({
          routine_id: routineId,
          date: today,
          is_completed: false,
          note
        })

      if (error) {
        console.error('❌ 메모 로그 생성 에러:', error.message)
        return false
      }
    }

    await fetchTodayLogs()
    return true
  }, [todayLogs, today, fetchTodayLogs])

  // ===== 통계 조회 =====
  const getStats = useCallback(async (routineId: string): Promise<RoutineStats | null> => {
    const { data: logs, error } = await supabase
      .from('routine_logs')
      .select('*')
      .eq('routine_id', routineId)
      .eq('is_completed', true)
      .order('date', { ascending: false })

    if (error) {
      console.error('❌ 통계 조회 에러:', error.message)
      return null
    }

    const now = getKoreanToday()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay()) // 이번 주 일요일
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const weekLogs = logs.filter(l => new Date(l.date) >= weekStart)
    const monthLogs = logs.filter(l => new Date(l.date) >= monthStart)

    // 이번 주/달 총 일수 계산
    const routine = routines.find(r => r.id === routineId)
    const repeatDays = routine?.repeat_days || [0, 1, 2, 3, 4, 5, 6]
    
    let weekTotal = 0
    let monthTotal = 0
    
    for (let d = new Date(weekStart); d <= now; d.setDate(d.getDate() + 1)) {
      if (repeatDays.includes(d.getDay())) weekTotal++
    }
    
    for (let d = new Date(monthStart); d <= now; d.setDate(d.getDate() + 1)) {
      if (repeatDays.includes(d.getDay())) monthTotal++
    }

    // 연속 달성일 계산 (현재 스트릭 + 최장 스트릭)
    const sortedDates = logs.map(l => l.date).sort()
    let streak = 0
    let bestStreak = 0
    let currentStreak = 0
    
    // 최장 스트릭 계산
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) {
        currentStreak = 1
      } else {
        const prevDate = new Date(sortedDates[i - 1])
        const currDate = new Date(sortedDates[i])
        
        // 연속 요일 체크 (반복 요일 고려)
        let expectedNext = new Date(prevDate)
        let found = false
        for (let j = 1; j <= 7; j++) {
          expectedNext.setDate(prevDate.getDate() + j)
          if (repeatDays.includes(expectedNext.getDay())) {
            if (expectedNext.toISOString().split('T')[0] === currDate.toISOString().split('T')[0]) {
              found = true
            }
            break
          }
        }
        
        if (found) {
          currentStreak++
        } else {
          currentStreak = 1
        }
      }
      bestStreak = Math.max(bestStreak, currentStreak)
    }
    
    // 현재 스트릭 계산 (오늘부터 역순)
    const sortedDatesReverse = [...sortedDates].reverse()
    for (let i = 0; i < sortedDatesReverse.length; i++) {
      const logDate = new Date(sortedDatesReverse[i])
      logDate.setHours(0, 0, 0, 0)
      
      // 예상 날짜 계산 (반복 요일 고려)
      let expectedDate = new Date(now)
      expectedDate.setHours(0, 0, 0, 0)
      let skipDays = 0
      
      for (let j = 0; j < i; j++) {
        expectedDate.setDate(expectedDate.getDate() - 1)
        while (!repeatDays.includes(expectedDate.getDay())) {
          expectedDate.setDate(expectedDate.getDate() - 1)
        }
      }
      
      // 오늘이 반복 요일이 아니면 어제부터 체크
      if (!repeatDays.includes(now.getDay()) && i === 0) {
        expectedDate.setDate(expectedDate.getDate() - 1)
        while (!repeatDays.includes(expectedDate.getDay())) {
          expectedDate.setDate(expectedDate.getDate() - 1)
        }
      }
      
      if (logDate.getTime() === expectedDate.getTime()) {
        streak++
      } else if (i === 0) {
        // 오늘/어제 완료 안했으면 스트릭 0
        break
      } else {
        break
      }
    }

    // 전체 달성률 계산
    const firstCompleted = sortedDates[0]
    let totalDays = 0
    if (firstCompleted) {
      const startDate = new Date(firstCompleted)
      for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
        if (repeatDays.includes(d.getDay())) totalDays++
      }
    }
    const totalRate = totalDays > 0 ? Math.round((logs.length / totalDays) * 100) : 0

    // 평균 완료 시간 계산
    const completionTimes = logs
      .filter(l => l.completed_at)
      .map(l => {
        const date = new Date(l.completed_at!)
        return date.getHours() * 60 + date.getMinutes()
      })
    
    let avgCompletionTime: string | undefined
    if (completionTimes.length > 0) {
      const avgMinutes = Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length)
      const hours = Math.floor(avgMinutes / 60)
      const mins = avgMinutes % 60
      avgCompletionTime = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
    }

    return {
      routine_id: routineId,
      total_count: logs.length,
      week_count: weekLogs.length,
      week_total: weekTotal,
      month_count: monthLogs.length,
      month_total: monthTotal,
      streak,
      last_completed: logs[0]?.date,
      best_streak: bestStreak,
      total_rate: totalRate,
      avg_completion_time: avgCompletionTime,
      first_completed: firstCompleted
    }
  }, [routines])

  // ===== 달력용 로그 조회 =====
  const getCalendarLogs = useCallback(async (
    routineId: string,
    year: number,
    month: number
  ): Promise<RoutineCalendarLog[]> => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`
    
    const { data, error } = await supabase
      .from('routine_logs')
      .select('date, is_completed, note, completed_at')
      .eq('routine_id', routineId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })

    if (error) {
      console.error('❌ 달력 로그 조회 에러:', error.message)
      return []
    }

    return data || []
  }, [])

  // ===== 최근 메모 조회 =====
  const getRecentNotes = useCallback(async (
    routineId: string,
    limit: number = 5
  ): Promise<RoutineRecentNote[]> => {
    const { data, error } = await supabase
      .from('routine_logs')
      .select('date, note')
      .eq('routine_id', routineId)
      .not('note', 'is', null)
      .neq('note', '')
      .order('date', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('❌ 최근 메모 조회 에러:', error.message)
      return []
    }

    return (data || []).map(d => ({ date: d.date, note: d.note! }))
  }, [])

  return {
    routines,
    todayRoutines,
    todayLogs,
    weekLogs,
    loading,
    today,
    getRoutineCompleted,
    getRoutineCompletedByDate,
    getRoutineNote,
    createRoutine,
    updateRoutine,
    deleteRoutine,
    reorderRoutines,
    toggleComplete,
    toggleCompleteByDate,
    fetchWeekLogs,
    saveNote,
    getStats,
    getCalendarLogs,
    getRecentNotes,
    refresh: async () => {
      await Promise.all([fetchRoutines(), fetchTodayLogs()])
    }
  }
}


