'use client'

import { useEffect } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import type { Task } from '@/types/database'
import { useSwipeGesture } from '@/hooks/useSwipeGesture'

interface SwipeableTaskItemProps {
  task: Task
  children: React.ReactNode
  onSwipeLeft: () => void
  onSwipeRight: () => void
  isSwiping: boolean
  onSwipingChange: (swiping: boolean) => void
}

export default function SwipeableTaskItem({
  task,
  children,
  onSwipeLeft,
  onSwipeRight,
  isSwiping,
  onSwipingChange
}: SwipeableTaskItemProps) {
  const { swipeState, handlers } = useSwipeGesture({
    onSwipeLeft,
    onSwipeRight,
    threshold: 80
  })

  useEffect(() => {
    onSwipingChange(swipeState.isSwiping)
  }, [swipeState.isSwiping, onSwipingChange])

  // 스와이프 진행률 계산 (0~1)
  const progress = Math.min(swipeState.distance / 120, 1)
  const translateX = swipeState.isSwiping 
    ? (swipeState.direction === 'left' ? -swipeState.distance * 0.3 : swipeState.distance * 0.3)
    : 0

  return (
    <div className="relative overflow-hidden">
      {/* 배경 인디케이터 */}
      {swipeState.isSwiping && (
        <>
          {swipeState.direction === 'left' && (
            <div 
              className="absolute inset-y-0 right-0 flex items-center justify-end px-6 transition-all"
              style={{
                width: `${swipeState.distance}px`,
                backgroundColor: `rgba(16, 185, 129, ${progress * 0.3})` // green-500
              }}
            >
              <ChevronUp 
                size={28} 
                className="text-green-600"
                style={{ opacity: progress }}
              />
            </div>
          )}
          {swipeState.direction === 'right' && (
            <div 
              className="absolute inset-y-0 left-0 flex items-center justify-start px-6 transition-all"
              style={{
                width: `${swipeState.distance}px`,
                backgroundColor: `rgba(59, 130, 246, ${progress * 0.3})` // blue-500
              }}
            >
              <ChevronDown 
                size={28} 
                className="text-blue-600"
                style={{ opacity: progress }}
              />
            </div>
          )}
        </>
      )}
      
      {/* 실제 컨텐츠 */}
      <div
        {...handlers}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: swipeState.isSwiping ? 'none' : 'transform 0.2s ease-out'
        }}
        className="relative bg-white"
      >
        {children}
      </div>
    </div>
  )
}
