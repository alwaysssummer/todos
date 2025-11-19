'use client'

import { useState } from 'react'
import { X, Calendar, Edit2, Trash2, CheckCircle } from 'lucide-react'
import type { Project } from '@/types/database'

interface ProjectDetailModalProps {
  project: Project
  onClose: () => void
  onUpdateProject: (id: string, updates: Partial<Project>) => Promise<void>
  onDeleteProject: (id: string) => Promise<void>
  onRegenerateSchedule?: (project: Project) => Promise<void>
}

export default function ProjectDetailModal({ 
  project, 
  onClose, 
  onUpdateProject, 
  onDeleteProject,
  onRegenerateSchedule 
}: ProjectDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(project.name)
  const [color, setColor] = useState(project.color)
  const [status, setStatus] = useState(project.status || 'active')
  const [startDate, setStartDate] = useState(project.start_date?.split('T')[0] || '')
  const [endDate, setEndDate] = useState(project.end_date?.split('T')[0] || '')
  const [scheduleTemplate, setScheduleTemplate] = useState(project.schedule_template || [])
  const [repeatDays, setRepeatDays] = useState(project.repeat_days || [])
  const [targetTime, setTargetTime] = useState(project.target_time || '07:00')
  const [targetDuration, setTargetDuration] = useState(project.target_duration || 30)

  const colors = [
    '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6',
    '#ef4444', '#ec4899', '#14b8a6', '#f97316',
  ]

  const dayNames = ['일', '월', '화', '수', '목', '금', '토']

  const toggleScheduleDay = (day: number) => {
    const existing = scheduleTemplate.find(s => s.day === day)
    if (existing) {
      setScheduleTemplate(scheduleTemplate.filter(s => s.day !== day))
    } else {
      setScheduleTemplate([...scheduleTemplate, { day, time: '09:00', duration: 40 }])
    }
  }

  const updateScheduleTime = (day: number, time: string) => {
    setScheduleTemplate(scheduleTemplate.map(s => 
      s.day === day ? { ...s, time } : s
    ))
  }

  const updateScheduleDuration = (day: number, duration: number) => {
    setScheduleTemplate(scheduleTemplate.map(s => 
      s.day === day ? { ...s, duration } : s
    ))
  }

  const toggleRepeatDay = (day: number) => {
    if (repeatDays.includes(day)) {
      setRepeatDays(repeatDays.filter(d => d !== day))
    } else {
      setRepeatDays([...repeatDays, day].sort())
    }
  }

  const handleSave = async () => {
    const updates: Partial<Project> = {
      name,
      color,
      status,
    }

    let scheduleChanged = false

    if (project.type === 'student') {
      // 정규 시간표가 변경되었는지 확인
      const originalSchedule = JSON.stringify(project.schedule_template)
      const newSchedule = JSON.stringify(scheduleTemplate)
      scheduleChanged = originalSchedule !== newSchedule

      updates.start_date = startDate
      updates.end_date = endDate || undefined
      updates.schedule_template = scheduleTemplate
    } else if (project.type === 'habit') {
      updates.start_date = startDate
      updates.repeat_days = repeatDays
      updates.target_time = targetTime
      updates.target_duration = targetDuration
    }

    await onUpdateProject(project.id, updates)

    // 정규 시간표가 변경되었으면 미래 수업 재생성
    if (scheduleChanged && onRegenerateSchedule) {
      const updatedProject = { ...project, ...updates }
      await onRegenerateSchedule(updatedProject)
    }

    setIsEditing(false)
  }

  const handleDelete = async () => {
    if (confirm(`"${project.name}" 프로젝트를 삭제하시겠습니까?\n관련된 모든 태스크도 삭제됩니다.`)) {
      await onDeleteProject(project.id)
      onClose()
    }
  }

  const handleToggleStatus = async () => {
    const newStatus = status === 'active' ? 'completed' : 'active'
    await onUpdateProject(project.id, { status: newStatus })
    setStatus(newStatus)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: color }}
              />
              {isEditing ? (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-lg font-semibold text-gray-900 border-b-2 border-blue-500 focus:outline-none"
                  autoFocus
                />
              ) : (
                <h2 className="text-lg font-semibold text-gray-900">{name}</h2>
              )}
              <span className={`text-xs px-2 py-1 rounded-full ${
                status === 'active' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {status === 'active' ? '진행중' : '완료'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    저장
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                  title="수정"
                >
                  <Edit2 size={18} />
                </button>
              )}
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* 색상 선택 (편집 모드) */}
            {isEditing && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">색상</label>
                <div className="flex gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 학생 시간표 */}
            {project.type === 'student' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">시작일</label>
                    {isEditing ? (
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="text-gray-900">{startDate}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">종료일</label>
                    {isEditing ? (
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="text-gray-900">{endDate || '진행 중'}</div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">정규 시간표</label>
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                      const schedule = scheduleTemplate.find(s => s.day === day)
                      const isChecked = !!schedule
                      
                      return (
                        <div key={day} className="flex items-center gap-3">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => toggleScheduleDay(day)}
                                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                  isChecked ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'
                                }`}
                              >
                                {isChecked && <span className="text-white text-xs">✓</span>}
                              </button>
                              <span className="w-8 text-sm font-medium text-gray-700">{dayNames[day]}</span>
                              {isChecked && (
                                <>
                                  <div className="flex gap-1">
                                    <select
                                      value={schedule?.time.split(':')[0] || '09'}
                                      onChange={(e) => {
                                        const currentMinute = schedule?.time.split(':')[1] || '00'
                                        updateScheduleTime(day, `${e.target.value}:${currentMinute}`)
                                      }}
                                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                      {Array.from({ length: 15 }, (_, i) => i + 9).map((hour) => (
                                        <option key={hour} value={hour.toString().padStart(2, '0')}>
                                          {hour.toString().padStart(2, '0')}
                                        </option>
                                      ))}
                                    </select>
                                    <span className="text-sm self-center">:</span>
                                    <select
                                      value={schedule?.time.split(':')[1] || '00'}
                                      onChange={(e) => {
                                        const currentHour = schedule?.time.split(':')[0] || '09'
                                        updateScheduleTime(day, `${currentHour}:${e.target.value}`)
                                      }}
                                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                      {['00', '10', '20', '30', '40', '50'].map(min => (
                                        <option key={min} value={min}>{min}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <select
                                    value={schedule?.duration || 40}
                                    onChange={(e) => updateScheduleDuration(day, Number(e.target.value))}
                                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  >
                                    <option value={30}>30분</option>
                                    <option value={40}>40분</option>
                                    <option value={60}>60분</option>
                                    <option value={90}>90분</option>
                                    <option value={120}>120분</option>
                                  </select>
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="w-8 text-sm font-medium text-gray-700">{dayNames[day]}</span>
                              {isChecked ? (
                                <span className="text-sm text-gray-600">
                                  {schedule?.time} ({schedule?.duration}분)
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}

            {/* 루틴/습관 */}
            {project.type === 'habit' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">반복 요일</label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                        <button
                          key={day}
                          onClick={() => toggleRepeatDay(day)}
                          className={`w-10 h-10 rounded-full border-2 transition-all ${
                            repeatDays.includes(day)
                              ? 'bg-amber-500 border-amber-500 text-white font-semibold'
                              : 'border-gray-300 text-gray-600 hover:border-amber-400'
                          }`}
                        >
                          {dayNames[day]}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {repeatDays.map((day) => (
                        <span key={day} className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">
                          {dayNames[day]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">목표 시간</label>
                    {isEditing ? (
                      <input
                        type="time"
                        value={targetTime}
                        onChange={(e) => setTargetTime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="text-gray-900">{targetTime}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">소요 시간</label>
                    {isEditing ? (
                      <select
                        value={targetDuration}
                        onChange={(e) => setTargetDuration(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={15}>15분</option>
                        <option value={30}>30분</option>
                        <option value={45}>45분</option>
                        <option value={60}>60분</option>
                        <option value={90}>90분</option>
                      </select>
                    ) : (
                      <div className="text-gray-900">{targetDuration}분</div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* 일반 폴더 */}
            {project.type === 'folder' && (
              <div className="text-center py-8 text-gray-500">
                일반 폴더는 태스크를 그룹핑하는 용도입니다.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <div className="flex gap-2">
            <button
              onClick={handleToggleStatus}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                status === 'active'
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              <CheckCircle size={16} />
              {status === 'active' ? '완료 처리' : '재개하기'}
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium flex items-center gap-2"
            >
              <Trash2 size={16} />
              삭제
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

