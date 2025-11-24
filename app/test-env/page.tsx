'use client'

export default function TestEnvPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKeyExists = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">환경 변수 테스트</h1>
      <div className="space-y-2">
        <p>
          <strong>NEXT_PUBLIC_SUPABASE_URL:</strong> 
          <span className="ml-2 font-mono text-sm">
            {supabaseUrl || '❌ NOT FOUND'}
          </span>
        </p>
        <p>
          <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY:</strong> 
          <span className="ml-2">
            {supabaseKeyExists ? '✅ EXISTS' : '❌ NOT FOUND'}
          </span>
        </p>
      </div>
      <div className="mt-6">
        <a href="/" className="text-blue-600 hover:underline">← 메인으로</a>
      </div>
    </div>
  )
}


