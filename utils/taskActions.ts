import { extractTags, splitTitleAndDescription, extractAllTags } from './textParser'
import type { Task } from '@/types/database'

/**
 * 태스크 입력 파싱 결과
 */
export interface ParsedTaskInput {
  cleanTitle: string
  description?: string
  isTop5: boolean
  dueDate?: string
  tags?: string[]
}

/**
 * 사용자 입력을 파싱하여 태스크 생성에 필요한 데이터로 변환
 * 
 * @param input - 사용자 입력 문자열
 * @returns 파싱된 태스크 데이터
 * 
 * @example
 * parseTaskInput("*중요한 일 | 설명입니다 #태그1 #태그2")
 * // { cleanTitle: "중요한 일", description: "설명입니다 #태그1 #태그2", isTop5: true, tags: ["태그1", "태그2"] }
 * 
 * @example
 * parseTaskInput("/오늘 할 일")
 * // { cleanTitle: "오늘 할 일", isTop5: false, dueDate: "2024-01-01T00:00:00.000Z" }
 */
export function parseTaskInput(input: string): ParsedTaskInput {
  let title = input.trim()
  let isTop5 = false
  let dueDate: string | undefined = undefined

  // 접두사 처리
  if (title.startsWith('*')) {
    isTop5 = true
    title = title.substring(1).trim()
  } else if (title.startsWith('/')) {
    dueDate = new Date().toISOString()
    title = title.substring(1).trim()
  }

  // 제목과 설명 분리
  const { title: splitTitle, description } = splitTitleAndDescription(title)
  
  // 태그 추출
  const { cleanTitle } = extractTags(splitTitle)
  const allTags = extractAllTags(splitTitle, description)

  return {
    cleanTitle,
    description,
    isTop5,
    dueDate,
    tags: allTags.length > 0 ? allTags : undefined
  }
}

/**
 * 파싱된 데이터로 태스크 생성
 * 
 * @param parsedData - parseTaskInput의 결과
 * @param createTask - 태스크 생성 함수
 * @param type - 태스크 타입 ('task' | 'note')
 * @returns 생성된 태스크
 */
export async function createTaskFromParsedData(
  parsedData: ParsedTaskInput,
  createTask: (task: Partial<Task>) => Promise<Task | undefined>,
  type: 'task' | 'note' = 'task'
): Promise<Task | undefined> {
  const { cleanTitle, description, isTop5, dueDate, tags } = parsedData

  return await createTask({
    title: cleanTitle,
    description,
    status: 'inbox',
    is_top5: isTop5,
    due_date: dueDate,
    tags,
    type
  })
}

/**
 * 사용자 입력으로부터 태스크를 생성하는 통합 함수
 * 
 * @param input - 사용자 입력 문자열
 * @param createTask - 태스크 생성 함수
 * @param type - 태스크 타입
 * @returns 생성된 태스크
 */
export async function createTaskFromInput(
  input: string,
  createTask: (task: Partial<Task>) => Promise<Task | undefined>,
  type: 'task' | 'note' = 'task'
): Promise<Task | undefined> {
  const parsedData = parseTaskInput(input)
  return await createTaskFromParsedData(parsedData, createTask, type)
}
