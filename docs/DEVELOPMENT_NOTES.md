# CareerSync 개발 가이드 및 참고사항 (Reference)

이 문서는 CareerSync 프로젝트의 핵심 비즈니스 로직과 개발 규칙을 담고 있습니다. 새로운 기능을 추가하거나 수정할 때 반드시 참조하세요.

---

## 📅 1. 학사학년도 및 학년 공식 (Academic Logic)

CareerSync는 '졸업연도'가 아닌 **'현재 학사학년도'**를 기준으로 학생의 학년을 계산합니다.

- **기본 공식**: `Grade = 4 - (GraduationYear - AcademicYear)`
- **조회 공식 (데이터 패칭 시)**: `GraduationYear = AcademicYear + (4 - Grade)`
- **동작 예시 (2026학년도 기준)**:
  - 3학년 조회: `2026 + (4 - 3) = 2027년` 졸업 예정자
  - 2학년 조회: `2026 + (4 - 2) = 2028년` 졸업 예정자
  - 1학년 조회: `2026 + (4 - 1) = 2029년` 졸업 예정자

> **주의**: 시스템 설정의 `baseYear`가 바뀌면 전체 학생의 '현재 학년'이 자동으로 한 학년씩 올라가거나 내려가게 설계되어 있습니다.

---

## 🗄️ 2. 데이터 소스 규칙 (Data Source)

- **절대 금지**: 로컬 JSON 파일(`src/lib/settings.json` 등)에 설정값을 저장하거나 읽지 마세요.
- **표준**: 모든 시스템 설정 및 마스터 데이터는 **Supabase DB**를 사용합니다.
- **핵심 테이블**:
  - `system_settings`: 학사학년도(`baseYear`) 등 기본 설정
  - `master_certificates`: 자격증 목록 및 급수
  - `profiles`: 사용자 권한(admin, teacher) 및 담당 학반

---

## 🎨 3. UI/UX 컨벤션

### 3.1 필터 (Filters)
- 필터 컴포넌트(`DashboardFilters`) 사용 시 반드시 `baseYear`를 전달하세요.
- 디자인은 `slate-50` 배경과 아이콘 조합을 유지합니다.

### 3.2 차트 (Charts)
- Recharts 사용 시 `ResponsiveContainer` 경고를 피하기 위해 `ChartContainer`를 사용하세요.
- 높이는 `h-[300px]`와 같이 명시적인 클래스를 부여해야 차트가 증발하지 않습니다.

### 3.3 모바일 (Mobile)
- 모바일 전용 모달은 `MobileDetailModal`을 사용하며, 모든 입력 필드에는 **지우기(X)** 기능을 포함해야 합니다.
- 드롭다운 선택 해제 시에는 `CLEARED` 상수를 처리하는 로직을 포함하세요.

---

## 🚀 4. 배포 및 환경 설정

- **Server Actions**: 데이터 수정 시 반드시 `revalidatePath`를 호출하여 실시간 갱신을 보장하세요.
- **RLS (Row Level Security)**: 새로운 테이블 생성 시 관리자(admin)와 교사(teacher)의 접근 권한을 Supabase 대시보드에서 반드시 설정해야 합니다.

---

## 🔮 5. 추후 개발 사항 (Future Roadmap)

### 5.1 기능 고도화
- **AI 기반 취업 예측**: 학생의 스펙(자격증, 성적 등)을 바탕으로 학과별 취업 성공률을 제안하는 대시보드 카드 구현.
- **PDF 리포트 생성**: 대시보드 통계 및 취업 현황을 학교 보고용 PDF로 일괄 출력하는 기능.
- **실시간 감사 로그 (Audit Logs)**: 교사들의 데이터 수정 이력(누가, 언제, 무엇을)을 관리자가 확인할 수 있는 인터페이스 구축.

### 5.2 유지보수 및 최적화
- **레거시 코드 정리**: `src/app/admin/settings/` 등 파일 기반의 구형 설정 로직 최종 삭제.
- **자격증 데이터 재검증**: `AdminStudentHub`와 `StandardSpreadsheetTable` 간의 자격증 동기화 로직 전수 검사.
- **학년도 전이 테스트**: 관리자 설정에서 학기 초 `baseYear` 변경 시 전체 데이터의 학년 표시가 의도대로 시프트되는지 엣지 케이스 확인.

---
*Last Updated: 2026-03-04 by bkit*
