# 🔧 Supabase "Failed to fetch" 문제 해결

## ❌ 현재 상황
- 환경 변수: ✅ 정상
- 네트워크 연결: ✅ 정상 (443 포트 연결 성공)
- 에러: `TypeError: Failed to fetch`

---

## 🎯 해결 방법 (순서대로 시도)

### 1️⃣ **Supabase 프로젝트 상태 확인** ⭐ 가장 가능성 높음

https://supabase.com/dashboard 에 로그인해서:

1. **프로젝트 목록** 확인
2. 프로젝트가 **일시 중지(Paused)** 상태인지 확인
3. 일시 중지 상태라면 **"Resume Project"** 클릭
4. 프로젝트가 활성화될 때까지 **1-2분 대기**

> 💡 무료 플랜은 7일간 활동이 없으면 자동으로 일시 중지됩니다.

---

### 2️⃣ **Supabase API Settings 확인**

Dashboard → Settings → API:

1. **Project URL** 확인: `https://trqkxzxdpqdehgdqhphn.supabase.co`
2. **anon public key** 확인 및 복사
3. `.env.local` 파일과 일치하는지 확인

---

### 3️⃣ **Supabase 프로젝트 다시 만들기** (최후의 수단)

기존 프로젝트에 문제가 있다면:

1. https://supabase.com 에서 **새 프로젝트 생성**
2. **SQL Editor**에서 다음 스크립트들을 순서대로 실행:
   - `supabase_schema.sql` (기본 테이블)
   - `supabase_migration.sql` (마이그레이션)
   - `supabase_homework_schema.sql` (교재 관리)
   - `supabase_task_block_reform.sql` (블록 시스템)
   - `supabase_check_rls.sql` (RLS 비활성화)

3. 새 **Project URL**과 **API Key**를 `.env.local`에 업데이트
4. 서버 재시작: `npm run dev`

---

## 🔍 추가 확인 사항

### A. 브라우저 콘솔에서 직접 테스트

1. 브라우저 개발자 도구 (F12) 열기
2. Console 탭에서 다음 실행:

```javascript
fetch('https://trqkxzxdpqdehgdqhphn.supabase.co/rest/v1/projects', {
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRycWt4enhkcHFkZWhnZHFocGhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MzE4MDgsImV4cCI6MjA3OTEwNzgwOH0.5HaLhOTAZH-Yun4-R26jDhrcqEpf00alBIH8EDjAck4'
  }
})
.then(r => r.json())
.then(d => console.log('✅ Success:', d))
.catch(e => console.error('❌ Error:', e))
```

### B. Next.js 캐시 완전 삭제

```bash
# PowerShell에서 실행
Remove-Item -Recurse -Force .next
npm run dev
```

---

## 📞 다음 액션

1. **먼저**: Supabase Dashboard에서 프로젝트 상태 확인 ← **가장 중요!**
2. 프로젝트가 일시 중지되었다면 Resume 후 1-2분 대기
3. 여전히 안 되면 브라우저 콘솔 테스트 결과 공유

---

## 💡 참고

- Supabase 무료 플랜: 7일간 비활성 시 자동 일시 중지
- 프로젝트 재개 후 완전히 활성화되는데 1-2분 소요
- RLS (Row Level Security)는 별도로 비활성화 필요

