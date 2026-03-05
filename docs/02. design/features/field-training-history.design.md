# [Design] 현장실습 다회차 기록 관리 및 최종 취업처 분리

## 1. 데이터베이스 설계 (Schema Design)

### 1.1 `field_training_records` (신규)
현장실습의 각 회차별 정보를 저장하는 테이블입니다. (1:N 관계)

| 컬럼명 | 타입 | 제약조건 | 설명 |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, DEFAULT uuid_generate_v4() | 고유 식별자 |
| `student_id` | UUID | FK (students.id), ON DELETE CASCADE | 학생 식별자 |
| `training_order` | INTEGER | NOT NULL | 실습 차수 (1, 2, 3...) |
| `company` | TEXT | NOT NULL | 실습 업체명 |
| `start_date` | DATE | | 실습 시작일 |
| `end_date` | DATE | | 실습 종료일 |
| `stipend_status` | TEXT | DEFAULT 'X' | 지원금 신청 여부 (O/X) |
| `hiring_status` | TEXT | CHECK (IN ('진행중', '채용전환', '복교')) | 실습 결과 상태 |
| `conversion_date` | DATE | | 채용 전환일 (전환 시) |
| `return_reason` | TEXT | | 복교 사유 (복교 시) |
| `created_at` | TIMESTAMPTZ| DEFAULT NOW() | 생성일 |
| `updated_at` | TIMESTAMPTZ| DEFAULT NOW() | 수정일 |

### 1.2 `student_employments` (수정)
최종 취업 정보만 관리하도록 필드를 정리합니다.

- **삭제 예정 필드**: `start_date`, `end_date`, `has_field_training`, `training_stipend_status`, `is_hiring_conversion`, `conversion_date`, `is_returned`, `return_to_school_reason`
- **유지 필드**: `id`, `company` (최종 취업처), `employment_status`, `company_type`, `business_type`, `is_desiring_employment`, `remarks`

---

## 2. API 및 데이터 흐름 설계

### 2.1 데이터 조회 (`src/lib/data.ts`)
- `getStudentEmploymentData` 쿼리 수정: `students` + `student_employments` + `field_training_records` (가장 최신 1건만 Join)
- `getFieldTrainingHistory(studentId)` 신규: 특정 학생의 모든 실습 이력 조회

### 2.2 서버 액션 (`src/app/students/actions.ts`)
- `upsertFieldTrainingRecord`: 실습 이력 추가 또는 수정
- `deleteFieldTrainingRecord`: 특정 실습 이력 삭제
- **자동 동기화 로직**: 실습 결과가 '채용전환'으로 저장될 때, 해당 `company` 명을 `student_employments.company`에도 반영할지 결정하는 로직 포함.

---

## 3. UI/UX 설계 (`/students`)

### 3.1 메인 테이블 (`student-table.tsx`)
- **실습 현황 섹션**: 
  - `latest_training_company`: 최신 실습지 노출
  - `latest_training_period`: 최신 실습 기간 노출
  - `latest_training_status`: 최신 실습 결과(진행중/전환/복교) 노출
- **액션 컬럼**: [실습이력] 버튼 추가 -> 클릭 시 상세 모달 오픈

### 3.2 실습 이력 관리 모달 (`field-training-modal.tsx`)
- **Header**: 학생 성명 및 학번 표시
- **Body**: 
  - 카드 형태의 실습 이력 리스트 (최신순 정렬)
  - 각 카드 내에 실습지, 기간, 결과, 사유 편집 폼 제공
- **Footer**: [+ 새 실습 회차 추가] 버튼 및 [저장] 버튼

---

## 4. 데이터 마이그레이션 전략
1. `field_training_records` 테이블 생성
2. 기존 `student_employments`의 실습 데이터를 `training_order: 1`로 Insert
3. `student_employments`에서 중복된 실습 관련 컬럼 Drop
4. RLS(Row Level Security) 정책 적용
