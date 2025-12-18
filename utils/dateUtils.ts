/**
 * 한국 시간(KST, UTC+9) 기준으로 현재 날짜를 반환합니다.
 * 서버 타임존에 관계없이 항상 한국 시간 기준으로 계산됩니다.
 */
export function getKoreanToday(): Date {
  const now = new Date()
  // UTC 시간을 한국 시간(UTC+9)으로 변환
  const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000))
  // 시간 부분을 00:00:00.000으로 설정
  koreanTime.setUTCHours(0, 0, 0, 0)
  return koreanTime
}

/**
 * 한국 시간 기준으로 현재 시각을 반환합니다.
 */
export function getKoreanNow(): Date {
  const now = new Date()
  return new Date(now.getTime() + (9 * 60 * 60 * 1000))
}

/**
 * 주어진 Date 객체를 한국 시간 기준으로 변환합니다.
 */
export function toKoreanTime(date: Date): Date {
  return new Date(date.getTime() + (9 * 60 * 60 * 1000))
}
