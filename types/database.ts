export interface Task {
    // ===== 기존 필드 (100% 유지) =====
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

    // 보관 여부
    is_archived?: boolean     // true면 보관된 노트/테스크

    // ===== 블록 기반 확장 필드 (Phase 3) =====
    parent_id?: string | null  // 계층 구조 지원 (부모 Task ID)
    type?: TaskType            // Task 타입 (동적 확장 가능)
    properties?: TaskProperties // 타입별 동적 속성
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
    is_private?: boolean      // 비공개 수업 여부
    tuition?: number          // 수업료 (만원 단위, 12 = 12만원)
    tuition_paid?: boolean    // 수업료 납부 여부

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
// 루틴 (Routine) - 독립적인 일일 반복 체크 시스템
// =====================================================

export interface Routine {
    id: string
    title: string
    repeat_days: number[]        // [0,1,2,3,4,5,6] = 일~토, 기본값 매일
    target_time?: string         // "07:00" 형식 (선택)
    is_active: boolean           // 활성화 여부
    order_index: number          // 정렬 순서
    created_at: string
}

export interface RoutineLog {
    id: string
    routine_id: string           // 루틴 ID
    date: string                 // "2025-11-25" (날짜)
    is_completed: boolean        // 체크 여부
    completed_at?: string        // 완료 시간
    note?: string                // 메모 (선택)
    created_at: string
}

// 루틴 통계 타입
export interface RoutineStats {
    routine_id: string
    total_count: number          // 총 달성 횟수
    week_count: number           // 이번 주 달성
    week_total: number           // 이번 주 총 일수
    month_count: number          // 이번 달 달성
    month_total: number          // 이번 달 총 일수
    streak: number               // 연속 달성일
    last_completed?: string      // 마지막 완료일
    
    // 확장 통계
    best_streak: number          // 최장 연속 기록
    total_rate: number           // 전체 달성률 (%)
    avg_completion_time?: string // 평균 완료 시간 (HH:mm)
    first_completed?: string     // 최초 완료일
}

// 달력용 로그 데이터
export interface RoutineCalendarLog {
    date: string                 // "YYYY-MM-DD"
    is_completed: boolean
    note?: string
    completed_at?: string
}

// 최근 메모 타입
export interface RoutineRecentNote {
    date: string
    note: string
}

// =====================================================
// Notion Links (프로젝트 링크)
// =====================================================

export interface NotionLink {
    id: string
    title: string
    url: string
    order_index: number
    created_at: string
}

// =====================================================
// Daily Notes (일일 기록)
// =====================================================

export interface DailyNote {
    id: string
    date: string // 'YYYY-MM-DD'
    title: string
    content?: string
    emoji?: string
    
    // 확장 필드
    photos?: string[]
    location?: {
        lat: number
        lng: number
        address: string
        place_name?: string
    }
    weather?: 'sunny' | 'cloudy' | 'rainy' | 'snowy'
    mood?: 1 | 2 | 3 | 4 | 5
    tags?: string[]
    is_private?: boolean
    category?: 'diary' | 'event' | 'travel' | 'memory'
    
    created_at: string
    updated_at: string
}

export type DailyNoteCategory = 'diary' | 'event' | 'travel' | 'memory'
export type Weather = 'sunny' | 'cloudy' | 'rainy' | 'snowy'
export type Mood = 1 | 2 | 3 | 4 | 5

// =====================================================
// 과제 관리 타입 (Phase 2)
// =====================================================

// 교재 그룹 인터페이스 (그룹1: 어법, 독해, 단어 등)
export interface TextbookGroup {
    id: string
    name: string
    order_index: number
    created_at: string
}

// 교재 서브그룹 인터페이스 (그룹2: 초급, 중급, 고급 등)
export interface TextbookSubgroup {
    id: string
    group_id: string       // 상위 그룹
    name: string           // "초급", "중급", "고급" 등
    local_path?: string    // 로컬 폴더 경로 (예: D:\교재\어법\초급)
    order_index: number
    created_at: string
}

// 교재 인터페이스
export interface Textbook {
    id: string
    name: string
    total_chapters: number
    chapter_unit: '강' | '과' | 'Unit' | 'Chapter' | '직접입력'
    custom_chapter_unit?: string
    group_id?: string       // 그룹1 연결
    subgroup_id?: string    // 그룹2 연결
    order_index?: number    // 정렬 순서
    local_path?: string     // 로컬 폴더 경로
    created_at: string
}

// 교재 템플릿 인터페이스
export interface TextbookTemplate {
    id: string
    name: string                           // 템플릿명 (예: "수능 어법 10강")
    total_chapters: number                 // 총 단원 수
    chapter_unit: '강' | '과' | 'Unit' | 'Chapter' | '직접입력'
    custom_chapter_unit?: string           // 직접입력 시 사용자 정의 단위
    chapters?: TemplateChapter[]           // 단원 정보 배열
    created_at: string
    updated_at: string
}

// 템플릿 단원 정보
export interface TemplateChapter {
    chapter_number: number
    custom_name?: string
}

// 단원 인터페이스 (단원명 수정 + 메모)
export interface TextbookChapter {
    id: string
    textbook_id: string
    chapter_number: number
    custom_name?: string    // 수정된 단원명 (null이면 기본명 사용)
    memo?: string           // 단원 메모
    order_index?: number    // 정렬 순서
    created_at: string
    updated_at: string
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

// =====================================================
// 블록 기반 Task 시스템 (Phase 3)
// =====================================================

// Task 타입 정의 (무한 확장 가능)
export type TaskType = 
  | 'task'           // 일반 작업 (기본값)
  | 'lesson'         // 수업 (is_auto_generated 대체 가능)
  | 'exam'           // 시험
  | 'exam_question'  // 시험 문제 (exam의 자식)
  | 'homework'       // 과제 (향후)
  | 'quiz'           // 퀴즈
  | 'note'           // 노트
  | 'habit'          // 습관
  | 'project'        // 프로젝트

// 동적 속성 타입 (타입별로 다른 구조)
export type TaskProperties = 
  | Record<string, any>        // 기본 (모든 타입 허용)
  | ExamProperties             // 시험
  | ExamQuestionProperties     // 시험 문제
  | QuizProperties             // 퀴즈
  | NoteProperties             // 노트

// =====================================================
// 시험 관련 타입
// =====================================================

// 시험 속성
export interface ExamProperties {
  subject?: string             // 과목 (예: '수학', '영어')
  total_score?: number         // 만점
  user_score?: number          // 획득 점수
  duration?: number            // 시험 시간 (분)
  exam_date?: string           // 시험 날짜 (ISO string)
  difficulty?: 'easy' | 'medium' | 'hard'
  syllabus?: string[]          // 출제 범위
  passing_score?: number       // 합격 점수
  description?: string         // 시험 설명
}

// 시험 문제 속성
export interface ExamQuestionProperties {
  question: string             // 문제 내용
  correct_answer: string       // 정답
  user_answer?: string         // 학생 답안
  points: number              // 배점
  is_correct?: boolean        // 정답 여부 (자동 채점 결과)
  question_type?: 'multiple_choice' | 'short_answer' | 'essay' | 'true_false'
  choices?: string[]          // 선택지 (객관식)
  explanation?: string        // 해설
  tags?: string[]            // 문제 태그 (예: '함수', '미분')
  difficulty?: 'easy' | 'medium' | 'hard'
  hint?: string              // 힌트
  image_url?: string         // 문제 이미지 URL
}

// =====================================================
// 퀴즈 관련 타입
// =====================================================

export interface QuizProperties {
  questions: QuizQuestion[]
  total_questions: number
  correct_count?: number
  time_limit?: number         // 제한 시간 (초)
  started_at?: string         // 시작 시간
  completed_at?: string       // 완료 시간
  score?: number             // 점수
}

export interface QuizQuestion {
  question: string
  correct_answer: string
  user_answer?: string
  is_correct?: boolean
  points?: number
}

// =====================================================
// 노트 관련 타입
// =====================================================

export interface NoteProperties {
  content?: string            // 마크다운 콘텐츠
  attachments?: string[]      // 첨부 파일 URL
  references?: string[]       // 참고 링크
  color?: string             // 노트 색상
  pinned?: boolean           // 고정 여부
}

// =====================================================
// 타입 가드 (런타임 타입 체크)
// =====================================================

export function isExamTask(task: Task): task is Task & { properties: ExamProperties } {
  return task.type === 'exam'
}

export function isExamQuestionTask(task: Task): task is Task & { properties: ExamQuestionProperties } {
  return task.type === 'exam_question'
}

export function isQuizTask(task: Task): task is Task & { properties: QuizProperties } {
  return task.type === 'quiz'
}

export function isNoteTask(task: Task): task is Task & { properties: NoteProperties } {
  return task.type === 'note'
}

export function isLessonTask(task: Task): boolean {
  return task.type === 'lesson' || task.is_auto_generated === true || task.is_makeup === true
}

// =====================================================
// 계층 구조 헬퍼
// =====================================================

export interface TaskWithChildren extends Task {
  children?: TaskWithChildren[]
}

/**
 * 평면 배열을 트리 구조로 변환
 * @param tasks 전체 Task 배열
 * @returns 루트 Task들의 배열 (children 포함)
 */
export function buildTaskTree(tasks: Task[]): TaskWithChildren[] {
  const taskMap = new Map<string, TaskWithChildren>()
  const roots: TaskWithChildren[] = []

  // 1. 모든 Task를 맵에 추가
  tasks.forEach(task => {
    taskMap.set(task.id, { ...task, children: [] })
  })

  // 2. 트리 구조 구성
  tasks.forEach(task => {
    const node = taskMap.get(task.id)!
    if (task.parent_id) {
      const parent = taskMap.get(task.parent_id)
      if (parent) {
        parent.children!.push(node)
      } else {
        // 부모를 찾을 수 없으면 루트로 처리
        roots.push(node)
      }
    } else {
      roots.push(node)
    }
  })

  return roots
}

/**
 * 특정 Task의 모든 자식 Task 가져오기 (재귀)
 * @param tasks 전체 Task 배열
 * @param parentId 부모 Task ID
 * @returns 자식 Task 배열
 */
export function getChildTasks(tasks: Task[], parentId: string): Task[] {
  return tasks.filter(t => t.parent_id === parentId)
}

/**
 * 특정 Task의 모든 자손 Task 가져오기 (재귀)
 * @param tasks 전체 Task 배열
 * @param parentId 부모 Task ID
 * @returns 모든 자손 Task 배열
 */
export function getAllDescendants(tasks: Task[], parentId: string): Task[] {
  const children = getChildTasks(tasks, parentId)
  const descendants: Task[] = [...children]
  
  children.forEach(child => {
    descendants.push(...getAllDescendants(tasks, child.id))
  })
  
  return descendants
}

/**
 * Task의 계층 깊이 계산
 * @param tasks 전체 Task 배열
 * @param taskId Task ID
 * @returns 깊이 (루트는 0)
 */
export function getTaskDepth(tasks: Task[], taskId: string): number {
  const task = tasks.find(t => t.id === taskId)
  if (!task || !task.parent_id) return 0
  return 1 + getTaskDepth(tasks, task.parent_id)
}

/**
 * 루트 Task만 필터링 (중첩되지 않은 Task)
 * @param tasks 전체 Task 배열
 * @returns 루트 Task 배열
 */
export function getRootTasks(tasks: Task[]): Task[] {
  return tasks.filter(t => !t.parent_id)
}
