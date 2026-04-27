# [Plan] 옥저인증 출결 관리 시스템 구축

## 1. 개요
학생들의 학기별 출결 현황(결석, 지각, 조퇴, 결과)을 엑셀로 일괄 업로드하고, 이를 '옥저인증' 관리 화면에서 학년/학과별로 조회할 수 있는 시스템을 구축합니다.

## 2. 데이터베이스 설계 (DB Schema)
전용 테이블 `student_attendance`를 생성합니다.

- `id`: UUID (Primary Key)
- `student_id`: UUID (Foreign Key -> students.id)
- `academic_year`: number (학사학년도)
- `grade`: number (학년)
- `semester`: number (학기)
- `school_days`: number (수업일수)
- **출결 상세 (각 3종: 질병, 미인정, 기타)**
    - `absent_disease`, `absent_unexcused`, `absent_other`
    - `late_disease`, `late_unexcused`, `late_other`
    - `early_disease`, `early_unexcused`, `early_other`
    - `out_disease`, `out_unexcused`, `out_other`
- `remarks`: text (특기사항)
- `updated_at`: timestamp

## 3. 주요 구현 기능

### 3.1. 서버 사이드 (Server Actions)
- `attendance/actions.ts` 개발
- **Excel Parser**: 5행의 소분류(질병/미인정/기타) 위치를 동적으로 파악하여 데이터를 추출하는 로직
- **Student Matcher**: `학과+반+번호+이름`을 기반으로 시스템 내 UUID와 매칭
- **Batch Upsert**: 학기별 중복 데이터는 업데이트하고 신규 데이터는 삽입

### 3.2. 업로드 인터페이스 (Admin UI)
- `admin/grades/summary/attendance/attendance-import-modal.tsx`
- 성적 업로드와 통일된 디자인의 드래그 앤 드롭 업로드 UI
- 업로드 전 파싱 결과 미리보기 기능

### 3.3. 출결 현황 화면 (View)
- `admin/grades/summary/attendance/page.tsx`
- **전체 출결 테이블**: 질병, 미인정, 기타 항목을 모두 포함한 전체 리스트 출력
- **필터링**: 학년, 학과, 반별 실시간 필터링
- **시각적 강조**: 미인정(무단) 지수가 높은 학생(예: 무단결석 3회 이상) 빨간색 강조

## 4. 추진 일정
1. [ ] **Step 1**: SQL을 통한 `student_attendance` 테이블 생성
2. [ ] **Step 2**: 서버 액션(`actions.ts`) 및 파싱 엔진 구현
3. [ ] **Step 3**: 업로드 모달 및 UI 연동
4. [ ] **Step 4**: 전체 출결 현황 출력 페이지 완성
