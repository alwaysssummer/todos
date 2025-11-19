# 📅 Todo 캘린더 앱

Vercel 스타일의 미니멀한 디자인을 가진 개인용 Todo & 일정 관리 앱입니다.

## ✨ 주요 기능

### 현재 구현된 기능 (UI)
- ✅ **3-패널 레이아웃** - 크기 조절 가능한 3개의 독립적인 패널
- ✅ **왼쪽 패널** - Today's Top 5, Inbox, 빠른 입력
- ✅ **중앙 패널** - 주간 캘린더 (24시간 x 7일)
- ✅ **오른쪽 패널** - 미니 캘린더, 프로젝트, 메모
- ✅ **반응형 디자인** - 모바일 네비게이션 지원

### 다음 구현 예정
- ⏳ Supabase 데이터베이스 연결
- ⏳ 드래그 앤 드롭 기능
- ⏳ CRUD 작업 (생성, 읽기, 수정, 삭제)
- ⏳ 실시간 동기화

## 🚀 시작하기

### 1. 의존성 설치
```bash
npm install
```

### 2. 개발 서버 실행
```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어보세요.

## 📁 프로젝트 구조

```
todos/
├── app/
│   ├── globals.css      # 전역 스타일
│   ├── layout.tsx       # 루트 레이아웃
│   └── page.tsx         # 메인 페이지 (3-패널 레이아웃)
├── components/
│   ├── LeftPanel.tsx    # 왼쪽 패널 (Inbox)
│   ├── CenterPanel.tsx  # 중앙 패널 (캘린더)
│   ├── RightPanel.tsx   # 오른쪽 패널 (프로젝트/메모)
│   └── MobileNavigation.tsx  # 모바일 네비게이션
├── 개발요구서.md         # 상세 디자인 스펙
└── 개발플랜.md           # 단계별 개발 플랜
```

## 🛠 기술 스택

- **프레임워크:** Next.js 14 (App Router)
- **언어:** TypeScript
- **스타일링:** Tailwind CSS
- **레이아웃:** react-resizable-panels
- **드래그앤드롭:** @dnd-kit (예정)
- **데이터베이스:** Supabase (예정)
- **배포:** Vercel (예정)

## 📖 개발 가이드

자세한 개발 플랜은 [개발플랜.md](./개발플랜.md)를 참고하세요.

디자인 스펙은 [개발요구서.md](./개발요구서.md)를 참고하세요.

## 🎨 디자인 시스템

- **테마:** Vercel 스타일 미니멀리즘
- **컬러:** 모노크롬 (White/Black/Grays)
- **타이포그래피:** Geist Sans
- **간격:** Compact density
- **보더:** Subtle borders (border-gray-200)

## 📱 반응형

- **모바일 (< 768px):** 1-패널 뷰 + 하단 네비게이션
- **데스크톱 (≥ 768px):** 3-패널 뷰 (크기 조절 가능)

## 🔧 다음 작업

1. **Supabase 설정**
   - 프로젝트 생성
   - 데이터베이스 스키마 구성
   - API 연결

2. **기능 구현**
   - 태스크 CRUD
   - 드래그 앤 드롭
   - 프로젝트/메모 관리

3. **배포**
   - Vercel 자동 배포 설정

## 📝 라이선스

개인 프로젝트

---

**현재 상태:** ✅ Phase 1 완료 (레이아웃) | ⏳ Phase 2 대기 (데이터베이스)
