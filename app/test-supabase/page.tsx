'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function TestSupabasePage() {
  const [status, setStatus] = useState<any>({
    url: '',
    keyExists: false,
    connectionTest: 'testing...',
    textbooksTest: 'testing...',
    projectsTest: 'testing...',
  })

  useEffect(() => {
    async function testConnection() {
      // 1. 환경 변수 확인
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      const keyExists = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      setStatus((prev: any) => ({ ...prev, url, keyExists }))

      // 2. Supabase 연결 테스트
      try {
        const { data, error } = await supabase.from('textbooks').select('count')
        
        if (error) {
          setStatus((prev: any) => ({
            ...prev,
            connectionTest: '❌ FAILED',
            textbooksTest: `Error: ${error.message || JSON.stringify(error)}`,
          }))
        } else {
          setStatus((prev: any) => ({
            ...prev,
            connectionTest: '✅ SUCCESS',
            textbooksTest: `✅ Connected (${JSON.stringify(data)})`,
          }))
        }
      } catch (e: any) {
        setStatus((prev: any) => ({
          ...prev,
          connectionTest: '❌ EXCEPTION',
          textbooksTest: `Exception: ${e.message || JSON.stringify(e)}`,
        }))
      }

      // 3. Projects 테이블 테스트
      try {
        const { data, error } = await supabase.from('projects').select('count')
        
        if (error) {
          setStatus((prev: any) => ({
            ...prev,
            projectsTest: `Error: ${error.message || JSON.stringify(error)}`,
          }))
        } else {
          setStatus((prev: any) => ({
            ...prev,
            projectsTest: `✅ Connected (${JSON.stringify(data)})`,
          }))
        }
      } catch (e: any) {
        setStatus((prev: any) => ({
          ...prev,
          projectsTest: `Exception: ${e.message || JSON.stringify(e)}`,
        }))
      }
    }

    testConnection()
  }, [])

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">🔍 Supabase 연결 진단</h1>
      
      <div className="space-y-4 font-mono text-sm">
        <div className="p-4 bg-gray-50 rounded">
          <div className="font-bold mb-2">1. 환경 변수</div>
          <div>URL: {status.url || '❌ NOT FOUND'}</div>
          <div>KEY: {status.keyExists ? '✅ EXISTS' : '❌ NOT FOUND'}</div>
        </div>

        <div className="p-4 bg-gray-50 rounded">
          <div className="font-bold mb-2">2. 연결 테스트</div>
          <div>{status.connectionTest}</div>
        </div>

        <div className="p-4 bg-gray-50 rounded">
          <div className="font-bold mb-2">3. Textbooks 테이블</div>
          <div className="whitespace-pre-wrap break-all">{status.textbooksTest}</div>
        </div>

        <div className="p-4 bg-gray-50 rounded">
          <div className="font-bold mb-2">4. Projects 테이블</div>
          <div className="whitespace-pre-wrap break-all">{status.projectsTest}</div>
        </div>
      </div>

      <div className="mt-6">
        <a href="/" className="text-blue-600 hover:underline">← 메인으로</a>
      </div>
    </div>
  )
}


