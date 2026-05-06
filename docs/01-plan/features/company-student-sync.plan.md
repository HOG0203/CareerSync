# PDCA Plan: 업체정보 - 학생 취업 현황 자동 연동

## 1. 개요 (Overview)
- **목적**: 업체정보 페이지(`/company-info`)의 '취업생 현황' 섹션을 실제 학생들의 취업 상태 데이터와 실시간으로 연동.
- **배경**: 현재 업체정보 상세 페이지의 취업생 목록이 `student_employments` 테이블의 데이터를 올바르게 조회하지 못하거나 필터링 조건이 미흡함.
- **핵심 가치**: 데이터 정합성 확보 및 관리 효율성 증대.

## 2. 현재 문제점 (Current Issues)
1. **조회 로직 오류**: `getCompanyDetails` 서버 액션에서 `student_employments`의 `id`를 `students`의 `id`와 매칭하려고 시도함 (실제로는 `student_ref_id`를 사용해야 함).
2. **필터링 조건 누락**: '취업생 현황' 탭에서 실제 취업 상태(`employment_status = '취업'`)인 학생만 보여주어야 하나, 해당 조건이 누락됨.
3. **스키마 불일치**: `student_employments` 테이블에 `student_id` 컬럼이 없는데 쿼리에서 호출함 (`student_ref_id`가 올바른 컬럼명).

## 3. 해결 방안 (Proposed Solution)
1. **서버 액션 수정**: `src/app/(dashboard)/company-info/actions.ts`의 `getCompanyDetails` 함수 고도화.
   - `student_employments` 조회 시 `employment_status = '취업'` 조건 추가.
   - `students` 테이블과의 조인 로직을 `student_ref_id` 기준으로 수정.
2. **데이터 무결성 확인**: `field_training_records` 연동 로직도 함께 점검하여 정상 동작 확인.

## 4. 상세 구현 계획 (Implementation Tasks)
- [ ] `src/app/(dashboard)/company-info/actions.ts` 수정
  - [ ] `getCompanyDetails` 내 `employees` 조회 쿼리 수정 (필터 추가, 컬럼명 수정)
  - [ ] `employeeDetails` 조회 시 `student_ref_id` 사용하도록 변경
- [ ] UI 확인 및 테스트
  - [ ] `/company-info` 페이지에서 특정 업체 선택 시 취업생 목록이 정상적으로 표시되는지 확인
  - [ ] `/students` 페이지의 취업 상태 변경이 `/company-info`에 즉시 반영되는지 확인

## 5. 기대 효과 (Expected Benefits)
- 학생 취업 관리 데이터와 업체 정보 간의 완벽한 동기화.
- 수동 데이터 관리 포인트 제거로 운영 효율 향상.
