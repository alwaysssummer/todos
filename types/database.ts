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
    
    // 과제 관리 (Phase 2)
    homework_checks?: HomeworkCheckItem[]        // 이전 수업에서 배정받은 과제 체크
    homework_assignments?: HomeworkAssignmentItem[]  // 다음 수업에 배정할 과제

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
    textbooks?: string[]  // 배정된 교재 ID (최대 4개)

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

// =====================================================
// 과제 관리 타입 (Phase 2)
// =====================================================

// 교재 인터페이스
export interface Textbook {
    id: string
    name: string
    total_chapters: number
    chapter_unit: '강' | '과' | 'Unit' | 'Chapter' | '직접입력'
    custom_chapter_unit?: string
    created_at: string
}

// 과제 체크 아이템 (이전 수업에서 배정받은 과제)
export interface HomeworkCheckItem {
    textbook_id: string
    textbook_name: string  // 캐시용 (조회 편의)
    chapter: string        // "1", "2", "3"...
    is_completed: boolean
    note?: string         // 단원별 수업 노하우/문제점 메모
    completed_at?: string
}

// 과제 배정 아이템 (다음 수업에 배정할 과제)
export interface HomeworkAssignmentItem {
    textbook_id: string
    textbook_name: string  // 캐시용
    chapters: string[]     // ["1", "2", "3"]
}