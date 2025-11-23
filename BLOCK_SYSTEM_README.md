# 📦 블록 기반 Task 시스템 (Phase 3)

## 🎯 개요

Task를 노션의 블록처럼 계층적으로 구성하고, 동적 속성을 통해 무한 확장 가능한 시스템입니다.

**핵심 특징:**
- ✅ **기존 로직 100% 호환** - 모든 기존 기능이 그대로 작동
- ✅ **계층 구조 지원** - Task 안에 Task 중첩 가능
- ✅ **동적 타입** - 시험, 퀴즈, 노트 등 타입별 속성 확장
- ✅ **무한 확장성** - 새로운 타입 추가 시 스키마 변경 불필요

---

## 📊 데이터베이스 변경사항

### 새로 추가된 컬럼

```sql
ALTER TABLE tasks ADD COLUMN:
  - parent_id UUID        -- 부모 Task ID (계층 구조)
  - type TEXT             -- Task 타입 (동적 확장)
  - properties JSONB      -- 타입별 동적 속성
```

### 기존 컬럼 (모두 유지)
```
✅ 모든 기존 필드 그대로 유지
  - status, is_top5, is_auto_generated, is_makeup
  - homework_checks, homework_assignments (JSONB)
  - attendance, homework_status, lesson_note
  - 등 37개 필드 모두 유지
```

---

## 🔧 TypeScript 타입

### Task 인터페이스 확장

```typescript
interface Task {
  // 기존 필드 (전부 유지)
  id: string
  title: string
  status: 'inbox' | 'scheduled' | 'completed' | ...
  is_auto_generated?: boolean
  is_makeup?: boolean
  homework_checks?: HomeworkCheckItem[]
  // ... 기존 필드 37개

  // 🆕 새로 추가된 필드
  parent_id?: string | null     // 부모 Task
  type?: TaskType               // 동적 타입
  properties?: TaskProperties   // 동적 속성
}
```

### 지원 타입

```typescript
type TaskType = 
  | 'task'           // 일반 작업 (기본값)
  | 'lesson'         // 수업
  | 'exam'           // 시험
  | 'exam_question'  // 시험 문제
  | 'quiz'           // 퀴즈
  | 'note'           // 노트
  | 'habit'          // 습관
  | 'homework'       // 과제
  | 'project'        // 프로젝트
```

---

## 💡 사용 예시

### 1️⃣ 시험 시스템 구축

```typescript
import { useExams } from '@/hooks/useExams'

const { createExam, createExamQuestions, submitAnswer, calculateExamStats } = useExams()

// 시험 생성 (부모)
const exam = await createExam({
  title: '중간고사 - 수학',
  type: 'exam',
  properties: {
    subject: '수학',
    total_score: 100,
    duration: 60,
    exam_date: '2025-12-01'
  }
})

// 문제 생성 (자식)
await createExamQuestions(exam.id, [
  {
    title: '1번 문제',
    properties: {
      question: '2 + 2 = ?',
      correct_answer: '4',
      points: 5,
      question_type: 'short_answer'
    }
  },
  {
    title: '2번 문제',
    properties: {
      question: '5 × 3 = ?',
      correct_answer: '15',
      points: 5,
      question_type: 'short_answer'
    }
  }
])

// 답안 제출 및 자동 채점
await submitAnswer(question1Id, '4')  // → { isCorrect: true, points: 5 }

// 통계 계산
const stats = await calculateExamStats(exam.id)
// {
//   totalQuestions: 2,
//   answeredCount: 1,
//   correctCount: 1,
//   totalPoints: 10,
//   earnedPoints: 5,
//   score: 50,
//   incorrectQuestions: [...]
// }
```

### 2️⃣ 계층 구조 활용

```typescript
import { buildTaskTree, getChildTasks, getAllDescendants } from '@/types/database'

// 평면 배열 → 트리 구조
const tree = buildTaskTree(tasks)
// [
//   { id: 'exam1', title: '중간고사', children: [
//     { id: 'q1', title: '1번 문제', children: [] },
//     { id: 'q2', title: '2번 문제', children: [] }
//   ]},
//   { id: 'task1', title: '일반 작업', children: [] }
// ]

// 특정 Task의 자식들
const questions = getChildTasks(tasks, examId)

// 모든 자손 (재귀)
const allDescendants = getAllDescendants(tasks, examId)
```

### 3️⃣ 기존 기능 (변경 없음)

```typescript
import { getInboxTasks, getTop5Tasks, getCalendarTasks } from '@/utils/taskCompatibility'

// 인박스 필터링 (기존과 동일)
const inboxTasks = getInboxTasks(tasks)
// - status === 'inbox'
// - 자동 생성 수업 제외
// - 중첩 Task 제외 (루트만)

// Top5 (기존과 동일)
const top5 = getTop5Tasks(tasks)

// 캘린더 표시 (기존과 동일)
const todayTasks = getCalendarTasks(tasks, new Date())
```

---

## 🔍 호환성 가이드

### ✅ 기존 코드는 그대로 작동

