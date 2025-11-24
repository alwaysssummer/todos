import React, { useState, useEffect } from 'react'
import { format, isPast, isFuture, isToday } from 'date-fns'
import { ko } from 'date-fns/locale'
import { X, Calendar, MapPin, Cloud, Smile, Image, Tag, Lock, Trash2 } from 'lucide-react'
import type { DailyNote, DailyNoteCategory, Weather, Mood } from '@/types/database'

interface DailyNoteModalProps {
  date: Date
  existingNote?: DailyNote | null
  onSave: (note: Omit<DailyNote, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  onUpdate?: (id: string, updates: Partial<DailyNote>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onClose: () => void
}

const EMOJI_PRESETS = ['📅', '✨', '💡', '🎯', '🎉', '💪', '🎨', '📚', '✈️', '🎭', '🎵', '⚡']

const CATEGORY_OPTIONS: { value: DailyNoteCategory; label: string; emoji: string }[] = [
  { value: 'diary', label: '일기', emoji: '📔' },
  { value: 'event', label: '이벤트', emoji: '🎉' },
  { value: 'travel', label: '여행', emoji: '✈️' },
  { value: 'memory', label: '추억', emoji: '💭' }
]

const WEATHER_OPTIONS: { value: Weather; emoji: string }[] = [
  { value: 'sunny', emoji: '☀️' },
  { value: 'cloudy', emoji: '☁️' },
  { value: 'rainy', emoji: '🌧️' },
  { value: 'snowy', emoji: '❄️' }
]

const MOOD_OPTIONS: { value: Mood; emoji: string; label: string }[] = [
  { value: 5, emoji: '😍', label: '최고' },
  { value: 4, emoji: '😊', label: '좋음' },
  { value: 3, emoji: '😐', label: '보통' },
  { value: 2, emoji: '😕', label: '나쁨' },
  { value: 1, emoji: '😢', label: '최악' }
]

export function DailyNoteModal({
  date,
  existingNote,
  onSave,
  onUpdate,
  onDelete,
  onClose
}: DailyNoteModalProps) {
  const isEdit = !!existingNote
  
  const [emoji, setEmoji] = useState(existingNote?.emoji || '📅')
  const [title, setTitle] = useState(existingNote?.title || '')
  const [content, setContent] = useState(existingNote?.content || '')
  const [category, setCategory] = useState<DailyNoteCategory>(existingNote?.category || 'diary')
  const [weather, setWeather] = useState<Weather | undefined>(existingNote?.weather)
  const [mood, setMood] = useState<Mood | undefined>(existingNote?.mood)
  const [tags, setTags] = useState<string[]>(existingNote?.tags || [])
  const [tagInput, setTagInput] = useState('')
  const [isPrivate, setIsPrivate] = useState(existingNote?.is_private || false)
  const [saving, setSaving] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  const getPlaceholder = () => {
    if (isToday(date)) {
      return category === 'diary' ? '오늘 어떤 일이 있었나요?' : '오늘의 이벤트를 기록하세요'
    } else if (isPast(date)) {
      return category === 'diary' ? '그날의 기억을 되새겨 보세요' : '과거의 이벤트를 기록하세요'
    } else {
      return category === 'diary' ? '미래의 계획을 적어보세요' : '다가올 이벤트를 기록하세요'
    }
  }
  
  const handleSave = async () => {
    if (!title.trim()) {
      alert('제목을 입력해주세요')
      return
    }
    
    setSaving(true)
    try {
      const noteData = {
        date: format(date, 'yyyy-MM-dd'),
        title: title.trim(),
        content: content.trim() || undefined,
        emoji,
        category,
        weather,
        mood,
        tags: tags.length > 0 ? tags : undefined,
        is_private: isPrivate
      }
      
      if (isEdit && onUpdate && existingNote) {
        await onUpdate(existingNote.id, noteData)
      } else {
        await onSave(noteData)
      }
      
      onClose()
    } catch (error) {
      console.error('Error saving daily note:', error)
      alert('저장 중 오류가 발생했습니다')
    } finally {
      setSaving(false)
    }
  }
  
  const handleDelete = async () => {
    if (!existingNote || !onDelete) return
    if (!confirm('이 기록을 삭제하시겠습니까?')) return
    
    try {
      await onDelete(existingNote.id)
      onClose()
    } catch (error) {
      console.error('Error deleting daily note:', error)
      alert('삭제 중 오류가 발생했습니다')
    }
  }
  
  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }
  
  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-500" />
            <div>
              <h3 className="font-semibold text-lg">
                {format(date, 'yyyy년 M월 d일 (E)', { locale: ko })}
              </h3>
              <p className="text-xs text-gray-500">
                {isEdit ? '기록 수정' : '새로운 기록'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* 내용 */}
        <div className="px-6 py-4 space-y-4">
          {/* 이모지 + 카테고리 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{emoji}</span>
              <select
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                {EMOJI_PRESETS.map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
            
            <div className="flex gap-1">
              {CATEGORY_OPTIONS.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    category === cat.value
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* 제목 */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-medium"
            autoFocus
          />
          
          {/* 내용 */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={getPlaceholder()}
            rows={6}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          
          {/* 날씨 + 기분 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-gray-400" />
              <div className="flex gap-1">
                {WEATHER_OPTIONS.map(w => (
                  <button
                    key={w.value}
                    onClick={() => setWeather(weather === w.value ? undefined : w.value)}
                    className={`text-xl px-2 py-1 rounded transition-all ${
                      weather === w.value ? 'bg-blue-100 scale-110' : 'hover:bg-gray-100'
                    }`}
                  >
                    {w.emoji}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Smile className="w-4 h-4 text-gray-400" />
              <div className="flex gap-1">
                {MOOD_OPTIONS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setMood(mood === m.value ? undefined : m.value)}
                    title={m.label}
                    className={`text-xl px-2 py-1 rounded transition-all ${
                      mood === m.value ? 'bg-blue-100 scale-110' : 'hover:bg-gray-100'
                    }`}
                  >
                    {m.emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* 태그 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="태그 추가 (Enter)"
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
                  >
                    #{tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          
          {/* 비공개 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="w-4 h-4"
            />
            <Lock className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-700">비공개 기록</span>
          </label>
        </div>
        
        {/* 푸터 */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            {isEdit && onDelete && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                삭제
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? '저장 중...' : isEdit ? '수정' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

