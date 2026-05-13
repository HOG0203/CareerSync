# PDCA Plan: '업체방문' 기능 및 기업 상세 관리 시스템 구축

## 1. 개요 (Overview)
- **목표**: 추수지도 시 업체별 학생 취업 및 실습 현황을 한눈에 파악하고, 기업의 상세 정보를 체계적으로 관리할 수 있는 '업체방문' 페이지 구축.
- **주요 가치**:
  - 업체 중심의 데이터 통합 (기업 정보 + 소속 학생 정보).
  - 관리자의 기업 정보 직접 관리 및 최신화.
  - 효율적인 업체 방문 및 추수지도 지원.

## 2. 요구사항 분석 (Requirements Analysis)

### 2.1 주요 기능
- **업체 검색**: 기업체명을 기반으로 한 실시간 또는 통합 검색 기능.
- **기업 상세 정보 표시**: 
  - 기본 정보: 기업체명, 소재지, 업종, 기업형태.
  - 채용 정보: 직무, 급여, 상여, 근무시간, 고용형태, 복리후생.
  - 요구 사항: 전공, 자격증, 기타.
  - 기타: 기업의 특장점.
- **소속 학생 현황**:
  - 해당 업체에 취업한 학생 리스트 (졸업연도, 학과, 이름 표시).
  - 해당 업체에서 현장실습 중인 학생 리스트.
- **관리자 기능**: 기업 상세 정보의 등록, 수정, 삭제 기능.

### 2.2 데이터 모델 설계 (새로운 테이블 필요)
- **`companies` 테이블**:
  - `id`: UUID (Primary Key)
  - `name`: TEXT (기업명, Unique)
  - `location`: TEXT (소재지)
  - `industry`: TEXT (업종)
  - `company_type`: TEXT (기업형태)
  - `job_description`: TEXT (직무)
  - `salary`: TEXT (급여)
  - `bonus`: TEXT (상여)
  - `working_hours`: TEXT (근무시간)
  - `employment_type`: TEXT (고용형태)
  - `welfare`: TEXT (복리후생)
  - `required_major`: TEXT (전공)
  - `required_certificates`: TEXT (자격증)
  - `etc`: TEXT (기타)
  - `strengths`: TEXT (기업의 특장점)
  - `updated_at`: TIMESTAMP

## 3. 단계별 추진 계획 (Step-by-Step Plan)

### Phase 1: 데이터베이스 스키마 구축
- [ ] `docs/03-sql`에 `companies` 테이블 생성 스크립트 작성 및 실행.
- [ ] `student_employments` 및 `field_training_records`의 `company` 필드와 `companies.name` 연동을 위한 인덱스 검토.

### Phase 2: API 및 서버 액션 구현
- [ ] 기업 정보 CRUD를 위한 서버 액션 작성 (`src/app/(dashboard)/company-visit/actions.ts`).
- [ ] 특정 기업명으로 소속 취업생 및 실습생을 조회하는 쿼리 작성.

### Phase 3: '업체방문' 페이지 UI 구현
- [ ] `src/app/(dashboard)/company-visit/page.tsx` 라우트 생성.
- [ ] 업체 검색 섹션 및 검색 결과 리스트 구현.
- [ ] 기업 상세 정보 카드 UI 구현.
- [ ] 기업별 소속 학생 현황 테이블/리스트 구현.

### Phase 4: 관리자 편집 기능 구현
- [ ] 관리자 권한 확인 로직 적용.
- [ ] 기업 정보 편집을 위한 모달(Modal) 또는 폼(Form) 구현.
- [ ] 수정 사항 실시간 반영 및 토스트 알림 추가.

### Phase 5: 메뉴 연동 및 최종 테스트
- [ ] 사이드바 네비게이션에 '업체방문' 메뉴 추가.
- [ ] 전체적인 데이터 정합성 및 권한 체크 테스트.

## 4. 기대 결과 (Expected Outcome)
- 업체 방문 시 필요한 모든 정보를 한 화면에서 파악하여 상담 질 향상.
- 학교 보유 기업 DB의 체계적 관리 및 데이터 자산화.
- 학생 매칭을 위한 기업 요구사항 데이터 활용도 증대.
