'use client'

type PanelType = 'left' | 'center' | 'right'

interface MobileNavigationProps {
  activePanel: PanelType
  onPanelChange: (panel: PanelType) => void
}

export default function MobileNavigation({ activePanel, onPanelChange }: MobileNavigationProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex items-center justify-around py-3 z-50">
      <button
        onClick={() => onPanelChange('left')}
        className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
          activePanel === 'left' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'
        }`}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <span className="text-xs">Inbox</span>
      </button>

      <button
        onClick={() => onPanelChange('center')}
        className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
          activePanel === 'center' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'
        }`}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-xs">캘린더</span>
      </button>

      <button
        onClick={() => onPanelChange('right')}
        className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
          activePanel === 'right' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'
        }`}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
        <span className="text-xs">메뉴</span>
      </button>
    </div>
  )
}




