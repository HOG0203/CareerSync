# PDCA Design: 전 학년 학적 이력 영구 기록 시스템

## 1. 데이터 모델 설계 (Database Schema)

### 1.1 `student_academic_history` 테이블
| 컬럼명 | 타입 | 제약 조건 | 설명 |
|--------|------|-----------|------|
| `id` | UUID | PK, Default: gen_random_uuid() | 고유 ID |
| `student_id` | UUID | FK (student_employments.id), ON DELETE CASCADE | 대상 학생 |
| `academic_year` | INTEGER | NOT NULL | 해당 학년도 (예: 2026) |
| `grade` | INTEGER | NOT NULL (1, 2, 3) | 당시 학년 |
| `major` | TEXT | NOT NULL | 당시 학과 |
| `class_info` | TEXT | NOT NULL | 당시 반 |
| `student_number` | TEXT | NOT NULL | 당시 번호 |
| `created_at` | TIMESTAMPTZ| Default: now() | 기록 생성 시각 |

- **Unique 제약**: `(student_id, grade)` 조합을 유니크하게 설정하여 학년별로 단 하나의 학적 기록만 남도록 보장합니다.

## 2. 서버 로직 설계

### 2.1 이력 자동 기록 로직
- `promoteStudents` 또는 `updateStudentField` 호출 시:
  1. 학생의 현재 고유 ID와 변경된(또는 변경될) 소속 정보를 취합.
  2. `student_academic_history` 테이블에 `upsert` 수행.
  3. `academic_year`는 시스템 기준 연도(`baseYear`)를 기준으로 학년에 맞춰 계산하여 저장.

### 2.2 이력 조회 (`getAcademicHistory`)
- 특정 학생 ID를 기준으로 1~3학년 전체 이력을 조회하여 반환.

## 3. UI 컴포넌트 설계

### 3.1 학적 이력 표시 (`CounselingModal` 연동)
- 모달 상단에 '학적 변동 이력' 섹션 추가.
- 최신 학년 정보부터 역순으로 가로 배지(Badge) 형태로 나열.

## 4. 단계별 구현 가이드
1. **DB**: 신규 테이블 생성 및 Unique 제약 조건 설정.
2. **Action**: `syncAcademicHistory` 공통 서버 액션 구현.
3. **Logic**: 기존 진급 및 수정 액션에 이력 동기화 코드 삽입.
4. **UI**: 상담 모달 내 학적 이력 리스트 렌더링.
