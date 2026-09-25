# [Plan] 모바일 상세 모달 디자인 시스템 통합 및 UI/UX 리디자인 (Mobile Detail Modal Redesign)

- **상태**: 완료 (Completed)
- **대상 파일**: `src/components/dashboard/standard-spreadsheet-table/mobile-detail-modal.tsx`
- **대상 페이지**:
  - `http://localhost:9002/admin/students` (관리자 학생 관리)
  - `http://localhost:9002/students` (학생 취업 관리)
- **작성일**: 2026-09-26
- **완료일**: 2026-09-26
- **작성자**: CareerSync 개발팀

---

## 🎯 1. 개요 및 배경 (Overview & Background)

### 1.1 배경
현재 `admin/students` 및 `students` 페이지의 모바일 뷰에서 행(학생)을 터치하면 상세 정보를 조회/수정할 수 있는 `MobileDetailModal`이 호출됩니다.
그러나 기존의 `MobileDetailModal`은 프로젝트 표준 디자인 시스템(`AddStudentModal`, `FieldTrainingModal`, `StudentPopover` 등)과 완전히 동떨어진 독자적이고 이질적인 스타일을 갖고 있어 브랜드 일관성과 사용자 경험을 심각하게 저해하고 있었습니다.

### 1.2 문제점 분석
1. **헤더의 시각적 이질감**:
   - 표준 모달: 화이트 배경(`bg-white border-b border-slate-100`) + 좌측 파스텔 톤 둥근 사각 아이콘 배지(`bg-indigo-50 text-indigo-600`) + 굵고 명확한 블랙 타이틀(`text-slate-900 font-black`) + 학과/반/번호 메타데이터.
   - 모바일 모달: 채도 높은 단색 보라색 띠(`bg-indigo-600 text-white`)로 전체를 덮어 시각적 피로감 및 위화감 유발.
2. **액션 버튼(바로가기)의 산만한 배치**:
   - 현장실습 열기 등 액션 버튼이 본문 입력 영역 최상단에 큰 크기로 덜컥 자리 잡아 폼 레이아웃의 흐름을 방해함.
3. **과도한 개별 박스(Card) 나열 및 작은 라벨**:
   - 모든 필드를 개별 카드(`rounded-xl border p-3`)로 1열 나열하여 세로 스크롤 길이가 지나치게 길어짐.
   - 라벨이 `text-[10px] text-slate-400`로 너무 작고 흐릿하여 가독성 부족.
4. **푸터 버튼 오인 가능성**:
   - 단순 닫기 버튼이 메인 액션처럼 진한 인디고(`bg-indigo-600`) 풀너비로 적용되어 있어 저장 버튼으로 착각하기 쉬움.

---

## 🛠️ 2. 개선 목표 및 디자인 가이드 (Design Goals)

### 2.1 프로젝트 표준 모달 룩앤필(Look & Feel) 통일
- **컨테이너**: `w-[95vw] sm:max-w-[520px] max-h-[90vh] flex flex-col p-0 border-none shadow-2xl rounded-2xl sm:rounded-3xl overflow-hidden bg-white`
- **헤더**:
  - `bg-white border-b border-slate-100 p-4 sm:p-5 shrink-0`
  - 좌측: `h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center`
  - 타이틀: 학생 이름 + 학과/반/번호 배지 (`text-slate-900 font-black text-lg`)
  - 서브타이틀: 상세 정보 및 수정 안내 + 전화번호 직접 걸기 링크
- **상단 퀵 액션 (도구바)**:
  - 14 크기의 비대한 버튼 대신, 정돈된 2열 그리드 형태의 퀵 액션 툴바로 개편.
- **폼 입력 영역 (Body)**:
  - 배경: 은은한 슬레이트 톤(`bg-slate-50/60`)
  - 라벨 스타일: 표준 폼 라벨(`text-xs font-bold text-slate-600 block`)
  - 읽기 전용 필드: 부드러운 읽기 전용 뱃지 박스 제공
  - 회사명 자동완성 추천 태그 목록 인디고 칩 스타일 정리.
- **푸터 (Footer)**:
  - `p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex gap-2 shrink-0`
  - 닫기 버튼: 편안한 중립 버튼(`variant="outline" bg-white border-slate-200 text-slate-700 hover:bg-slate-100 font-bold`)

---

## 📅 3. 단계별 상세 실행 계획 (Action Items)

### Phase 1: 헤더(Header) 및 모달 컨테이너 개편
- [x] `DialogContent` 둥근 모서리(`rounded-2xl sm:rounded-3xl`) 및 그림자 효과 통일
- [x] 상단 `bg-indigo-600` 단색 제거 및 `bg-white border-b border-slate-100` 클린 헤더 적용
- [x] 아이콘 배지(성명 이니셜 아바타) + 학생 성명 타이틀 + 학과/반/번호 메타 배지 구성
- [x] 전화번호 직접 걸기 링크를 헤더에 컴팩트하게 노출

### Phase 2: 상단 퀵 액션 바(Quick Action Bar) 슬림화
- [x] 현장실습(`field_training_action`) 및 추후 추가될 액션들을 위한 전용 그리드/툴바 구성
- [x] 에메랄드/인디고 톤의 둥근 모던 버튼으로 전환 (과도한 세로 높이 축소)

### Phase 3: 필드 입력 폼 UI/UX 및 가독성 개선
- [x] 개별 인풋 카드의 과도한 이중 보더 및 그림자 완화
- [x] 필드 라벨 폰트(`text-xs font-bold text-slate-600`) 및 여백 표준화
- [x] 셀렉트(Select), 날짜 선택 팝오버(Calendar), 멀티 셀렉트(자격증) 컴포넌트 스타일 통일
- [x] 회사명 자동완성 추천 태그 목록(Matching Companies) 칩 스타일 정리

### Phase 4: 푸터 및 인터랙션 최적화
- [x] 푸터 배경 `bg-slate-50 border-t` 적용
- [x] 진한 보라색 풀너비 버튼을 모던한 아웃라인/소프트 닫기 버튼으로 교체
- [x] 터치 인터랙션 및 모바일 뷰포트 반응성 점검

### Phase 5: 크로스 페이지 검증 및 테스트
- [x] `http://localhost:9002/admin/students` 페이지에서 모바일 뷰 작동 확인
- [x] `http://localhost:9002/students` 페이지에서 모바일 뷰 작동 확인
- [x] Next.js 개발 서버 컴파일(200 OK) 완료 및 타입 안전성 검증

### Phase 6: 실시간 타이핑 저장 제거 및 [저장하기] 버튼 수동 저장 전환
- [x] 모달 내부 상태(`formData`) 분리: 타이핑/선택 시 로컬 상태만 갱신하고 `onSave` 즉시 호출 방지
- [x] 푸터에 [취소] 및 [저장 완료] 버튼 배치 (`isSubmitting` 로딩 인디케이터 지원)
- [x] 저장 버튼 클릭 시 변경된 필드만 추출하여 순차 저장 후 모달 닫기
- [x] 저장 완료 시 성공 토스트 알림 표시

---

## 📊 4. 기대 효과 (Expected Outcomes)
1. **시각적 일관성 확보**: `AddStudentModal`, `FieldTrainingModal` 등 시스템 전반의 모달과 완벽히 일치하는 디자인 정체성 수립.
2. **모바일 사용성 대폭 개선**: 스크롤 압박 감소, 라벨 시인성 향상, 퀵 액션 접근성 강화.
3. **오작동 및 피로도 감소**: 모달 닫기 버튼과 폼 입력 간의 혼란 해소.
