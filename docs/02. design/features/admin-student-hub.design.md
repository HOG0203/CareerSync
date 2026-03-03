# PDCA Design: 관리자 통합 학생 및 진급 관리 시스템

## 1. 인터페이스 설계

### 1.1 관리자 전용 학생 페이지 (`/admin/students`)
- **접근 권한**: `role === 'admin'` 필수.
- **데이터 범위**: `student_employments` 테이블의 전체 레코드 (학년 제한 없음).
- **구성 요소**:
  - **통계 배지**: 재학생(1/2/3학년) 총 인원수 실시간 요약.
  - **확장형 필터**: 졸업연도별(학년별) 필터링이 가능한 `DashboardFilters` 통합.
  - **전역 테이블**: 인적사항 및 학적 이력을 포함한 통합 스프레드시트.

### 1.2 진급 워크플로우
- **선택**: 특정 학년(예: 1학년) 전체 필터링 후 상단 '전체 선택' 체크박스 클릭.
- **트리거**: '진급 설정' 버튼 클릭 -> `PromotionModal` 팝업.
- **실행**: 서버 액션을 통해 `student_academic_history` 기록과 동시에 소속 정보 업데이트.

## 2. 서버 및 데이터 설계

### 2.1 전용 쿼리 함수
- `getAllStudentDetails()`: 모든 학생 정보를 가져오며, 관리자용이므로 권한 제약 없이 전체 반 데이터를 리턴.

### 2.2 네비게이션 연동
- 사이드바(`Nav`) 컴포넌트에 관리자 전용 섹션(Admin Only) 하위에 '학생/진급 관리' 메뉴 추가.

## 3. 구현 단계 (Implementation Plan)
1. **Route**: `/src/app/(dashboard)/admin/students/page.tsx` 생성.
2. **Component**: `AdminStudentTable` (기존 `StudentTable`을 관리자용으로 래핑).
3. **Sidebar**: `Nav.tsx`에 메뉴 링크 추가.
