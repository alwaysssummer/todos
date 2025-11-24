'use client'

import { useState } from 'react'
import { X, Folder, GraduationCap, Repeat } from 'lucide-react'
import type { Project } from '@/types/database'
import { useScheduleManager } from '@/hooks/useScheduleManager'

interface ProjectCreateModalProps {
  onClose: () => void
  onCreateProject: (project: Partial<Project>) => Promise<Project>
  onGenerateTasks?: (tasks: any[]) => Promise<void>
  refetchTasks?: () => void
}

type ProjectType = 'folder' | 'student' | 'habit'

export default function ProjectCreateModal({ onClose, onCreateProject, onGenerateTasks, refetchTasks }: ProjectCreateModalProps) {
  const { syncProjectSchedule } = useScheduleManager()
  const [step, setStep] = useState<'type' | 'config'>('type')
  const [selectedType, setSelectedType] = useState<ProjectType>('folder')

  // 공통 필드
  const [name, setName] = useState('')
  const [color, setColor] = useState('#38bdf8') // 기본값: 하늘색

  // 학생 시간표 필드
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(() => {
    // 기본값: 6개월 후
    const sixMonthsLater = new Date()
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6)
    return sixMonthsLater.toISOString().split('T')[0]
  })
  const [noEndDate, setNoEndDate] = useState(false)
  const [scheduleTemplate, setScheduleTemplate] = useState<{ day: number, time: string, duration: number }[]>([])
  const [isPrivate, setIsPrivate] = useState(false)
  const [tuition, setTuition] = useState<number | ''>('')

  // 루틴/습관 필드
  const [repeatDays, setRepeatDays] = useState<number[]>([])
  const [targetTime, setTargetTime] = useState('07:00')
  const [targetDuration, setTargetDuration] = useState(30)

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

  const handleCreate = async () => {
    let projectData: Partial<Project> = {
      name,
      color,
      type: selectedType,
      status: 'active',
    }

    if (selectedType === 'student') {
      projectData = {
        ...projectData,
        start_date: startDate,
        end_date: noEndDate ? undefined : (endDate || undefined),
        schedule_template: scheduleTemplate,
        is_private: isPrivate,
        tuition: tuition === '' ? undefined : Number(tuition),
      }
    } else if (selectedType === 'habit') {
      projectData = {
        ...projectData,
        start_date: startDate,
        repeat_days: repeatDays,
        target_time: targetTime,
        target_duration: targetDuration,
      }
    }

    const project = await onCreateProject(projectData)

    // 자동 스케줄 생성 (학생 시간표만 - useScheduleManager 사용)
    if (selectedType === 'student' && project.schedule_template) {
      await syncProjectSchedule(project)
    }
    // 습관은 향후 구현 가능 (ensureScheduleInRange에서 자동 처리)

    onClose()

    // ✅ refetchTasks로 UI 즉시 업데이트
    if (refetchTasks) {
      refetchTasks()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[500px] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {step === 'type' ? '프로젝트 타입 선택' : '프로젝트 생성'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'type' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-6">프로젝트 타입을 선택하세요</p>

              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => { setSelectedType('folder'); setStep('config') }}
                  className="flex flex-col items-center p-6 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
                >
                  <Folder size={40} className="text-gray-600 mb-3" />
                  <span className="font-medium text-gray-900">일반 폴더</span>
                  <span className="text-xs text-gray-500 mt-1 text-center">태스크 그룹핑</span>
                </button>

                <button
                  onClick={() => { setSelectedType('student'); setStep('config') }}
                  className="flex flex-col items-center p-6 rounded-lg border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 transition-all"
                >
                  <GraduationCap size={40} className="text-green-600 mb-3" />
                  <span className="font-medium text-gray-900">학생 시간표</span>
                  <span className="text-xs text-gray-500 mt-1 text-center">수업 관리</span>
                </button>

                <button
                  onClick={() => { setSelectedType('habit'); setStep('config') }}
                  className="flex flex-col items-center p-6 rounded-lg border-2 border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-all"
                >
                  <Repeat size={40} className="text-amber-600 mb-3" />
                  <span className="font-medium text-gray-900">루틴/습관</span>
                  <span className="text-xs text-gray-500 mt-1 text-center">습관 추적</span>
                </button>
              </div>
            </div>
          )}

          {step === 'config' && (
            <div className="space-y-5">
              {/* 공통: 이름 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {selectedType === 'student' ? '학생 정보' : selectedType === 'habit' ? '습관 이름' : '프로젝트 이름'}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={selectedType === 'student' ? '철수 - 영어' : selectedType === 'habit' ? '아침 운동' : '웹사이트 개발'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              {/* 공통: 색상 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  색상 <span className="text-xs text-gray-500">(수업 시간 자동 설정)</span>
                </label>
                <div className="flex gap-2 items-end">
                  {colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => handleColorChange(c)}
                      className={`flex flex-col items-center gap-0.5 transition-transform ${color === c ? 'ring-2 ring-offset-1 ring-blue-500 scale-110' : ''
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

              {/* 학생 시간표 설정 */}
              {selectedType === 'student' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">시작일</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        종료일
                        <span className="text-xs text-gray-500 ml-2">(기본: 6개월 후)</span>
                      </label>
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
                    </div>
                  </div>

                  {/* 수업료 입력 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      수업료 <span className="text-xs text-gray-500">(만원 단위)</span>
                    </label>
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
                  </div>

                  {/* 비공개 체크박스 */}
                  <div>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPrivate}
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="font-medium">🔒 비공개 수업</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">정규 시간표</label>
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                        const schedule = scheduleTemplate.find(s => s.day === day)
                        const isChecked = !!schedule

                        return (
                          <div key={day} className="flex items-center gap-3">
                            <button
                              onClick={() => toggleScheduleDay(day)}
                              className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isChecked ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'
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
                                  <option value={50}>50분</option>
                                  <option value={60}>60분</option>
                                  <option value={90}>90분</option>
                                  <option value={120}>120분</option>
                                </select>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* 루틴/습관 설정 */}
              {selectedType === 'habit' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">반복 요일</label>
                    <div className="flex gap-2">
                      {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                        <button
                          key={day}
                          onClick={() => toggleRepeatDay(day)}
                          className={`w-10 h-10 rounded-full border-2 transition-all ${repeatDays.includes(day)
                              ? 'bg-amber-500 border-amber-500 text-white font-semibold'
                              : 'border-gray-300 text-gray-600 hover:border-amber-400'
                            }`}
                        >
                          {dayNames[day]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">목표 시간</label>
                      <input
                        type="time"
                        value={targetTime}
                        onChange={(e) => setTargetTime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">소요 시간</label>
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
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          {step === 'config' && (
            <button
              onClick={() => setStep('type')}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              ← 뒤로
            </button>
          )}
          <div className="flex-1" />
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              취소
            </button>
            {step === 'config' && (
              <button
                onClick={handleCreate}
                disabled={!name.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                생성
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

