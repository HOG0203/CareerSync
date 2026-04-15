# PDCA Plan: 취업 현황 그리드 페이지 구현

## 1. 개요 (Overview)
- **목표**: 3학년 전체 반별/학생별 취업 현황을 한눈에 볼 수 있는 시각적 그리드 페이지 구현.
- **주요 기능**:
  - 사이드바 '취업현황' 탭 추가.
  - 반(Class)별 컬럼 및 학생 번호순 그리드 레이아웃.
  - 취업 상태별 컬러 코딩 (취업: 파랑, 미취업: 흰색, 기타: 노랑/빨강 등).
  - 학생 이름 호버(Hover) 시 상세 취업 정보 툴팁 표시.
- **참고 이미지**: 사용자가 제공한 엑셀 형태의 3학년 취업 현황표.

## 2. 분석 및 설계 (Analysis & Design)

### 2.1 데이터 소스
- **테이블**: `student_employments`
- **주요 필드**:
  - `student_name`: 학생 이름
  - `class_info`: 반 정보 (예: 기계3-1)
  - `student_number`: 학생 번호
  - `employment_status`: 취업 상태 (컬러 코딩의 기준)
  - `company`: 취업처 (호버 상세 정보)
  - `role`: 직무 (호버 상세 정보)

### 2.2 UI 컴포넌트 구조
- `EmploymentGridPage`: 메인 페이지 컴포넌트 (`src/app/(dashboard)/employment-status/page.tsx`)
- `ClassColumn`: 각 반을 나타내는 컬럼 컴포넌트.
- `StudentCell`: 개별 학생의 상태를 보여주는 셀 컴포넌트 (Shadcn UI Tooltip/Popover 활용).

### 2.3 컬러 매핑 전략 (예시)
- **파랑**: 현장실습/취업 확정
- **노랑/주황**: 중도 귀교/대기 중
- **빨강**: 미취업/기타 특이사항
- **흰색**: 일반 상태

## 3. 단계별 추진 계획 (Step-by-Step Plan)

### Phase 1: 네비게이션 및 라우팅 설정
- [ ] `src/components/dashboard/nav.tsx`에 '취업현황' 메뉴 아이템 추가.
- [ ] `src/app/(dashboard)/employment-status/page.tsx` 경로 생성.

### Phase 2: 데이터 연동 및 가공
- [ ] `getStudentEmploymentData`를 사용하여 전체 학생 데이터 호출.
- [ ] 호출된 데이터를 `class_info`별로 그룹화하고 `student_number` 순으로 정렬하는 로직 구현.

### Phase 3: 그리드 UI 구현
- [ ] 이미지와 유사한 다중 컬럼 레이아웃 (Grid/Flex) 작성.
- [ ] 학생 셀 디자인 및 취업 상태별 배경색 로직 적용.

### Phase 4: 호버 인터랙션 추가
- [ ] Shadcn UI의 `Tooltip` 또는 `Popover`를 사용하여 학생 셀 호버 시 상세 정보(회사명, 직무, 기간 등) 표시.

### Phase 5: 최종 검증 및 테스트
- [ ] 실제 데이터와 매칭 여부 확인.
- [ ] 모바일/데스크톱 반응형 레이아웃 점검.

## 4. 기대 결과 (Expected Outcome)
- 교직원이 한눈에 전체 학생의 취업 흐름을 파악하여 관리 효율성 증대.
- 데이터 기반의 실시간 모니터링 체계 구축.
