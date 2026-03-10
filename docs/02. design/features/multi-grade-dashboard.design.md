# [DESIGN] 다학년 통합 대시보드 단계별 구현 설계서

## 1. 개요
사용자 권한 및 담당 학급에 따른 자동 필터링 기능을 포함하고, 학년별로 차별화된 지표를 제공하는 대시보드 시스템의 상세 설계입니다.

## 2. 단계별 구현 설계

### [Step 1] 데이터 레이어 및 권한 프로필 연동
- **Query 1 (진로희망)**: `students` 테이블의 `career_aspiration` 집계.
- **Query 2 (자격증)**: `students.certificates` JSONB 배열 크기별 인원수 집계.
- **Query 3 (병역희망)**: `students` 테이블의 **`military_status`** (학반관리 동일 필드) 집계.
- **Context**: `profiles`의 `assigned_grade`를 조회하여 담임 학년 우선 필터링 로직 구현.

### [Step 2] DashboardFilters 및 지능형 로직
- **학년 선택**: 1, 2, 3학년 배타적 선택 (전체 옵션 제거).
- **초기값 규칙**:
  - 담임교사: `assigned_grade` 기반 자동 선택.
  - 관리자/비담임: 3학년(기본값) 자동 선택.

### [Step 3] 1·2학년 전용 시각화 컴포넌트
- **CareerAspirationChart**: `Recharts.PieChart`. 학급관리에서 입력한 진로희망 비중.
- **CertificateStatusChart**: **3학년과 동일한 디자인**. 보유 개수별(0~6개 이상) 분포.
- **MilitaryStatusChart**: `Recharts.PieChart` (Donut). 학급관리에서 입력한 **병역희망(`military_status`)** 비중.

### [Step 4] 조건부 레이아웃 전환
- **View Switching**: `searchParams.grade`에 따라 3학년 전용 UI와 1·2학년 전용 UI로 완전 분리.
- **반응형**: `lg: (1024px)` 기준 유지.

## 3. 데이터 매핑 정의서 (Lower Grades)

| 지표명 | 소스 컬럼 (students 테이블) | 시각화 방식 |
| :--- | :--- | :--- |
| **진로희망** | `career_aspiration` | Pie Chart (분포) |
| **자격증 현황** | `certificates` (JSONB) | Grade 3 동일 (분포) |
| **병역 희망** | **`military_status`** | Donut Chart (비중) |

## 4. 보안 및 성능 고려사항
- **실시간성**: `students` 테이블 데이터 직결로 담임 입력 시 즉시 반영.
- **권한**: 담임교사가 대시보드에서 타 학년/학과 데이터를 조회할 수 있도록 RLS 정책 확인 필요.
