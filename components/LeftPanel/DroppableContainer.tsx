'use client'

import { useDroppable } from '@dnd-kit/core'

interface DroppableContainerProps {
  id: string
  title: string
  count?: number
  children: React.ReactNode
  className?: string
  scrollRef?: React.RefObject<HTMLDivElement | null>
  titleColor?: string
}

export default function DroppableContainer({ 
  id, 
  title, 
  count, 
  children, 
  className, 
  scrollRef,
  titleColor
}: DroppableContainerProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  const getTitleClass = () => {
    if (title === "THE FOCUS") return 'text-gray-900 font-black text-sm tracking-wide'
    if (titleColor) return titleColor + ' font-extrabold'
    if (title === "Today's Focus") return 'text-red-600 font-extrabold'
    if (title === "Today's Task") return 'text-green-600 font-extrabold'
    return 'font-semibold text-gray-900'
  }

  return (
    <div ref={setNodeRef} className={`${className || ''} ${isOver ? 'bg-blue-50/50' : ''}`}>
      <h2 className={`text-xs mb-1.5 px-4 pt-2.5 ${getTitleClass()}`}>
        {title} {count !== undefined && <span className="text-gray-400 font-normal">({count})</span>}
      </h2>
      <div ref={scrollRef} className="px-4 pb-2">
        {children}
      </div>
    </div>
  )
}

