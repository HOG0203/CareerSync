# PDCA Design: 취업 현황 그리드 페이지 구현

## 1. 개요 (Overview)
- **목표**: 3학년 전체 반별/학생별 취업 현황을 시각적 그리드로 구현하여 직관적인 관리 환경 제공.
- **주요 구성**: 
  - 가로 스크롤이 가능한 다중 컬럼 그리드.
  - 각 컬럼 상단에 반 정보 및 담임/총원 정보 표시.
  - 학생별 상태 컬러링 및 호버 툴팁.

## 2. UI/UX 상세 설계

### 2.1 네비게이션 변경
- **파일**: `src/components/dashboard/nav.tsx`
- **변경 사항**: `baseMenuItems`에 다음 항목 추가.
  ```typescript
  { href: '/employment-status', label: '취업현황', icon: Grid3X3 }
  ```

### 2.2 페이지 구조 (`/employment-status`)
- **레이아웃**: `flex overflow-x-auto gap-4 p-4` (반별 컬럼이 가로로 배치됨)
- **컬럼(ClassColumn)**:
  - 헤더: 반 이름(예: 기계3-1), 총원 정보.
  - 바디: 학생 셀(`StudentCell`) 목록 (번호 순 정렬).

### 2.3 학생 셀 (`StudentCell`) 디자인
- **기본 스타일**: `w-full h-8 flex items-center justify-center text-[11px] border-b border-r cursor-default`
- **컬러 매핑 (배경색)**:
  - `일반취업`: `bg-blue-600 text-white`
  - `취업맞춤반`: `bg-cyan-500 text-white`
  - `일학습병행`: `bg-rose-500 text-white`
  - `도제`: `bg-purple-600 text-white`
  - `군특성화`: `bg-green-600 text-white`
  - `기술사관`: `bg-orange-500 text-white`
  - `면접진행중`: `bg-yellow-400 text-yellow-900`
  - `확인불가`: `bg-zinc-500 text-white`
  - `미정/기타`: `bg-white text-black`
- **호버 인터랙션**: Shadcn UI `Tooltip` 컴포넌트 사용.
  - 표시 내용: [이름] 취업처 / 직무 / 상태 / 특이사항(remarks)

## 3. 데이터 처리 설계

### 3.1 데이터 가공 로직
1. `getStudentEmploymentData()` 호출.
2. `class_info`를 기준으로 데이터를 그룹화 (Record<string, StudentEmploymentData[]>).
3. 각 그룹(반) 내에서 `student_number` 순으로 오름차순 정렬.
4. (선택 사항) 이미지와 같이 최대 번호까지 빈 셀(Placeholder)을 생성하여 높이 균형 유지.

### 3.2 컴포넌트 분리
- `EmploymentStatusGrid`: 메인 컨테이너 및 데이터 페칭.
- `ClassSection`: 반별 헤더 및 학생 그리드 섹션.
- `StudentCell`: 툴팁을 포함한 개별 학생 노드.

## 4. 보안 및 권한
- `src/app/(dashboard)/employment-status/page.tsx`는 기존 대시보드와 동일한 세션 체크 및 RBAC 적용.
