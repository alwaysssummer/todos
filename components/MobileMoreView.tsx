'use client'

import type { Project } from '@/types/database'

interface MobileMoreViewProps {
  projects: Project[]
  onProjectManage?: () => void
  onTextbookManage?: () => void
  onArchiveOpen?: () => void
}

export default function MobileMoreView({
  projects,
  onProjectManage,
  onTextbookManage,
  onArchiveOpen
}: MobileMoreViewProps) {
  const studentProjects = projects.filter(p => p.type === 'student')
  const folderProjects = projects.filter(p => p.type === 'folder')
  const habitProjects = projects.filter(p => p.type === 'habit')

  const menuItems = [
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      title: '학생 관리',
      description: `${studentProjects.length}명`,
      color: 'bg-blue-100 text-blue-600',
      onClick: onProjectManage
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      title: '교재 관리',
      description: '교재 등록 및 관리',
      color: 'bg-green-100 text-green-600',
      onClick: onTextbookManage
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      ),
      title: '프로젝트',
      description: `${folderProjects.length}개`,
      color: 'bg-yellow-100 text-yellow-600',
      onClick: onProjectManage
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      title: '습관 관리',
      description: `${habitProjects.length}개`,
      color: 'bg-purple-100 text-purple-600',
      onClick: onProjectManage
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      ),
      title: '아카이브',
      description: '완료된 태스크 보기',
      color: 'bg-gray-100 text-gray-600',
      onClick: onArchiveOpen
    }
  ]

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">더보기</h1>
        <p className="text-xs text-gray-500 mt-0.5">설정 및 관리</p>
      </div>

      {/* 메뉴 목록 */}
      <div className="flex-1 overflow-y-auto pb-20">
        <div className="p-3 space-y-2">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              className="w-full bg-white rounded-xl p-4 active:bg-gray-50 text-left shadow-sm border border-gray-100"
            >
              <div className="flex items-center gap-4">
                <div className={`${item.color} w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0`}>
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900">
                    {item.title}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {item.description}
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        {/* 버전 정보 */}
        <div className="px-4 py-6 text-center">
          <div className="text-xs text-gray-400">
            Todos Mobile v10.0
          </div>
          <div className="text-xs text-gray-400 mt-1">
            © 2024 All rights reserved
          </div>
        </div>
      </div>
    </div>
  )
}



