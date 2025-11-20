export interface Task {
    id: string
    title: string
    description?: string
    start_time?: string | null // ISO string
    duration?: number | null // in minutes
    is_all_day?: boolean
    due_date?: string | null // ISO string
    project_id?: string // 프로젝트 연결
    status: 'inbox' | 'scheduled' | 'completed' | 'cancelled' | 'waiting'
    is_top5: boolean
    order_index: number
    created_at: string
    updated_at: string

    // 자동 생성 여부
    is_auto_generated?: boolean

    // 태그
    tags?: string[]

    // 학생 시간표 전용
    attendance?: 'present' | 'absent' | 'late'
    homework_status?: 'done' | 'pending' | 'none'
    lesson_note?: string
    is_makeup?: boolean  // 보충 수업 여부
    is_cancelled?: boolean  // 취소 여부

    // 루틴/습관 전용
    habit_completed?: boolean
    actual_duration?: number  // 실제 소요 시간 (분)
    streak_count?: number     // 연속 달성일
}

export interface Project {
    id: string
    name: string
    color: string
    type: 'folder' | 'student' | 'habit'
    status?: 'active' | 'completed' | 'paused'
    created_at: string

    // 학생 시간표 전용
    start_date?: string  // ISO string
    end_date?: string    // ISO string, 없으면 진행 중
    schedule_template?: {
        day: number      // 0=일, 1=월, ... 6=토
        time: string     // "07:00"
        duration: number // 분 단위
    }[]

    // 루틴/습관 전용
    repeat_days?: number[]    // [1, 2, 3, 4, 5] = 월~금
    target_time?: string      // "07:00"
    target_duration?: number  // 목표 시간 (분)
}

export interface Memo {
    id: string
    title: string
    content?: string
    tags?: string[]
    parent_id?: string
    created_at: string
}
