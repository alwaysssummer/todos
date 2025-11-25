'use client'

import { useNotionLinks } from '@/hooks/useNotionLinks'
import { supabase } from '@/lib/supabase'
import { useState } from 'react'

export default function TestNotionLinks() {
  const { links, loading, createLink, deleteLink } = useNotionLinks()
  const [testTitle, setTestTitle] = useState('테스트 프로젝트')
  const [testUrl, setTestUrl] = useState('https://notion.so/test')

  const testConnection = async () => {
    console.log('🔍 Supabase 연결 테스트 시작...')
    
    // 1. 테이블 존재 확인
    const { data, error } = await supabase
      .from('notion_links')
      .select('*')
      .limit(1)
    
    if (error) {
      console.error('❌ 테이블이 존재하지 않거나 접근 불가:', error)
      console.error('❌ 에러 상세:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      alert(`❌ 에러 발견!\n\n메시지: ${error.message}\n코드: ${error.code}\n\n💡 Supabase SQL Editor에서\nsupabase_notion_links.sql을 실행하세요!`)
    } else {
      console.log('✅ notion_links 테이블 접근 성공!')
      console.log('현재 데이터:', data)
      alert(`✅ 테이블이 정상적으로 존재합니다!\n현재 ${data.length}개의 링크가 있습니다.`)
    }
  }

  const handleCreate = async () => {
    if (!testTitle.trim() || !testUrl.trim()) {
      alert('제목과 URL을 입력하세요')
      return
    }

    await createLink({
      title: testTitle,
      url: testUrl,
      order_index: links.length
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6">🔗 Notion Links 테스트</h1>

        {/* 연결 테스트 */}
        <div className="mb-6 p-4 bg-blue-50 rounded">
          <button
            onClick={testConnection}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            🔍 Supabase 연결 테스트
          </button>
          <p className="text-sm text-gray-600 mt-2">
            ⚠️ 테이블이 없다는 에러가 나오면, Supabase SQL Editor에서<br/>
            <code className="bg-gray-200 px-1 rounded">supabase_notion_links.sql</code> 파일을 실행하세요!
          </p>
        </div>

        {/* 로딩 상태 */}
        {loading && (
          <div className="mb-6 p-4 bg-yellow-50 rounded">
            ⏳ 로딩 중...
          </div>
        )}

        {/* 링크 생성 */}
        <div className="mb-6 p-4 border rounded">
          <h2 className="text-lg font-semibold mb-3">새 링크 추가</h2>
          <div className="space-y-3">
            <input
              type="text"
              value={testTitle}
              onChange={e => setTestTitle(e.target.value)}
              placeholder="제목"
              className="w-full px-3 py-2 border rounded"
            />
            <input
              type="url"
              value={testUrl}
              onChange={e => setTestUrl(e.target.value)}
              placeholder="https://notion.so/..."
              className="w-full px-3 py-2 border rounded"
            />
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              ➕ 추가
            </button>
          </div>
        </div>

        {/* 현재 링크 목록 */}
        <div>
          <h2 className="text-lg font-semibold mb-3">
            현재 링크 ({links.length}개)
          </h2>
          {links.length === 0 ? (
            <div className="p-4 bg-gray-50 rounded text-center text-gray-500">
              링크가 없습니다. 위에서 추가해보세요!
            </div>
          ) : (
            <div className="space-y-2">
              {links.map(link => (
                <div
                  key={link.id}
                  className="flex items-center justify-between p-3 border rounded hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="font-medium">{link.title}</div>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {link.url}
                    </a>
                  </div>
                  <button
                    onClick={() => deleteLink(link.id)}
                    className="px-3 py-1 text-sm bg-red-100 text-red-600 rounded hover:bg-red-200"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 콘솔 확인 안내 */}
        <div className="mt-6 p-4 bg-gray-50 rounded text-sm text-gray-600">
          💡 <strong>팁:</strong> 브라우저 개발자 도구(F12) → Console 탭에서 자세한 로그를 확인할 수 있습니다.
        </div>
      </div>
    </div>
  )
}

