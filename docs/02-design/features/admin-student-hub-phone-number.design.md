# 관리자 학생 허브 페이지 학생 휴대전화번호 추가 설계

## Component Modification: `AdminStudentHub`
- **File**: `src/app/(dashboard)/admin/students/admin-student-hub.tsx`

### 1. COLUMNS Constant
'성명'(`student_name`) 컬럼 바로 다음에 '휴대전화번호'(`phone_number`) 컬럼을 추가합니다.

```typescript
const COLUMNS = [
  { key: 'grade', label: '학년', width: 60, readOnly: true },
  { key: 'major', label: '학과', width: 120, readOnly: true },
  { key: 'class_info', label: '반', width: 60, readOnly: true },
  { key: 'student_number', label: '번호', width: 60, readOnly: true },
  { key: 'student_name', label: '성명', width: 100, readOnly: true },
  { key: 'phone_number', label: '휴대전화번호', width: 110, readOnly: true }, // 신규 추가
]
```

### 2. GROUP_HEADERS Constant
'학생 기본 인적사항' 그룹의 `colSpan`을 5에서 6으로 변경하여 새로 추가된 컬럼을 포함하도록 합니다.

```typescript
const GROUP_HEADERS = [
  { label: '학생 기본 인적사항', colSpan: 6, className: 'bg-slate-100 text-slate-900 text-[11px]' }, // 5 -> 6
]
```

## Data Handling
- `initialData`는 `getFilteredStudentData`에서 반환된 `StudentEmploymentData[]` 타입을 사용합니다.
- 해당 타입에는 이미 `phone_number?: string`이 정의되어 있으며, DB에서 값을 가져오고 있으므로 별도의 데이터 매핑 로직 수정은 불필요합니다.

### 1. Excel Import Mapping (`src/app/students/actions.ts`)
CSV 파일의 '성명' 다음에 '휴대전화번호' 열이 추가됨에 따라 `uploadStudentsCSV` 함수의 인덱스 맵을 다음과 같이 변경합니다.

- **기본 정보 (students 테이블)**
  - `phone_number`: `values[6]` (신규)
  - `career_aspiration`: `values[7]` (6 -> 7)
  - `special_notes`: `values[8]` (7 -> 8)
  - `career_course`: `values[9]` (8 -> 9)
  - `certificates`: `values[15]` (14 -> 15)
  - `military_status`: `values[16]` (15 -> 16)
  - `shoe_size`: `values[17]` (16 -> 17)
  - `top_size`: `values[18]` (17 -> 18)
  - `personal_remarks`: `values[29]` (28 -> 29)

- **취업 정보 (student_employments 테이블)**
  - `is_desiring_employment`: `values[10]` (9 -> 10)
  - `business_type`: `values[11]` (10 -> 11)
  - `employment_status`: `values[12]` (11 -> 12)
  - `company_type`: `values[13]` (12 -> 13)
  - `company`: `values[14]` (13 -> 14)
  - `remarks`: `values[28]` (27 -> 28)

- **실습 정보 (field_training_records 테이블)**
  - `company`: `values[20]` (19 -> 20)
  - `start_date`: `values[21]` (20 -> 21)
  - `end_date`: `values[22]` (21 -> 22)
  - `stipend_status`: `values[23]` (22 -> 23)
  - `hiring_status` (채용전환): `values[24]` (23 -> 24)
  - `conversion_date`: `values[25]` (24 -> 25)
  - `hiring_status` (복교): `values[26]` (25 -> 26)
  - `return_reason`: `values[27]` (26 -> 27)

### 2. Import Template (`src/app/(dashboard)/students/import-button.tsx`)
`downloadTemplate` 함수의 헤더 문자열을 다음과 같이 수정합니다.
- 변경 전: `...성명,진로희망...`
- 변경 후: `...성명,휴대전화번호,진로희망...`

## UI/UX Considerations
- **읽기 전용**: 사용자의 요청에 따라 `readOnly: true`를 명시하여 테이블 내에서 직접 수정되지 않도록 합니다.
- **레이아웃**: `width: 110`은 일반적인 휴대전화번호(010-0000-0000)를 표시하기에 충분한 너비입니다.