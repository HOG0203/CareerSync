# Plan: 노동인권교육 이수 현황 페이지 구축

## Objective
*   전체 사용자가 학생별 '노동인권교육' 이수 상태를 한눈에 파악할 수 있는 그리드 뷰 제공
*   관리자(Admin) 권한 사용자가 팝업창을 통해 이수 여부를 즉시 수정할 수 있는 기능 구현
*   이수(녹색)와 미이수(흰색)를 색상으로 구분하여 직관적인 현황 파악 지원

## Key Files & Context
*   **Database**: students 테이블에 labor_education_status 컬럼 추가
*   **Types**: src/lib/types.ts 내 StudentEmploymentData 인터페이스 업데이트
*   **Actions**: src/app/students/actions.ts 내 updateStudentField 활용
*   **Page**: src/app/(dashboard)/labor-education/page.tsx (신규)
*   **Components**: 
    *   src/app/(dashboard)/labor-education/labor-grid-cell.tsx (신규)
    *   src/app/(dashboard)/labor-education/labor-education-filters.tsx (신규, 기존 필터 재활용)

## Implementation Steps

### 1. Database Schema Update
*   students 테이블에 labor_education_status (TEXT, 기본값 '미이수') 컬럼을 추가하는 SQL 실행
*   기존 학생들의 데이터를 '미이수'로 초기화

### 2. Data Model & Server Actions
*   src/lib/types.ts: StudentEmploymentData에 labor_education_status?: string 필드 추가
*   src/app/students/actions.ts: BASIC_INFO_FIELDS 배열에 labor_education_status 추가하여 자동 업데이트 지원

### 3. UI Implementation (Page & Component)
*   LaborEducationPage (/labor-education): employment-status 페이지의 로직을 기반으로 학과/반별 그리드 레이아웃 구성
*   LaborEducationGridCell: 이수 여부에 따른 색상 변이(Variant) 적용, 클릭 시 팝업(Popover) 표시, 관리자 전용 상태 변경 버튼 구현

### 4. Verification & Testing
*   페이지 접근 권한 확인
*   관리자 상태 변경 및 즉시 반영 확인
*   일반 사용자 읽기 전용 확인
