# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # 개발 서버 시작 (포트 9002)
npm run build        # 프로덕션 빌드
npm run lint         # ESLint 검사
npm run typecheck    # TypeScript 타입 검사 (tsc --noEmit)
npm run genkit:dev   # Genkit AI 개발 서버
```

> `next.config.ts`에서 `typescript.ignoreBuildErrors`와 `eslint.ignoreDuringBuilds`가 모두 `true`로 설정되어 있습니다. 빌드 오류는 `npm run typecheck`와 `npm run lint`로 별도 확인하세요.

## Architecture

### Stack
- **Framework**: Next.js 15 (App Router) + TypeScript
- **Database/Auth**: Supabase (PostgreSQL + Auth + RLS)
- **UI**: shadcn/ui (Radix UI 기반) + Tailwind CSS
- **Charts**: Recharts (`ChartContainer` 래퍼 필수 사용)
- **AI**: Google Genkit (`src/ai/`)
- **Excel 처리**: exceljs (업로드·파싱), xlsx (다운로드)

### Directory Structure
- `src/app/(dashboard)/` — 인증된 사용자 전용 라우트 그룹 (레이아웃에서 로그인 리다이렉트 처리)
- `src/app/(dashboard)/admin/` — 관리자 전용 라우트 (미들웨어 + 레이아웃 이중 보호)
- `src/components/dashboard/` — 대시보드 전용 컴포넌트 (차트, 네비게이션, 필터 등)
- `src/components/ui/` — shadcn/ui 기본 컴포넌트 (직접 수정 자제)
- `src/lib/` — 데이터 패칭 (`data.ts`), 타입 (`types.ts`), Supabase 클라이언트들, 서버 액션 (`actions.ts`)

### Authentication & Authorization
- **미들웨어** (`src/lib/supabase/middleware.ts`): 세션 갱신 + `/admin/*` 경로를 `admin` 역할만 접근 가능하도록 차단
- **레이아웃** (`src/app/(dashboard)/layout.tsx`): 추가로 `user` 존재 여부 확인 후 `/login` 리다이렉트
- **역할**: `profiles` 테이블의 `role` 컬럼 — `admin` 또는 `teacher`
- 교사는 자신의 `assigned_grade`(담당 학년)에 해당하는 학급만 조회·수정 가능

### Key Business Logic

**학사학년도 기반 학년 계산** (`DEVELOPMENT_NOTES.md` 참조):
- `Grade = 4 - (GraduationYear - AcademicYear)`
- 역산: `GraduationYear = AcademicYear + (4 - Grade)`
- `system_settings` 테이블의 `baseYear`가 기준; 변경 시 전체 학생 학년이 자동 연동됨

**데이터 소스 원칙**:
- 모든 설정·마스터 데이터는 **Supabase DB** 사용 (`system_settings`, `master_certificates`, `profiles` 테이블)
- 로컬 JSON 파일(`src/lib/certificates.json` 등)에 설정값을 저장하거나 읽지 말 것

**핵심 Supabase 테이블**:
- `students` + `student_employments` (1:1 조인) — 학생 기본 정보 및 취업 현황
- `field_training_records` — 현장실습 기록 (1:N)
- `student_academic_history` — 학적 이력 (Time-Travel 기능용, `baseYear` 기준 과거 학반·전공 조회)
- `system_settings` — `baseYear` 등 시스템 설정
- `master_certificates` — 자격증 목록 및 급수

**데이터 패칭 패턴** (`src/lib/data.ts`):
- `getFilteredStudentData(graduationYear, baseYear?)` — 학생·취업·실습 데이터를 단일 평탄화 객체로 반환
- 학적 이력이 있으면 `major`, `class_info` 등을 히스토리 값으로 덮어씀 (Time-Travel)

### Server Actions
- 데이터 변경 후 반드시 `revalidatePath`를 호출하여 캐시 무효화
- 페이지별 `actions.ts` 파일에 위치 (예: `src/app/(dashboard)/admin/students/actions.ts` 등)

### Mobile Support
- 데스크톱: 사이드바 네비게이션 (`Nav`)
- 모바일: 상단 바 (`MobileTopBar`) + 하단 탭 (`MobileBottomTab`)
- 모달 내 모든 입력 필드는 초기화(X) 버튼 포함; 선택 해제 시 `CLEARED` 상수 처리

### 전공 정렬 순서
`MAJOR_SORT_ORDER` (`src/lib/types.ts`)에 정의된 순서를 따름. 새 전공 추가 시 이 배열에도 반영.

## RLS (Row Level Security)
새 테이블 생성 시 Supabase 대시보드에서 `admin`/`teacher` 역할별 접근 정책을 반드시 설정해야 합니다.
