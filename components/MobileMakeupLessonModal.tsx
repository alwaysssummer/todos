'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { Project, Task } from '@/types/database'
import { format } from 'date-fns'

interface MobileMakeupLessonModalProps {
  onClose: () => void
  onCreate: (task: Partial<Task>) => Promise<void>
  projects: Project[]
  currentDate: Date
}

export default function MobileMakeupLessonModal({
  onClose,
  onCreate,
  projects,
  currentDate
}: MobileMakeupLessonModalProps) {
  // 학생 프로젝트만 필터링
  const studentProjects = projects.filter(p => p.type === 'student')

  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('PM')
  const [selectedHour, setSelectedHour] = useState<string>('')
  const [selectedMinute, setSelectedMinute] = useState<string>('00')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 시간 옵션 (1~12시)
  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'))
  const minutes = ['00', '10', '20', '30', '40', '50']

  // 초기 시간 설정 (현재 시각)
  useEffect(() => {
    const now = new Date()
    const hour = now.getHours()
    if (hour >= 12) {
      setSelectedPeriod('PM')
      setSelectedHour(hour === 12 ? '12' : (hour - 12).toString().padStart(2, '0'))
    } else {
      setSelectedPeriod('AM')
      setSelectedHour(hour === 0 ? '12' : hour.toString().padStart(2, '0'))
    }
    setSelectedMinute('00')
  }, [])

  // 첫 번째 학생 자동 선택
  useEffect(() => {
    if (studentProjects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(studentProjects[0].id)
    }
  }, [studentProjects, selectedProjectId])

  const handleSubmit = async () => {
    if (!selectedProjectId || !selectedHour) {
      alert('학생과 시간을 선택해주세요.')
      return
    }

    setIsSubmitting(true)

    try {
      const selectedProject = studentProjects.find(p => p.id === selectedProjectId)
      if (!selectedProject) return

      // 12시간제를 24시간제로 변환
      let hour = parseInt(selectedHour)
      if (selectedPeriod === 'PM' && hour !== 12) {
        hour += 12
      } else if (selectedPeriod === 'AM' && hour === 12) {
        hour = 0
      }
      
      const minute = parseInt(selectedMinute)
      const startTime = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate(),
        hour,
        minute,
        0
      )

      const taskData: Partial<Task> = {
        title: selectedProject.name,
        project_id: selectedProject.id,
        start_time: startTime.toISOString(),
        duration: selectedProject.schedule_template?.[0]?.duration || 40,
        status: 'scheduled',
        is_makeup: true,
        is_auto_generated: false,
        is_top5: false,
        due_date: startTime.toISOString().split('T')[0]
      }

      await onCreate(taskData)
      onClose()
    } catch (error) {
      console.error('Error creating makeup lesson:', error)
      alert('보충 수업 추가에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
      <div className="bg-white rounded-t-2xl w-full max-h-[80vh] flex flex-col animate-slide-up">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">보충 수업 추가</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 날짜 표시 */}
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <div className="text-xs text-blue-600 font-medium mb-0.5">수업 날짜</div>
            <div className="text-sm font-bold text-blue-900">
              {format(currentDate, 'yyyy년 M월 d일 EEEE', { locale: require('date-fns/locale/ko').ko })}
            </div>
          </div>

          {/* 학생 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              학생 선택
            </label>
            {studentProjects.length === 0 ? (
              <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg text-center">
                학생 프로젝트가 없습니다.
              </div>
            ) : (
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {studentProjects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 시간 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              수업 시간
            </label>
            <div className="flex gap-2">
              {/* 오전/오후 선택 */}
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value as 'AM' | 'PM')}
                className="w-20 px-2 py-2.5 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="AM">오전</option>
                <option value="PM">오후</option>
              </select>

              {/* 시 선택 */}
              <select
                value={selectedHour}
                onChange={(e) => setSelectedHour(e.target.value)}
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">시</option>
                {hours.map(hour => (
                  <option key={hour} value={hour}>
                    {hour}시
                  </option>
                ))}
              </select>

              {/* 분 선택 */}
              <select
                value={selectedMinute}
                onChange={(e) => setSelectedMinute(e.target.value)}
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {minutes.map(minute => (
                  <option key={minute} value={minute}>
                    {minute}분
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 수업 시간 정보 */}
          {selectedProjectId && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">수업 시간</div>
              <div className="text-sm font-medium text-gray-900">
                {studentProjects.find(p => p.id === selectedProjectId)?.schedule_template?.[0]?.duration || 40}분
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="p-4 border-t border-gray-200 space-y-2">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedProjectId || !selectedHour}
            className="w-full py-3 bg-yellow-500 text-white font-medium rounded-lg hover:bg-yellow-600 active:bg-yellow-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? '추가 중...' : '보충 수업 추가'}
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
