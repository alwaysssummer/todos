'use client'

import { useDroppable } from '@dnd-kit/core'

interface DroppableContainerProps {
  id: string
  title: string
  count?: number
  children: React.ReactNode
  className?: string
  scrollRef?: React.RefObject<HTMLDivElement | null>
}

export default function DroppableContainer({ 
  id, 
  title, 
  count, 
  children, 
  className, 
  scrollRef 
}: DroppableContainerProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div ref={setNodeRef} className={`flex-1 flex flex-col ${className} ${isOver ? 'bg-blue-50/50' : ''}`}>
      <h2 className={`text-xs mb-1.5 px-4 pt-2.5 ${
        title === "Today's Focus" 
          ? 'text-red-600 font-extrabold' 
          : title === "Today's Task"
            ? 'text-green-600 font-extrabold'
            : 'font-semibold text-gray-900'
      }`}>
        {title} {count !== undefined && <span className="text-gray-400 font-normal">({count})</span>}
      </h2>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-2">
        {children}
      </div>
    </div>
  )
}

