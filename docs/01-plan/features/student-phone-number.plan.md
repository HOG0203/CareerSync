# 학반 관리 페이지 학생 휴대전화번호 추가 계획

## Objective
`http://localhost:9002/class-management` 페이지의 학반 관리 테이블에서 학생 성명 우측에 '휴대전화번호'를 입력 및 관리할 수 있는 컬럼을 추가합니다.

## Key Files & Context
- `docs/03-sql/53-add-phone-number-to-students.sql`: 신규 컬럼 추가를 위한 DB 마이그레이션 파일.
- `src/lib/types.ts`: 학생 데이터 타입 정의.
- `src/app/students/actions.ts`: 학생 데이터 업데이트 서버 액션.
- `src/app/(dashboard)/class-management/class-table.tsx`: 학반 관리 데이터 테이블 UI 컴포넌트.

## Implementation Steps
1. **DB 스키마 마이그레이션 추가**
   - `docs/03-sql/53-add-phone-number-to-students.sql` 파일을 생성하여 `students` 테이블에 `phone_number` (TEXT) 컬럼을 추가합니다.

2. **타입 정의 업데이트**
   - `src/lib/types.ts`의 `StudentEmploymentData` 타입에 `phone_number?: string;` 속성을 추가합니다.

3. **서버 액션 업데이트**
   - `src/app/students/actions.ts`의 `BASIC_INFO_FIELDS` 배열에 `'phone_number'`를 추가하여, 정보 수정 시 `student_employments` 테이블이 아닌 `students` 기본 테이블에 값이 저장되도록 처리합니다.

4. **UI 컴포넌트 업데이트**
   - `src/app/(dashboard)/class-management/class-table.tsx` 파일 내 `columns` 배열을 수정하여 '성명'(`student_name`) 바로 다음 위치에 '휴대전화번호'(`phone_number`) 컬럼을 추가합니다. (width: 약 110)
   - 상단 그룹 헤더(`groupHeaders`) 중 '학생 기본 정보'의 `colSpan`을 기존 2에서 3으로 변경하여 레이아웃이 깨지지 않도록 조정합니다.

## Verification & Testing
- Supabase(또는 로컬 DB)에서 마이그레이션 스크립트를 실행하여 컬럼이 정상적으로 추가되는지 확인.
- 브라우저에서 `/class-management`에 접속하여 '성명' 옆에 '휴대전화번호' 열이 정상적으로 표시되는지 확인.
- 해당 셀을 클릭하여 임의의 전화번호를 입력하고 저장(엔터 등) 시 성공 토스트 알림이 발생하며 변경 사항이 유지되는지 확인.
- 새로고침 후에도 입력한 데이터가 정상적으로 불러와지는지 확인.