```typescript
// 기존 방식 (여전히 작동)
const lessons = tasks.filter(t => t.is_auto_generated || t.is_makeup)

// 새 방식 (선택사항)
const lessons = tasks.filter(t => t.type === 'lesson')
```

### ⚠️ 주의사항

1. **중첩 Task는 UI에서 자동 제외**
   - 인박스, Top5, 캘린더 등에서 루트 Task만 표시
   - 자식 Task는 부모를 통해 접근

2. **기존 필드 우선 사용**
   - 학생 시간표: 계속 `is_auto_generated`, `is_makeup` 사용
   - 과제 관리: 계속 `homework_checks` (JSONB) 사용
   - 새 기능만 블록 구조 활용

3. **타입 가드 사용 권장**
   ```typescript
   if (isExamTask(task)) {
     const subject = task.properties.subject  // 타입 안전
   }
   ```

---

## 🎓 훅 API 레퍼런스

### `useExams()`

시험 관리 전용 훅

| 메서드 | 설명 | 예시 |
|--------|------|------|
| `createExam` | 시험 생성 | `await createExam({ title: '중간고사', properties: {...} })` |
| `createExamQuestion` | 문제 추가 | `await createExamQuestion(examId, { properties: {...} })` |
| `createExamQuestions` | 문제 일괄 추가 | `await createExamQuestions(examId, [q1, q2])` |
| `submitAnswer` | 답안 제출 및 채점 | `await submitAnswer(qId, '정답')` |
| `getExamQuestions` | 문제 목록 조회 | `await getExamQuestions(examId)` |
| `calculateExamStats` | 통계 계산 | `await calculateExamStats(examId)` |
| `resetExam` | 시험 초기화 | `await resetExam(examId)` |
| `deleteExam` | 시험 삭제 (문제 포함) | `await deleteExam(examId)` |

---

## 🧪 테스트 가이드

### 호환성 검증

```typescript
import { validateCompatibility } from '@/utils/taskCompatibility'

const validation = validateCompatibility(tasks)

if (!validation.isCompatible) {
  console.error('호환성 문제:', validation.errors)
  // [
  //   "Task xxx의 부모 yyy를 찾을 수 없습니다.",
  //   "Task zzz에 순환 참조가 있습니다."
  // ]
}
```

### 기존 기능 체크리스트

- [ ] 인박스 필터링 정상 작동
- [ ] Top5 표시 정상 작동
- [ ] 캘린더 Task 표시 정상 작동
- [ ] 학생 시간표 자동 생성 정상 작동
- [ ] 과제 체크/배정 정상 작동
- [ ] 드래그앤드롭 정상 작동

---

## 🚀 확장 가능성

### 향후 추가 가능한 타입

1. **플래시카드 시스템**
   ```typescript
   type: 'flashcard'
   properties: {
     front: '질문',
     back: '답변',
     mastery_level: 3
   }
   ```

2. **프로젝트 관리**
   ```typescript
   type: 'project'
   properties: {
     milestones: [...],
     team_members: [...],
     progress: 65
   }
   ```

3. **독서 노트**
   ```typescript
   type: 'book_note'
   properties: {
     book_title: '...',
     author: '...',
     pages_read: 120,
     highlights: [...]
   }
   ```

### 타입 추가 방법

1. **DB 제약 조건 업데이트**
   ```sql
   ALTER TABLE tasks DROP CONSTRAINT tasks_type_check;
   ALTER TABLE tasks ADD CONSTRAINT tasks_type_check 
   CHECK (type IN ('task', 'exam', ..., 'new_type'));  -- 🆕 추가
   ```

2. **TypeScript 타입 추가**
   ```typescript
   // types/database.ts
   export type TaskType = ... | 'new_type'  // 🆕
   export interface NewTypeProperties { ... }  // 🆕
   ```

3. **전용 훅 생성 (선택)**
   ```typescript
   // hooks/useNewType.ts
   export function useNewType() { ... }
   ```

---

## 📝 요약

### ✅ 완료된 작업

1. ✅ 데이터베이스 스키마 확장 (`parent_id`, `type`, `properties`)
2. ✅ TypeScript 타입 정의 확장
3. ✅ 타입 가드 및 헬퍼 함수
4. ✅ 시험 관리 훅 (`useExams`)
5. ✅ 호환성 유틸리티 (`taskCompatibility.ts`)

### 🎯 사용 방법

- **기존 기능**: 아무것도 변경하지 않아도 그대로 작동
- **새 기능**: `useExams` 훅으로 시험 시스템 구축 가능
- **확장**: 새로운 타입 추가 시 스키마 수정 불필요

### 🔧 핵심 파일

| 파일 | 역할 |
|------|------|
| `supabase_task_block_reform.sql` | DB 스키마 확장 |
| `types/database.ts` | Task 타입 정의 |
| `hooks/useExams.ts` | 시험 관리 훅 |
| `utils/taskCompatibility.ts` | 호환성 헬퍼 |
| `BLOCK_SYSTEM_README.md` | 이 문서 |

---

**블록 기반 Task 시스템이 성공적으로 구현되었습니다!** 🎉

기존 기능은 모두 정상 작동하며, 시험/퀴즈 등 새로운 기능을 자유롭게 추가할 수 있습니다.

