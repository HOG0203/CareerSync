# 관리자 학생 허브 페이지 학생 휴대전화번호 추가 계획

## Objective
`http://localhost:9002/admin/students` (통합 학생 명부 관리) 페이지의 테이블에서 학생 성명 우측에 '휴대전화번호' 컬럼을 읽기 전용으로 추가하여 연락처 정보를 한눈에 확인할 수 있도록 합니다.

## Key Files & Context
- `src/app/(dashboard)/admin/students/admin-student-hub.tsx`: 테이블 컬럼 구조 및 그룹 헤더가 정의된 파일입니다.
- 데이터는 이미 `src/lib/data.ts`의 `getFilteredStudentData` 함수를 통해 `students` 테이블에서 정상적으로 패치되고 있으므로 DB 수정이나 백엔드 로직 변경은 불필요합니다.

## Implementation Steps
1. **컬럼 정의 수정**: 
   - `src/app/(dashboard)/admin/students/admin-student-hub.tsx` 파일 내 `COLUMNS` 배열에서 `student_name` (성명) 항목 바로 뒤에 `phone_number` (휴대전화번호) 항목을 추가합니다.
   - 사용자 요청에 따라 해당 컬럼은 읽기 전용(`readOnly: true`)으로 설정합니다. 폭(width)은 약 110으로 지정합니다.
2. **그룹 헤더 병합 범위 수정**:
   - 동일한 파일 내 `GROUP_HEADERS` 배열에서 '학생 기본 인적사항' 항목의 `colSpan` 값을 기존 `5`에서 `6`으로 증가시켜, 새로 추가된 컬럼까지 그룹 헤더가 올바르게 덮도록 수정합니다.
3. **가져오기/내보내기 양식 수정**:
   - `src/app/(dashboard)/students/import-button.tsx`의 `downloadTemplate` 함수에서 CSV 헤더에 '휴대전화번호'를 추가합니다.
   - `src/app/(dashboard)/students/export-button.tsx`의 CSV 헤더에 '휴대전화번호'를 추가합니다. (이미 완료됨)
   - `src/app/students/actions.ts`의 `uploadStudentsCSV` 함수에서 CSV 파싱 인덱스를 수정하여 신규 추가된 '휴대전화번호' 열을 처리하고 이후 열들의 인덱스를 조정합니다.

## Verification & Testing
- 브라우저에서 `http://localhost:9002/admin/students`에 접속합니다.
- 테이블의 '성명' 열 우측에 '휴대전화번호' 열이 정상적으로 표시되는지 확인합니다.
- '가져오기' 버튼을 눌러 서식을 다운로드하고, '휴대전화번호' 열이 포함되어 있는지 확인합니다.
- 샘플 데이터를 작성하여 업로드한 후, 테이블에 휴대전화번호가 올바르게 반영되는지 확인합니다.
- '내보내기'를 수행하여 다운로드된 파일에 휴대전화번호가 포함되어 있는지 확인합니다.