import { useState, useRef, useCallback } from 'react'

export type SwipeDirection = 'left' | 'right' | null

interface UseSwipeGestureOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  threshold?: number // 스와이프로 인식할 최소 거리 (px)
  velocityThreshold?: number // 스와이프 속도 임계값
}

interface SwipeState {
  isSwiping: boolean
  direction: SwipeDirection
  distance: number
}

export function useSwipeGesture(options: UseSwipeGestureOptions = {}) {
  const {
    onSwipeLeft,
    onSwipeRight,
    threshold = 50,
    velocityThreshold = 0.3
  } = options

  const [swipeState, setSwipeState] = useState<SwipeState>({
    isSwiping: false,
    direction: null,
    distance: 0
  })

  const touchStartX = useRef<number>(0)
  const touchStartY = useRef<number>(0)
  const touchStartTime = useRef<number>(0)
  const currentX = useRef<number>(0)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartX.current = touch.clientX
    touchStartY.current = touch.clientY
    touchStartTime.current = Date.now()
    currentX.current = touch.clientX
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartX.current) return

    const touch = e.touches[0]
    currentX.current = touch.clientX
    const deltaX = touch.clientX - touchStartX.current
    const deltaY = touch.clientY - touchStartY.current

    // 수평 스와이프인지 확인 (수직 스크롤과 구분)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      // 수평 스와이프 진행 중
      setSwipeState({
        isSwiping: true,
        direction: deltaX > 0 ? 'right' : 'left',
        distance: Math.abs(deltaX)
      })
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (!swipeState.isSwiping) {
      setSwipeState({ isSwiping: false, direction: null, distance: 0 })
      return
    }

    const deltaX = currentX.current - touchStartX.current
    const deltaTime = Date.now() - touchStartTime.current
    const velocity = Math.abs(deltaX) / deltaTime

    // 충분한 거리 또는 속도로 스와이프 했는지 확인
    if (Math.abs(deltaX) > threshold || velocity > velocityThreshold) {
      if (deltaX > 0) {
        // 오른쪽 스와이프
        onSwipeRight?.()
      } else {
        // 왼쪽 스와이프
        onSwipeLeft?.()
      }
    }

    // 상태 초기화
    setSwipeState({ isSwiping: false, direction: null, distance: 0 })
    touchStartX.current = 0
    touchStartY.current = 0
    currentX.current = 0
  }, [swipeState.isSwiping, threshold, velocityThreshold, onSwipeLeft, onSwipeRight])

  const handleTouchCancel = useCallback(() => {
    setSwipeState({ isSwiping: false, direction: null, distance: 0 })
    touchStartX.current = 0
    touchStartY.current = 0
    currentX.current = 0
  }, [])

  return {
    swipeState,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel
    }
  }
}
