import { supabase } from '@/lib/supabase'

/**
 * 이미지를 Supabase Storage에 업로드하고 공개 URL을 반환합니다.
 * @param file 업로드할 이미지 파일
 * @returns 업로드된 이미지의 공개 URL
 */
export async function uploadImage(file: File): Promise<string | null> {
  try {
    // 파일명 생성: timestamp + random string + 확장자
    const fileExt = file.name.split('.').pop() || 'png'
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`
    const filePath = `memo-images/${fileName}`

    // Supabase Storage에 업로드
    const { data, error } = await supabase.storage
      .from('task-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('이미지 업로드 에러:', error.message)
      return null
    }

    // 공개 URL 가져오기
    const { data: urlData } = supabase.storage
      .from('task-images')
      .getPublicUrl(filePath)

    return urlData.publicUrl
  } catch (err) {
    console.error('이미지 업로드 실패:', err)
    return null
  }
}

/**
 * 클립보드 이벤트에서 이미지 파일을 추출합니다.
 * @param event 클립보드 이벤트
 * @returns 이미지 파일 또는 null
 */
export function getImageFromClipboard(event: ClipboardEvent): File | null {
  const items = event.clipboardData?.items
  if (!items) return null

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) return file
    }
  }
  return null
}

