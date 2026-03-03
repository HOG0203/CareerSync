# PDCA Design: 누적 상담 관리 시스템 고도화

## 1. 데이터 모델 설계 (Database Schema)

### 1.1 `student_counseling_logs` 테이블
| 컬럼명 | 타입 | 제약 조건 | 설명 |
|--------|------|-----------|------|
| `id` | UUID | PK, Default: gen_random_uuid() | 고유 ID |
| `student_id` | UUID | FK (student_employments.id), ON DELETE CASCADE | 대상 학생 |
| `content` | TEXT | NOT NULL | 상담 내용 |
| `author_id` | UUID | FK (profiles.id) | 작성 교사 ID |
| `author_name` | TEXT | - | 작성 교사 이름 (Snapshot) |
| `created_at` | TIMESTAMPTZ| Default: now() | 상담 기록 시각 |

### 1.2 RLS(Row Level Security) 정책
- **조회(SELECT)**: 관리자 전체 허용, 담임교사는 본인 담당 학과/반 학생의 기록만 허용.
- **추가(INSERT)**: 인증된 교사/관리자 허용.
- **수정/삭제**: 본인이 작성한 기록에 한해 허용 (또는 관리자 전용).

## 2. UI 컴포넌트 설계

### 2.1 테이블 연동 (`StandardSpreadsheetTable`)
- `ColumnConfig`에 `type: 'action'` 속성 추가 지원.
- 버튼 클릭 시 `onAction(rowId, key)` 콜백 실행.

### 2.2 상담 관리 모달 (`CounselingModal`)
- **Header**: 학생 성명, 학과, 학년 정보 표시.
- **Body (List)**: 
  - 카드 형태의 상담 기록 리스트.
  - 날짜와 작성자 이름을 배지로 표시.
- **Footer (Form)**:
  - 텍스트 입력창 (Auto-resize Textarea).
  - 저장 버튼 (로딩 상태 표시).

## 3. 서버 액션(Server Actions) 설계

### `getCounselingLogs(studentId: string)`
- 특정 학생의 ID를 기반으로 `student_counseling_logs`를 조회하여 시간순 반환.

### `addCounselingLog(studentId: string, content: string)`
- 현재 세션 유저의 성명과 ID를 가져와 기록 저장.
- 저장 후 `revalidatePath`를 통해 UI 동기화.

## 4. 단계별 구현 가이드
1. **DB**: SQL Editor를 통해 테이블 및 RLS 설정.
2. **Action**: 상담 내역 CRUD 서버 액션 구현.
3. **UI**: `CounselingModal` 독립 컴포넌트 개발.
4. **Table**: `ClassTable` 설정 변경 및 모달 트리거 연결.
