'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { TextbookTemplate, TemplateChapter } from '@/types/database'

export function useTextbookTemplates() {
    const [templates, setTemplates] = useState<TextbookTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // 템플릿 목록 조회
    const fetchTemplates = useCallback(async () => {
        try {
            setLoading(true)
            const { data, error: fetchError } = await supabase
                .from('textbook_templates')
                .select('*')
                .order('created_at', { ascending: false })

            if (fetchError) throw fetchError
            
            // chapters JSON을 파싱
            const parsedData = (data || []).map(t => ({
                ...t,
                chapters: t.chapters || []
            }))
            
            setTemplates(parsedData)
        } catch (err) {
            console.error('Error fetching templates:', err)
            setError(err instanceof Error ? err.message : 'Failed to fetch templates')
        } finally {
            setLoading(false)
        }
    }, [])

    // 초기 로드
    useEffect(() => {
        fetchTemplates()
    }, [fetchTemplates])

    // 템플릿 생성 (교재에서 저장)
    const createTemplate = useCallback(async (
        name: string,
        totalChapters: number,
        chapterUnit: '강' | '과' | 'Unit' | 'Chapter' | '직접입력',
        customChapterUnit?: string,
        chapters?: TemplateChapter[]
    ): Promise<TextbookTemplate> => {
        try {
            const { data, error: createError } = await supabase
                .from('textbook_templates')
                .insert({
                    name,
                    total_chapters: totalChapters,
                    chapter_unit: chapterUnit,
                    custom_chapter_unit: customChapterUnit || null,
                    chapters: chapters || []
                })
                .select()
                .single()

            if (createError) throw createError

            const newTemplate = {
                ...data,
                chapters: data.chapters || []
            }

            setTemplates(prev => [newTemplate, ...prev])
            return newTemplate
        } catch (err) {
            console.error('Error creating template:', err)
            throw err
        }
    }, [])

    // 템플릿 수정
    const updateTemplate = useCallback(async (
        id: string,
        updates: {
            name?: string
            total_chapters?: number
            chapter_unit?: '강' | '과' | 'Unit' | 'Chapter' | '직접입력'
            custom_chapter_unit?: string
            chapters?: TemplateChapter[]
        }
    ): Promise<TextbookTemplate> => {
        try {
            const { data, error: updateError } = await supabase
                .from('textbook_templates')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single()

            if (updateError) throw updateError

            const updatedTemplate = {
                ...data,
                chapters: data.chapters || []
            }

            setTemplates(prev => prev.map(t => t.id === id ? updatedTemplate : t))
            return updatedTemplate
        } catch (err) {
            console.error('Error updating template:', err)
            throw err
        }
    }, [])

    // 템플릿 삭제
    const deleteTemplate = useCallback(async (id: string): Promise<void> => {
        try {
            const { error: deleteError } = await supabase
                .from('textbook_templates')
                .delete()
                .eq('id', id)

            if (deleteError) throw deleteError

            setTemplates(prev => prev.filter(t => t.id !== id))
        } catch (err) {
            console.error('Error deleting template:', err)
            throw err
        }
    }, [])

    // 교재에서 템플릿 생성 (단원 정보 포함)
    const createTemplateFromTextbook = useCallback(async (
        templateName: string,
        textbook: {
            total_chapters: number
            chapter_unit: '강' | '과' | 'Unit' | 'Chapter' | '직접입력'
            custom_chapter_unit?: string
        },
        chapters: Array<{ chapter_number: number; custom_name?: string }>
    ): Promise<TextbookTemplate> => {
        // TextbookChapter를 TemplateChapter로 변환
        const templateChapters: TemplateChapter[] = chapters.map(c => ({
            chapter_number: c.chapter_number,
            custom_name: c.custom_name
        }))

        return createTemplate(
            templateName,
            textbook.total_chapters,
            textbook.chapter_unit,
            textbook.custom_chapter_unit,
            templateChapters
        )
    }, [createTemplate])

    // 템플릿에서 교재 데이터 가져오기
    const getTextbookDataFromTemplate = useCallback((templateId: string): {
        total_chapters: number
        chapter_unit: '강' | '과' | 'Unit' | 'Chapter' | '직접입력'
        custom_chapter_unit?: string
        chapters: TemplateChapter[]
    } | null => {
        const template = templates.find(t => t.id === templateId)
        if (!template) return null

        return {
            total_chapters: template.total_chapters,
            chapter_unit: template.chapter_unit,
            custom_chapter_unit: template.custom_chapter_unit,
            chapters: template.chapters || []
        }
    }, [templates])

    return {
        templates,
        loading,
        error,
        fetchTemplates,
        createTemplate,
        updateTemplate,
        deleteTemplate,
        createTemplateFromTextbook,
        getTextbookDataFromTemplate
    }
}
