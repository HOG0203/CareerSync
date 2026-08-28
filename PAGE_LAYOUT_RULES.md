# CareerSync 페이지별 레이아웃 & 스크롤 표준 가이드 (PAGE_LAYOUT_RULES)

> **[IMPORTANT] AI 에이전트 및 개발자 필독 규칙**
> 1. `src/app/(dashboard)/layout.tsx`는 모든 대시보드 페이지가 공유하는 최상위 부모 레이아웃입니다. **절대로 개별 페이지의 스크롤 문제를 해결하기 위해 `layout.tsx`의 `overflow`나 `height` 구조를 함부로 변경하지 마십시오.**
> 2. 스크롤 동작 방식은 반드시 **개별 페이지(`page.tsx` 또는 `client.tsx`)의 최상단 컨테이너 레벨**에서 결정합니다.

---

## 🧭 페이지별 스크롤 분류 표준 체계 (3대 모드)

### 📊 모드 A: 100% 뷰포트 핏 (내부 전용 가상 스크롤 / 외부 스크롤 0px)
* **목적**: 엑셀 및 구글 시트 형태의 대량 데이터 그리드로, 바깥 화면이 위아래로 출렁이지 않고 화면에 꽉 찬 채 **시트 내부에서만 행/열이 가상 스크롤**되어야 함.
* **컨테이너 규칙**:
  * 최상위 래퍼: `className="flex flex-col h-[calc(100dvh-150px)] lg:h-[calc(100vh-115px)] max-h-[calc(100dvh-150px)] lg:max-h-[calc(100vh-115px)] min-h-0 gap-2.5 sm:gap-3 overflow-hidden"`
  * 테이블 래퍼: `className="flex-1 min-h-0 h-full overflow-hidden"`
  * 내부 스크롤 div: `className="relative outline-none bg-white overflow-auto w-full flex-1 min-h-0 h-full custom-scrollbar"`
* **해당 페이지**:
  1. `/students` (학생 취업 현황 - `StandardSpreadsheetTable`)
  2. `/class-management` (학반 관리 - `StandardSpreadsheetTable`)
  3. `/admin/students` (학생 등록 및 진급 관리 - `StandardSpreadsheetTable`)

---

### 🏢 모드 B: 좌우 2단 독립 분할 패널 (Master-Detail / 외부 스크롤 0px)
* **목적**: 좌측에는 기업 목록, 우측에는 기업 상세 정보가 분리되어 **각 패널 내부에서만 독립적으로 스크롤**되어야 함.
* **컨테이너 규칙**:
  * 최상위 래퍼: `className="flex flex-col h-[calc(100dvh-150px)] lg:h-[calc(100vh-115px)] max-h-[calc(100dvh-150px)] lg:max-h-[calc(100vh-115px)] min-h-0 gap-2.5 sm:gap-4 overflow-hidden"`
  * 그리드 래퍼: `className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-5 flex-1 min-h-0 h-full overflow-hidden"`
  * 좌측 패널: `className="lg:col-span-4 flex flex-col min-h-0 h-full overflow-hidden"` (목록 영역에 `overflow-y-auto custom-scrollbar`)
  * 우측 패널: `className="lg:col-span-8 flex flex-col gap-4 overflow-y-auto h-full min-h-0 custom-scrollbar pr-1"`
* **해당 페이지**:
  1. `/company-info` (업체별 상세 정보)

---

### 📜 모드 C: 단일 외부 스크롤 (자연스러운 세로 확장 / 내부 스크롤 없음)
* **목적**: 요약 카드, 차트, 바둑판 그리드, 대량 카드 리스트 등이 아래로 자연스럽게 늘어나며 **마우스 휠로 전체 페이지가 시원하게 스크롤**되어야 함.
* **컨테이너 규칙**:
  * 최상위 래퍼: `className="flex flex-col gap-4 sm:gap-5 w-full pb-20 sm:pb-16"` (`h-full` 및 `overflow-hidden` 금지)
  * 카드/컴포넌트: 내부 `overflow-y-auto`를 제거하여 자연 높이로 확장
  * 하단 여백: 모바일 하단 탭바 및 뷰포트 경계에 잘리지 않도록 `pb-20 sm:pb-16` 필수 적용
* **해당 페이지**:
  1. `/admin/certification` (옥저인재인증제 종합 평가)
  2. `/labor-education` (노동인권교육 이수현황 그리드)
  3. `/employment-status` (진로코스/취업현황 바둑판 그리드)
  4. `/dashboard` (통합 대시보드)
  5. `/admin/certification/certificates` (자격증 발급 관리)
  6. `/admin/certification/attendance` (출결 현황 관리)
  7. `/admin/certification/grades` (성적 관리 및 석차 조회)
  8. `/admin/settings` (시스템 설정 및 기준 관리)
  9. `/admin/users` (사용자 계정 관리)
  10. `/admin/login-history` (로그인 이력 관리)
  11. `/admin/audit-logs` (감사 로그 관리)
  12. `/field-training` (현장실습 관리 타임라인/카드)

---

## 🔒 유지보수 체크리스트
- [ ] 새로운 페이지를 추가하거나 레이아웃을 손볼 때, 반드시 위의 **모드 A / B / C** 중 하나를 선택하여 컨테이너 클래스를 적용할 것.
- [ ] 모바일 환경(`lg:hidden`)에서는 이중 스크롤이 발생하지 않도록 단일 스크롤을 유지할 것.
- [ ] `layout.tsx`의 `<SidebarInset>` 및 메인 래퍼 구조를 임의로 수정하지 말 것.
