import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Task, ExamProperties, ExamQuestionProperties } from '@/types/database'

/**
 * 시험 관리 훅
 * - 시험 생성/삭제
 * - 시험 문제 생성/채점
 * - 통계 계산
 */
export function useExams() {
  /**
   * 시험 생성 (부모 Task)
   */
  const createExam = useCallback(async (examData: Partial<Task> & { properties: ExamProperties }) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{
          title: examData.title || '새 시험',
          type: 'exam',
          status: examData.status || 'inbox',
          properties: examData.properties,
          project_id: examData.project_id,
          start_time: examData.start_time,
          duration: examData.duration,
          due_date: examData.due_date,
          order_index: examData.order_index || 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating exam:', error)
      throw error
    }
  }, [])

  /**
   * 시험 문제 생성 (자식 Task)
   */
  const createExamQuestion = useCallback(async (
    examId: string,
    questionData: Partial<Task> & { properties: ExamQuestionProperties }
  ) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{
          title: questionData.title || '새 문제',
          parent_id: examId,  // 🎯 시험에 연결
          type: 'exam_question',
          status: 'inbox',
          properties: questionData.properties,
          order_index: questionData.order_index || 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating exam question:', error)
      throw error
    }
  }, [])

  /**
   * 시험 문제 일괄 생성
   */
  const createExamQuestions = useCallback(async (
    examId: string,
    questions: Array<{ title: string; properties: ExamQuestionProperties }>
  ) => {
    try {
      const tasks = questions.map((q, index) => ({
        title: q.title,
        parent_id: examId,
        type: 'exam_question',
        status: 'inbox',
        properties: q.properties,
        order_index: index,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))

      const { data, error } = await supabase
        .from('tasks')
        .insert(tasks)
        .select()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating exam questions:', error)
      throw error
    }
  }, [])

  /**
   * 시험 문제 답안 제출 및 자동 채점
   */
  const submitAnswer = useCallback(async (questionId: string, userAnswer: string) => {
    try {
      // 1. 문제 가져오기
      const { data: question, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', questionId)
        .eq('type', 'exam_question')
        .single()

      if (fetchError || !question) throw fetchError || new Error('Question not found')

      const props = question.properties as ExamQuestionProperties

      // 2. 자동 채점 (대소문자 무시, 공백 제거)
      const correctAnswer = props.correct_answer?.toLowerCase().trim()
      const submittedAnswer = userAnswer.toLowerCase().trim()
      const isCorrect = correctAnswer === submittedAnswer

      // 3. 답안 및 채점 결과 저장
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          properties: {
            ...props,
            user_answer: userAnswer,
            is_correct: isCorrect
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', questionId)

      if (updateError) throw updateError

      return {
        isCorrect,
        points: isCorrect ? props.points : 0
      }
    } catch (error) {
      console.error('Error submitting answer:', error)
      throw error
    }
  }, [])

  /**
   * 시험의 모든 문제 가져오기
   */
  const getExamQuestions = useCallback(async (examId: string): Promise<Task[]> => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('parent_id', examId)
        .eq('type', 'exam_question')
        .order('order_index', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching exam questions:', error)
      throw error
    }
  }, [])

  /**
   * 시험 통계 계산
   */
  const calculateExamStats = useCallback(async (examId: string) => {
    try {
      const questions = await getExamQuestions(examId)
      
      const totalQuestions = questions.length
      const answeredCount = questions.filter(q => {
        const props = q.properties as ExamQuestionProperties
        return props.user_answer !== undefined && props.user_answer !== null
      }).length
      
      const correctCount = questions.filter(q => {
        const props = q.properties as ExamQuestionProperties
        return props.is_correct === true
      }).length

      const totalPoints = questions.reduce((sum, q) => {
        const props = q.properties as ExamQuestionProperties
        return sum + (props.points || 0)
      }, 0)

      const earnedPoints = questions.reduce((sum, q) => {
        const props = q.properties as ExamQuestionProperties
        return sum + (props.is_correct ? (props.points || 0) : 0)
      }, 0)

      const incorrectQuestions = questions.filter(q => {
        const props = q.properties as ExamQuestionProperties
        return props.user_answer !== undefined && props.is_correct === false
      })

      return {
        totalQuestions,
        answeredCount,
        correctCount,
        incorrectCount: answeredCount - correctCount,
        unansweredCount: totalQuestions - answeredCount,
        totalPoints,
        earnedPoints,
        score: totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0,
        percentage: totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0,
        incorrectQuestions  // 오답 문제 목록
      }
    } catch (error) {
      console.error('Error calculating exam stats:', error)
      throw error
    }
  }, [getExamQuestions])

  /**
   * 시험 삭제 (모든 문제도 함께 삭제)
   */
  const deleteExam = useCallback(async (examId: string) => {
    try {
      // CASCADE 설정으로 자식 문제들도 자동 삭제됨
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', examId)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting exam:', error)
      throw error
    }
  }, [])

  /**
   * 시험 문제 삭제
   */
  const deleteExamQuestion = useCallback(async (questionId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', questionId)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting exam question:', error)
      throw error
    }
  }, [])

  /**
   * 시험 업데이트
   */
  const updateExam = useCallback(async (examId: string, updates: Partial<Task>) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', examId)

      if (error) throw error
    } catch (error) {
      console.error('Error updating exam:', error)
      throw error
    }
  }, [])

  /**
   * 시험 문제 업데이트
   */
  const updateExamQuestion = useCallback(async (questionId: string, updates: Partial<Task>) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', questionId)

      if (error) throw error
    } catch (error) {
      console.error('Error updating exam question:', error)
      throw error
    }
  }, [])

  /**
   * 시험 초기화 (모든 답안 삭제)
   */
  const resetExam = useCallback(async (examId: string) => {
    try {
      const questions = await getExamQuestions(examId)

      const updates = questions.map(q => {
        const props = q.properties as ExamQuestionProperties
        return supabase
          .from('tasks')
          .update({
            properties: {
              ...props,
              user_answer: undefined,
              is_correct: undefined
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', q.id)
      })

      await Promise.all(updates)
    } catch (error) {
      console.error('Error resetting exam:', error)
      throw error
    }
  }, [getExamQuestions])

  return {
    createExam,
    createExamQuestion,
    createExamQuestions,
    submitAnswer,
    getExamQuestions,
    calculateExamStats,
    deleteExam,
    deleteExamQuestion,
    updateExam,
    updateExamQuestion,
    resetExam
  }
}

