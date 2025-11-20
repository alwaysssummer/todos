import { supabase } from '@/lib/supabase'
import type { Project, Task } from '@/types/database'
import { addWeeks, startOfWeek, endOfWeek } from 'date-fns'

// 🔒 글로벌 락: 동시 실행 방지
const runningRequests = new Map<string, Promise<void>>()

export function useScheduleManager() {

  /**
   * [핵심 기능 1] 프로젝트 스케줄 동기화 (수정 시 사용)
   * - 미래의 "정규 수업"을 깨끗이 지우고, 템플릿대로 다시 깝니다.
   * - 과거, 취소, 완료, 보충 수업은 건드리지 않습니다.
   */
  const syncProjectSchedule = async (project: Project) => {
    if (!project.schedule_template || project.schedule_template.length === 0) return

    console.log(`🔄 [${project.name}] 스케줄 동기화 시작`)
    const now = new Date()

    try {
      // 1. 삭제 대상 선별 (Smart Cleanup)
      // 조건: 해당 프로젝트의 태스크 중
      // - 미래에 시작하고 (start_time > now)
      // - 완료되지 않았고 (status != completed)
      // - 취소되지 않았고 (status != cancelled)
      // - 보충 수업이 아닌 것 (is_makeup != true) -> 즉, "미래의 정규 수업"
      // * is_auto_generated 플래그에 의존하지 않고, 실제 데이터 성격으로 판단하여 찌꺼기 제거

      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, start_time, status, is_makeup')
        .eq('project_id', project.id)

      if (tasks) {
        const deleteIds = tasks.filter(t => {
          const tTime = new Date(t.start_time!)
          return (
            tTime > now &&
            t.status !== 'completed' &&
            t.status !== 'cancelled' &&
            !t.is_makeup
          )
        }).map(t => t.id)

        if (deleteIds.length > 0) {
          console.log(`🗑️ 미래 정규 수업 ${deleteIds.length}개 삭제`)
          await supabase.from('tasks').delete().in('id', deleteIds)
        }
      }

      // 2. 재생성 (향후 8주치 넉넉하게 생성)
      // 무한정 생성할 수 없으므로, 일단 수정 시점에는 8주치를 생성해두고
      // 이후는 달력 이동 시 ensureScheduleInRange가 책임짐
      const startDate = project.start_date ? new Date(project.start_date) : now
      const generateStart = startDate > now ? startDate : now
      const generateEnd = addWeeks(generateStart, 8) // 8주치 생성

      await generateScheduleInRange(project, generateStart, generateEnd)

      console.log(`✅ [${project.name}] 동기화 완료`)
    } catch (error) {
      console.error('스케줄 동기화 실패:', error)
      throw error
    }
  }

  /**
   * [핵심 기능 2] 구간 보장 (달력 이동 시 사용)
   * - 특정 기간(viewRange)을 보고, 비어있으면 채웁니다.
   * - 이미 있으면 건너뜁니다 (중복 방지).
   */
  const ensureScheduleInRange = async (projects: Project[], startDate: Date, endDate: Date) => {
    const studentProjects = projects.filter(p => p.type === 'student' && p.status === 'active')
    if (studentProjects.length === 0) return

    console.log(`🔎 기간 점검: ${startDate.toISOString().split('T')[0]} ~ ${endDate.toISOString().split('T')[0]}`)

    for (const project of studentProjects) {
      // 🔒 중복 요청 방지: 같은 프로젝트 + 기간이 이미 실행 중이면 대기
      const requestKey = `${project.id}-${startDate.toISOString()}-${endDate.toISOString()}`

      if (runningRequests.has(requestKey)) {
        console.log(`⏳ [${project.name}] 이미 처리 중 - 대기`)
        await runningRequests.get(requestKey)
        continue
      }

      // 새로운 요청 시작
      const promise = generateScheduleInRange(project, startDate, endDate)
      runningRequests.set(requestKey, promise)

      try {
        await promise
      } finally {
        runningRequests.delete(requestKey)
      }
    }
  }

  /**
   * [내부 함수] 실제 생성 로직 (순수 함수에 가깝게)
   * - 주어진 기간 내에 템플릿에 맞는 수업을 생성
   * - DB 중복 체크 포함
   */
  const generateScheduleInRange = async (project: Project, start: Date, end: Date) => {
    if (!project.schedule_template || project.schedule_template.length === 0) return

    // 1. 이 기간에 이미 존재하는 태스크 조회 (중복 방지용)
    const { data: existingTasks, error: fetchError } = await supabase
      .from('tasks')
      .select('start_time')
      .eq('project_id', project.id)
      .gte('start_time', start.toISOString())
      .lte('start_time', end.toISOString())

    if (fetchError) {
      console.error('❌ 기존 스케줄 조회 실패:', fetchError)
      return
    }

    // 타임스탬프(ms)로 변환하여 비교 (문자열 포맷 불일치 방지)
    const existingTimes = new Set(
      existingTasks?.map(t => new Date(t.start_time).getTime()) || []
    )
    const tasksToCreate: any[] = []
    const now = new Date()

    // 2. 템플릿 기반 생성 계산
    // start가 속한 주의 월요일부터 end가 속한 주까지 순회
    const loopStart = startOfWeek(start, { weekStartsOn: 1 }) // 월요일 시작
    const loopEnd = endOfWeek(end, { weekStartsOn: 1 })

    let currentWeekStart = new Date(loopStart)

    while (currentWeekStart <= loopEnd) {
      project.schedule_template.forEach(schedule => {
        const targetDay = schedule.day // 0(일) ~ 6(토)
        const mondayDay = currentWeekStart.getDay() // 1(월)

        let daysToAdd = targetDay - mondayDay
        // 요일 보정 (월요일 기준)
        // target: 1(월) -> add 0
        // target: 2(화) -> add 1
        // target: 0(일) -> add 6
        if (targetDay === 0) daysToAdd = 6
        else daysToAdd = targetDay - 1

        const lessonDate = new Date(currentWeekStart)
        lessonDate.setDate(lessonDate.getDate() + daysToAdd)

        const [hour, minute] = schedule.time.split(':').map(Number)
        lessonDate.setHours(hour, minute, 0, 0)

        // [검증 1] 기간 범위 체크
        if (lessonDate < start || lessonDate > end) return

        // [검증 2] 과거 데이터 생성 방지
        if (lessonDate < now) return

        // [검증 3] 종료일 체크
        if (project.end_date && lessonDate > new Date(project.end_date)) return

        // [검증 4] 중복 체크 (DB에 이미 있는 시간인지)
        // 타임스탬프로 비교
        const lessonTime = lessonDate.getTime()
        if (existingTimes.has(lessonTime)) return

        // [검증 5] 이번 배치 내 중복 체크 (tasksToCreate 내 중복)
        const timeIso = lessonDate.toISOString()
        if (tasksToCreate.some(t => t.start_time === timeIso)) return

        tasksToCreate.push({
          title: project.name,
          project_id: project.id,
          start_time: timeIso,
          duration: schedule.duration || 40,
          status: 'scheduled',
          is_auto_generated: true,
          is_top5: false,
        })
      })

      // 다음 주로 이동
      currentWeekStart.setDate(currentWeekStart.getDate() + 7)
    }

    // 3. DB 삽입
    if (tasksToCreate.length > 0) {
      console.log(`➕ [${project.name}] ${tasksToCreate.length}개 수업 생성`)
      const { error } = await supabase.from('tasks').insert(tasksToCreate)
      if (error) console.error('생성 실패:', error)
    }
  }

  return {
    syncProjectSchedule,
    ensureScheduleInRange
  }
}

