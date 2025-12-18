/**
 * 통일된 에러 처리 유틸리티
 */

export type ErrorContext = 
  | '태스크 생성'
  | '태스크 수정'
  | '태스크 삭제'
  | '노트 생성'
  | '노트 수정'
  | '노트 삭제'
  | '프로젝트 생성'
  | '프로젝트 수정'
  | '프로젝트 삭제'
  | '링크 생성'
  | '링크 수정'
  | '링크 삭제'
  | '드래그앤드롭'
  | '체크리스트 토글'
  | '데이터 로드'
  | string

/**
 * 에러 메시지 포맷팅
 */
function formatErrorMessage(context: ErrorContext, error: unknown): string {
  const errorMessage = error instanceof Error ? error.message : String(error)
  return `[${context}] 에러: ${errorMessage}`
}

/**
 * 에러를 콘솔에 로깅
 * 
 * @param error - 에러 객체
 * @param context - 에러 발생 컨텍스트
 */
export function logError(error: unknown, context: ErrorContext): void {
  const message = formatErrorMessage(context, error)
  console.error(message, error)
}

/**
 * 에러를 로깅하고 사용자에게 알림
 * 
 * @param error - 에러 객체
 * @param context - 에러 발생 컨텍스트
 * @param showAlert - 사용자에게 알림 표시 여부 (기본값: false)
 */
export function handleError(
  error: unknown, 
  context: ErrorContext,
  showAlert: boolean = false
): void {
  logError(error, context)
  
  if (showAlert) {
    const message = formatErrorMessage(context, error)
    alert(message)
  }
}

/**
 * 비동기 함수를 에러 핸들링으로 래핑
 * 
 * @param fn - 실행할 비동기 함수
 * @param context - 에러 발생 컨텍스트
 * @param showAlert - 에러 발생 시 알림 표시 여부
 * @returns 래핑된 함수
 * 
 * @example
 * const safeCreateTask = withErrorHandling(
 *   async () => await createTask({ title: 'New Task' }),
 *   '태스크 생성'
 * )
 * await safeCreateTask()
 */
export function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: ErrorContext,
  showAlert: boolean = false
): () => Promise<T | undefined> {
  return async () => {
    try {
      return await fn()
    } catch (error) {
      handleError(error, context, showAlert)
      return undefined
    }
  }
}

/**
 * try-catch 블록을 간단하게 작성하기 위한 헬퍼
 * 
 * @param fn - 실행할 함수
 * @param context - 에러 발생 컨텍스트
 * @param showAlert - 에러 발생 시 알림 표시 여부
 * @returns 함수 실행 결과 또는 undefined
 * 
 * @example
 * const result = await tryCatch(
 *   async () => await createTask({ title: 'New Task' }),
 *   '태스크 생성'
 * )
 * if (result) {
 *   console.log('Success:', result)
 * }
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  context: ErrorContext,
  showAlert: boolean = false
): Promise<T | undefined> {
  try {
    return await fn()
  } catch (error) {
    handleError(error, context, showAlert)
    return undefined
  }
}

/**
 * 에러 발생 시 기본값을 반환하는 헬퍼
 * 
 * @param fn - 실행할 함수
 * @param defaultValue - 에러 발생 시 반환할 기본값
 * @param context - 에러 발생 컨텍스트
 * @returns 함수 실행 결과 또는 기본값
 * 
 * @example
 * const tasks = await tryCatchWithDefault(
 *   async () => await fetchTasks(),
 *   [],
 *   '데이터 로드'
 * )
 */
export async function tryCatchWithDefault<T>(
  fn: () => Promise<T>,
  defaultValue: T,
  context: ErrorContext
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    handleError(error, context)
    return defaultValue
  }
}

/**
 * 여러 비동기 작업을 병렬로 실행하고 에러 처리
 * 
 * @param operations - 실행할 작업 배열 { fn, context }
 * @returns 성공한 결과 배열
 * 
 * @example
 * const results = await executeParallel([
 *   { fn: async () => await createTask(task1), context: '태스크 생성' },
 *   { fn: async () => await createTask(task2), context: '태스크 생성' }
 * ])
 */
export async function executeParallel<T>(
  operations: Array<{ fn: () => Promise<T>; context: ErrorContext }>
): Promise<T[]> {
  const results = await Promise.allSettled(
    operations.map(({ fn }) => fn())
  )

  const successfulResults: T[] = []
  
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      handleError(result.reason, operations[index].context)
    } else {
      successfulResults.push(result.value)
    }
  })

  return successfulResults
}
