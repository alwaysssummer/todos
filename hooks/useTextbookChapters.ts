'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { TextbookChapter } from '@/types/database'

export function useTextbookChapters(textbookId?: string) {
  const [chapters, setChapters] = useState<TextbookChapter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 단원 목록 조회
  const fetchChapters = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('textbook_chapters')
        .select('*')
        .eq('textbook_id', textbookId)
        .order('chapter_number', { ascending: true })

      if (fetchError) throw fetchError
      setChapters(data || [])
    } catch (err) {
      console.error('Error fetching chapters:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch chapters')
    } finally {
      setLoading(false)
    }
  }, [textbookId])

  // 단원명 수정 (없으면 생성)
  const updateChapterName = useCallback(async (chapterNumber: number, customName: string): Promise<TextbookChapter> => {
    const existingChapter = chapters.find(c => c.chapter_number === chapterNumber)
    
    if (existingChapter) {
      // 기존 단원 수정
      const { data, error: updateError } = await supabase
        .from('textbook_chapters')
        .update({ 
          custom_name: customName || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingChapter.id)
        .select()
        .single()

      if (updateError) throw updateError
      
      setChapters(prev => prev.map(c => c.id === existingChapter.id ? data : c))
      return data
    } else {
      // 새 단원 생성
      const { data, error: createError } = await supabase
        .from('textbook_chapters')
        .insert({
          textbook_id: textbookId,
          chapter_number: chapterNumber,
          custom_name: customName || null
        })
        .select()
        .single()

      if (createError) throw createError
      
      setChapters(prev => [...prev, data].sort((a, b) => a.chapter_number - b.chapter_number))
      return data
    }
  }, [textbookId, chapters])

  // 단원 메모 수정 (없으면 생성)
  const updateChapterMemo = useCallback(async (chapterNumber: number, memo: string): Promise<TextbookChapter> => {
    const existingChapter = chapters.find(c => c.chapter_number === chapterNumber)
    
    if (existingChapter) {
      // 기존 단원 수정
      const { data, error: updateError } = await supabase
        .from('textbook_chapters')
        .update({ 
          memo: memo || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingChapter.id)
        .select()
        .single()

      if (updateError) throw updateError
      
      setChapters(prev => prev.map(c => c.id === existingChapter.id ? data : c))
      return data
    } else {
      // 새 단원 생성
      const { data, error: createError } = await supabase
        .from('textbook_chapters')
        .insert({
          textbook_id: textbookId,
          chapter_number: chapterNumber,
          memo: memo || null
        })
        .select()
        .single()

      if (createError) throw createError
      
      setChapters(prev => [...prev, data].sort((a, b) => a.chapter_number - b.chapter_number))
      return data
    }
  }, [textbookId, chapters])

  // 초기 로드
  useEffect(() => {
    if (textbookId) {
      fetchChapters()
    }
  }, [textbookId, fetchChapters])

  // 특정 단원의 메모 가져오기 (textbookId + chapterNumber로 직접 조회)
  const getChapterMemo = useCallback(async (targetTextbookId: string, chapterNumber: number): Promise<string | undefined> => {
    try {
      const { data, error } = await supabase
        .from('textbook_chapters')
        .select('memo')
        .eq('textbook_id', targetTextbookId)
        .eq('chapter_number', chapterNumber)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // 데이터 없음 (정상)
          return undefined
        }
        throw error
      }

      return data?.memo
    } catch (err) {
      console.error('Error getting chapter memo:', err)
      return undefined
    }
  }, [])

  // 특정 단원의 메모 저장 (textbookId + chapterNumber로 직접 저장)
  const saveChapterMemo = useCallback(async (targetTextbookId: string, chapterNumber: number, memo: string) => {
    try {
      const { data, error } = await supabase
        .from('textbook_chapters')
        .upsert({
          textbook_id: targetTextbookId,
          chapter_number: chapterNumber,
          memo: memo || null,
        }, {
          onConflict: 'textbook_id,chapter_number'
        })
        .select()
        .single()

      if (error) throw error

      // 현재 textbookId와 같으면 로컬 상태도 업데이트
      if (targetTextbookId === textbookId) {
        setChapters(prev => {
          const existing = prev.find(c => c.chapter_number === chapterNumber)
          if (existing) {
            return prev.map(c => c.chapter_number === chapterNumber ? data : c)
          } else {
            return [...prev, data].sort((a, b) => a.chapter_number - b.chapter_number)
          }
        })
      }

      return data
    } catch (err) {
      console.error('Error saving chapter memo:', err)
      throw err
    }
  }, [textbookId])

  // 단원 추가 (특정 위치에)
  const addChapter = useCallback(async (targetTextbookId: string, insertAtIndex: number, customName?: string): Promise<TextbookChapter> => {
    try {
      // 현재 단원들 조회
      const { data: currentChapters, error: fetchError } = await supabase
        .from('textbook_chapters')
        .select('*')
        .eq('textbook_id', targetTextbookId)
        .order('chapter_number', { ascending: true })

      if (fetchError) throw fetchError

      const chaptersToUpdate = currentChapters || []
      
      // 삽입 위치 이후의 단원들 chapter_number 증가 (역순으로 처리해서 중복 방지)
      const chaptersAfterInsert = chaptersToUpdate
        .filter(c => c.chapter_number > insertAtIndex)
        .sort((a, b) => b.chapter_number - a.chapter_number) // 역순 정렬

      for (const chapter of chaptersAfterInsert) {
        const { error } = await supabase
          .from('textbook_chapters')
          .update({ 
            chapter_number: chapter.chapter_number + 1,
            order_index: chapter.chapter_number // order_index도 업데이트
          })
          .eq('id', chapter.id)
        
        if (error) throw error
      }

      // 새 단원 추가
      const { data, error: createError } = await supabase
        .from('textbook_chapters')
        .insert({
          textbook_id: targetTextbookId,
          chapter_number: insertAtIndex + 1,
          order_index: insertAtIndex,
          custom_name: customName || null
        })
        .select()
        .single()

      if (createError) throw createError

      // 로컬 상태 업데이트
      if (targetTextbookId === textbookId) {
        await fetchChapters()
      }

      return data
    } catch (err) {
      console.error('Error adding chapter:', err)
      throw err
    }
  }, [textbookId, fetchChapters])

  // 단원 삭제
  const deleteChapter = useCallback(async (chapterId: string): Promise<void> => {
    try {
      const chapterToDelete = chapters.find(c => c.id === chapterId)
      if (!chapterToDelete) throw new Error('Chapter not found')

      // 삭제
      const { error: deleteError } = await supabase
        .from('textbook_chapters')
        .delete()
        .eq('id', chapterId)

      if (deleteError) throw deleteError

      // 삭제된 단원 이후의 단원들 chapter_number 감소
      const chaptersAfter = chapters.filter(c => c.chapter_number > chapterToDelete.chapter_number)
      const updatePromises = chaptersAfter.map(c =>
        supabase
          .from('textbook_chapters')
          .update({ 
            chapter_number: c.chapter_number - 1,
            order_index: (c.order_index ?? c.chapter_number) - 1
          })
          .eq('id', c.id)
      )

      await Promise.all(updatePromises)

      // 로컬 상태 업데이트
      await fetchChapters()
    } catch (err) {
      console.error('Error deleting chapter:', err)
      throw err
    }
  }, [chapters, fetchChapters])

  // 단원 순서 변경 (드래그앤드롭) - chapter_number는 유지, order_index만 변경
  const reorderChapters = useCallback(async (reorderedChapters: TextbookChapter[]): Promise<void> => {
    try {
      // 낙관적 업데이트 - order_index만 변경, chapter_number는 유지
      setChapters(reorderedChapters.map((c, i) => ({ 
        ...c, 
        order_index: i 
      })))

      // DB 업데이트 - order_index만 변경
      const updatePromises = reorderedChapters.map((chapter, index) =>
        supabase
          .from('textbook_chapters')
          .update({ 
            order_index: index 
          })
          .eq('id', chapter.id)
      )

      await Promise.all(updatePromises)
    } catch (err) {
      console.error('Error reordering chapters:', err)
      await fetchChapters() // 실패시 다시 로드
      throw err
    }
  }, [fetchChapters])

  // 단원 일괄 등록 (기존 단원 전체 삭제 후 새로 등록)
  const bulkImportChapters = useCallback(async (
    targetTextbookId: string,
    chapters: Array<{ chapterNumber: string; chapterName: string }>
  ): Promise<void> => {
    try {
      console.log('🔵 [Step 1] 기존 단원 삭제 시작, textbookId:', targetTextbookId)
      
      // 1. 기존 단원들 모두 삭제
      const { error: deleteError } = await supabase
        .from('textbook_chapters')
        .delete()
        .eq('textbook_id', targetTextbookId)

      if (deleteError) {
        console.error('❌ [Step 1] 삭제 에러:', deleteError)
        throw deleteError
      }
      
      console.log('✅ [Step 1] 삭제 완료')

      console.log('🔵 [Step 2] 단원 삽입 시작 (배치 처리)')
      
      // 2. 새 단원들 배치로 생성 (50개씩)
      const newChapters = chapters.map((ch, index) => ({
        textbook_id: targetTextbookId,
        chapter_number: index + 1,  // 1부터 시작하는 순차 번호
        // custom_name에 "단원번호 단원명" 형식으로 저장
        custom_name: ch.chapterName ? `${ch.chapterNumber} ${ch.chapterName}` : ch.chapterNumber
      }))

      console.log('📝 등록할 단원 수:', newChapters.length)
      console.log('📝 첫 번째 단원 샘플:', newChapters[0])

      const batchSize = 50
      let totalInserted = 0
      
      for (let i = 0; i < newChapters.length; i += batchSize) {
        const batch = newChapters.slice(i, i + batchSize)
        console.log(`📝 배치 ${Math.floor(i / batchSize) + 1}: ${batch.length}개 삽입 중...`)
        
        const { data: insertData, error: insertError } = await supabase
          .from('textbook_chapters')
          .insert(batch)
          .select()

        if (insertError) {
          console.error(`❌ 배치 ${Math.floor(i / batchSize) + 1} 삽입 에러:`, insertError)
          throw insertError
        }
        
        totalInserted += insertData?.length || 0
        console.log(`✅ 배치 ${Math.floor(i / batchSize) + 1} 성공: ${insertData?.length}개`)
      }
      
      console.log('✅ [Step 2] 전체 삽입 완료:', totalInserted, '개')

      console.log('🔵 [Step 3] total_chapters 업데이트 시작')
      
      // 3. textbooks 테이블의 total_chapters 업데이트
      const { error: updateError } = await supabase
        .from('textbooks')
        .update({ total_chapters: chapters.length })
        .eq('id', targetTextbookId)

      if (updateError) {
        console.error('❌ [Step 3] 업데이트 에러:', updateError)
        throw updateError
      }
      
      console.log('✅ [Step 3] 업데이트 완료')

      console.log('🔵 [Step 4] 로컬 상태 새로고침')
      
      // 4. 로컬 상태 새로고침
      if (targetTextbookId === textbookId) {
        await fetchChapters()
      }
      
      console.log('✅ [전체 완료] 일괄 등록 성공!')
    } catch (err) {
      console.error('❌ [Error] bulk importing chapters:', err)
      throw err
    }
  }, [textbookId, fetchChapters])

  return {
    chapters,
    loading,
    error,
    fetchChapters,
    updateChapterName,
    updateChapterMemo,
    getChapterMemo,
    saveChapterMemo,
    addChapter,
    deleteChapter,
    reorderChapters,
    bulkImportChapters
  }
}

