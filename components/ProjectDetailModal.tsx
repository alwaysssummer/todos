'use client'

import { useState } from 'react'
import { X, Calendar, Edit2, Trash2, CheckCircle, BookOpen } from 'lucide-react'
import type { Project } from '@/types/database'
import { useTextbooks } from '@/hooks/useTextbooks'

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
  const [isEditing, setIsEditing] = useState(true)
  const [name, setName] = useState(project.name)
  const [color, setColor] = useState(project.color)
  const [status, setStatus] = useState(project.status || 'active')
  const [startDate, setStartDate] = useState(project.start_date?.split('T')[0] || '')
  const [endDate, setEndDate] = useState(project.end_date?.split('T')[0] || '')
  const [noEndDate, setNoEndDate] = useState(!project.end_date)
  const [scheduleTemplate, setScheduleTemplate] = useState(project.schedule_template || [])
  const [repeatDays, setRepeatDays] = useState(project.repeat_days || [])
  const [targetTime, setTargetTime] = useState(project.target_time || '07:00')
  const [targetDuration, setTargetDuration] = useState(project.target_duration || 30)
  const [assignedTextbooks, setAssignedTextbooks] = useState<string[]>(project.textbooks || [])
  const [isPrivate, setIsPrivate] = useState(project.is_private || false)
  const [tuition, setTuition] = useState<number | ''>(project.tuition || '')
  const [tuitionPaid, setTuitionPaid] = useState(project.tuition_paid || false)
  
  const { textbooks, cleanTextbookDataFromTasks } = useTextbooks()

  const colors = [
    '#bae6fd', // 연한 하늘색 - 30분
    '#38bdf8', // 하늘색 - 40분
    '#2563eb', // 진한 파란색 - 50분
    '#f97316', // 오렌지색 - 30분
  ]

  // 색상별 수업 시간 매핑
  const colorToDuration: Record<string, number> = {
    '#bae6fd': 30,  // 연한 하늘색
    '#38bdf8': 40,  // 하늘색
    '#2563eb': 50,  // 진한 파란색
    '#f97316': 30,  // 오렌지색
  }

  const dayNames = ['일', '월', '화', '수', '목', '금', '토']

  // 색상 변경 핸들러
  const handleColorChange = (newColor: string) => {
    setColor(newColor)
    
    // 색상에 맞는 수업 시간으로 자동 업데이트
    const newDuration = colorToDuration[newColor] || 40
    
    // 이미 등록된 모든 요일의 수업 시간을 업데이트
    setScheduleTemplate(scheduleTemplate.map(s => ({
      ...s,
      duration: newDuration
    })))
  }

  const toggleScheduleDay = (day: number) => {
    const existing = scheduleTemplate.find(s => s.day === day)
    if (existing) {
      setScheduleTemplate(scheduleTemplate.filter(s => s.day !== day))
    } else {
      // 현재 선택된 색상의 수업 시간으로 자동 설정
      const defaultDuration = colorToDuration[color] || 40
      setScheduleTemplate([...scheduleTemplate, { day, time: '09:00', duration: defaultDuration }])
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
      updates.end_date = noEndDate ? undefined : (endDate || undefined)
      updates.schedule_template = scheduleTemplate
      updates.textbooks = assignedTextbooks // 교재 배정 저장
      updates.is_private = isPrivate
      updates.tuition = tuition === '' ? undefined : Number(tuition)
      updates.tuition_paid = tuitionPaid
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

    // 저장 후 모달 닫기
    onClose()
  }

  // 교재 추가
  const handleAddTextbook = (textbookId: string) => {
    if (!textbookId || assignedTextbooks.includes(textbookId)) return
    if (assignedTextbooks.length >= 4) {
      alert('교재는 최대 4개까지 배정할 수 있습니다.')
      return
    }
    setAssignedTextbooks([...assignedTextbooks, textbookId])
  }

  // 교재 제거
  const handleRemoveTextbook = async (index: number) => {
    const textbookId = assignedTextbooks[index]
    const textbook = textbooks.find(t => t.id === textbookId)

    const confirmed = confirm(
      `"${textbook?.name || '이 교재'}"를 제거하시겠습니까?\n\n` +
      `⚠️ 이 교재와 관련된 모든 과제 데이터가 삭제됩니다.\n` +
      `(다시 추가하면 처음부터 시작됩니다)`
    )

    if (!confirmed) return

    try {
      // 프로젝트에서 교재 제거
      const updated = assignedTextbooks.filter((_, i) => i !== index)
      setAssignedTextbooks(updated)
      
      // DB 즉시 저장
      await onUpdateProject(project.id, { textbooks: updated })

      // 모든 수업에서 해당 교재 과제 데이터 제거
      await cleanTextbookDataFromTasks(project.id, textbookId)

      alert(`"${textbook?.name || '교재'}"가 제거되었고, 관련 과제 데이터가 정리되었습니다.`)
    } catch (error) {
      console.error('Error removing textbook:', error)
      alert('교재 제거 중 오류가 발생했습니다.')
    }
  }

  // 배정 가능한 교재 (이미 배정된 것 제외)
  const availableTextbooks = textbooks.filter(
    t => !assignedTextbooks.includes(t.id)
  )

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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  색상 <span className="text-xs text-gray-500">(수업 시간 자동 설정)</span>
                </label>
                <div className="flex gap-2 items-end">
                  {colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => handleColorChange(c)}
                      className={`flex flex-col items-center gap-0.5 transition-transform ${
                        color === c ? 'ring-2 ring-offset-1 ring-blue-500 scale-110' : ''
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded-full"
                        style={{ backgroundColor: c }}
                      />
                      <span className="text-[10px] text-gray-600 font-medium">
                        {colorToDuration[c]}분
                      </span>
                    </button>
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
                      <div className="flex flex-col gap-2">
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          disabled={noEndDate}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                        />
                        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={noEndDate}
                            onChange={(e) => {
                              setNoEndDate(e.target.checked)
                              if (!e.target.checked && !endDate) {
                                // 체크 해제 시 기본값(6개월) 복원
                                const sixMonthsLater = new Date()
                                sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6)
                                setEndDate(sixMonthsLater.toISOString().split('T')[0])
                              }
                            }}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          종료일 없음 (계속 반복)
                        </label>
                      </div>
                    ) : (
                      <div className="text-gray-900">{endDate || '진행 중'}</div>
                    )}
                  </div>
                </div>

                {/* 수업료 입력 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    수업료 <span className="text-xs text-gray-500">(만원 단위)</span>
                  </label>
                  {isEditing ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={tuition}
                          onChange={(e) => setTuition(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="12"
                          min="0"
                          step="1"
                          className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-600">만원</span>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tuitionPaid}
                          onChange={(e) => setTuitionPaid(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span>납부 완료</span>
                      </label>
                    </div>
                  ) : (
                    <div className="text-gray-900">
                      {tuition ? `${tuition}만원` : '미설정'}
                      {tuitionPaid && ' (납부 완료)'}
                    </div>
                  )}
                </div>

                {/* 비공개 체크박스 */}
                <div>
                  {isEditing ? (
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPrivate}
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="font-medium">🔒 비공개 수업</span>
                    </label>
                  ) : (
                    <div className="text-sm text-gray-700">
                      {isPrivate ? '🔒 비공개 수업' : '공개 수업'}
                    </div>
                  )}
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

                {/* 교재 배정 (Phase 5) */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    배정 교재 (최대 4개)
                  </label>

                  {/* 현재 배정된 교재 목록 */}
                  <div className="space-y-2 mb-4">
                    {assignedTextbooks.length === 0 ? (
                      <div className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">
                        배정된 교재가 없습니다
                      </div>
                    ) : (
                      assignedTextbooks.map((textbookId, idx) => {
                        const textbook = textbooks.find(t => t.id === textbookId)
                        if (!textbook) return null

                        return (
                          <div 
                            key={idx}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <div className="flex items-center gap-2">
                              <BookOpen size={16} className="text-gray-600" />
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {textbook.name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  총 {textbook.total_chapters}
                                  {textbook.chapter_unit === '직접입력' 
                                    ? textbook.custom_chapter_unit 
                                    : textbook.chapter_unit}
                                </div>
                              </div>
                            </div>

                            {isEditing && (
                              <button
                                onClick={() => handleRemoveTextbook(idx)}
                                className="px-3 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                              >
                                제거
                              </button>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>

                  {/* 교재 추가 */}
                  {isEditing && assignedTextbooks.length < 4 && (
                    <div>
                      <select
                        onChange={(e) => {
                          handleAddTextbook(e.target.value)
                          e.target.value = '' // 초기화
                        }}
                        value=""
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">+ 교재 추가...</option>
                        {availableTextbooks.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.total_chapters}{t.chapter_unit === '직접입력' ? t.custom_chapter_unit : t.chapter_unit})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* 안내 메시지 */}
                  {!isEditing && assignedTextbooks.length > 0 && (
                    <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded mt-2">
                      💡 교재를 제거하면 해당 교재의 모든 과제 데이터가 초기화됩니다.
                    </div>
                  )}
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
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              저장
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

