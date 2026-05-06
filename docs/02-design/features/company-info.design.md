# PDCA Design: '업체정보' 통합 관리 시스템

## 1. 데이터베이스 설계 (Database Schema)

### 1.1 `companies` 테이블 (신규)
기업의 상세 정보를 저장합니다. `name` 컬럼을 고유값으로 설정하여 기존 학생 데이터와 연동합니다.

```sql
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,          -- 기업체명 (연동 키)
  location TEXT,                      -- 소재지
  industry TEXT,                      -- 업종
  company_type TEXT,                  -- 기업형태
  job_description TEXT,               -- 직무
  salary TEXT,                        -- 급여
  bonus TEXT,                         -- 상여
  working_hours TEXT,                 -- 근무시간
  employment_type TEXT,               -- 고용형태
  welfare TEXT,                       -- 복리후생
  required_major TEXT,                -- 전공
  required_certificates TEXT,         -- 자격증
  etc TEXT,                           -- 기타
  strengths TEXT,                     -- 기업의 특장점
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 검색 성능 향상을 위한 인덱스
CREATE INDEX idx_companies_name ON public.companies(name);
```

### 1.2 데이터 연동 로직 (Join Strategy)
- **취업생 조회**: `student_employments` 테이블에서 `company` 컬럼이 `companies.name`과 일치하고, `employment_status`가 '취업'인 학생 검색. `student_ref_id`를 사용하여 `students.id`와 조인.
- **실습생 조회**: `field_training_records` 테이블에서 `company` 컬럼이 `companies.name`과 일치하고, 현재 실습 중(`hiring_status`가 '진행중' 또는 '채용전환')인 학생 검색. `student_id`를 사용하여 `students.id`와 조인.

## 2. UI/UX 설계 (UI Design)

### 2.1 메인 레이아웃 (`/company-info`)
- **상단**: 검색바 (실시간 기업명 검색).
- **중앙**: 검색 결과 리스트 (카드 형태).
- **상세 뷰**: 선택된 기업의 모든 상세 항목을 그리드 레이아웃으로 표시.

### 2.2 기업 상세 정보 카드 구성
- **Header**: 기업명, 기업형태, 업종, 소재지.
- **Section 1 (채용조건)**: 급여, 상여, 근무시간, 고용형태, 복리후생.
- **Section 2 (요구역량)**: 전공, 자격증, 기타.
- **Section 3 (특장점)**: 기업의 특장점 (텍스트 영역).

### 2.3 학생 현황 섹션
- **Tabs**: [취업생 현황], [현장실습생 현황]
- **Table**: 이름, 학과, 학년/졸업연도, 현재 상태.

### 2.4 관리자 편집 모달
- 모든 필드를 입력/수정할 수 있는 폼 제공.
- `Dialog` 컴포넌트 활용.

## 3. API 및 서버 액션 명세

### 3.1 `getCompanies(search?: string)`
- 기업 목록 검색 및 조회.
### 3.2 `getCompanyWithStudents(companyName: string)`
- 특정 기업의 상세 정보와 해당 기업 소속 학생들을 통합 조회.
### 3.3 `upsertCompany(data: CompanyInput)`
- 기업 정보 등록 및 수정 (관리자 전용).

## 4. 권한 제어 (Security)
- **조회**: 모든 교직원 (`admin`, `teacher`).
- **등록/수정/삭제**: 관리자 (`admin`) 전용 버튼 노출 및 서버 사이드 권한 검증.

## 5. 단계별 구현 작업 (Tasks)
- [ ] SQL 스크립트 실행 (`companies` 테이블 생성).
- [ ] 서버 액션 정의 (`src/app/(dashboard)/company-info/actions.ts`).
- [ ] 메인 페이지 및 검색 UI 구현.
- [ ] 관리자 전용 편집 폼 구현.
- [ ] 사이드바 메뉴 추가 (`src/components/dashboard/nav.tsx`).
