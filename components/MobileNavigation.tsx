'use client'

type PanelType = 'focus' | 'today' | 'inbox' | 'schedule' | 'notes'

interface MobileNavigationProps {
  activePanel: PanelType
  onPanelChange: (panel: PanelType) => void
}

export default function MobileNavigation({ activePanel, onPanelChange }: MobileNavigationProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-safe">
      <div className="flex items-center justify-around px-1 py-2">
        {/* 1. THE FOCUS */}
        <button
          onClick={() => onPanelChange('focus')}
          className={`flex flex-col items-center gap-0.5 py-1.5 px-2 min-w-[52px] rounded-lg transition-colors ${
            activePanel === 'focus' ? 'bg-blue-50 text-blue-600' : 'text-gray-500'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-[10px] font-medium">Focus</span>
        </button>

        {/* 2. Today's Focus / Today's Task */}
        <button
          onClick={() => onPanelChange('today')}
          className={`flex flex-col items-center gap-0.5 py-1.5 px-2 min-w-[52px] rounded-lg transition-colors ${
            activePanel === 'today' ? 'bg-blue-50 text-blue-600' : 'text-gray-500'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className="text-[10px] font-medium">오늘</span>
        </button>

        {/* 3. 전체 태스크 */}
        <button
          onClick={() => onPanelChange('inbox')}
          className={`flex flex-col items-center gap-0.5 py-1.5 px-2 min-w-[52px] rounded-lg transition-colors ${
            activePanel === 'inbox' ? 'bg-blue-50 text-blue-600' : 'text-gray-500'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-[10px] font-medium">전체</span>
        </button>

        {/* 4. 수업 */}
        <button
          onClick={() => onPanelChange('schedule')}
          className={`flex flex-col items-center gap-0.5 py-1.5 px-2 min-w-[52px] rounded-lg transition-colors ${
            activePanel === 'schedule' ? 'bg-blue-50 text-blue-600' : 'text-gray-500'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span className="text-[10px] font-medium">수업</span>
        </button>

        {/* 5. 노트 */}
        <button
          onClick={() => onPanelChange('notes')}
          className={`flex flex-col items-center gap-0.5 py-1.5 px-2 min-w-[52px] rounded-lg transition-colors ${
            activePanel === 'notes' ? 'bg-blue-50 text-blue-600' : 'text-gray-500'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className="text-[10px] font-medium">노트</span>
        </button>
      </div>
    </div>
  )
}
