# [Plan] 모바일 다중 현장실습 이력 관리 지원 (Mobile Multi-Field Training Support)

- **상태**: 진행 중 (Draft)
- **대상 페이지**: `http://localhost:9002/students` (학생 관리)
- **작성일**: 2026-03-06
- **작성자**: bkit (Gemini CLI)

---

## 🎯 1. 개요 (Overview)
현재 데스크톱 환경에서는 `FieldTrainingModal`을 통해 학생당 여러 차수의 현장실습 이력을 관리할 수 있습니다. 하지만 모바일 화면의 상세 보기(`MobileDetailModal`)에는 이 기능을 호출하는 접점이 누락되어 있어, 모바일에서도 동일한 시스템을 사용할 수 있도록 UI/UX를 확장합니다.

## 🛠️ 2. 주요 기능 및 요구사항 (Requirements)

### 2.1 상세 모달 인터페이스 확장
- `StandardSpreadsheetTable`의 `MobileDetailModal` 내부에 '현장실습 이력 관리' 전용 버튼 추가.
- 버튼 클릭 시 현재 선택된 학생의 UUID를 기반으로 기존 `FieldTrainingModal`을 호출.

### 2.2 실습 모달(`FieldTrainingModal`) 연동
- `src/app/(dashboard)/students/page.tsx`에서 관리하는 모달 상태와 `StandardSpreadsheetTable`의 `onAction` 핸들러 연결.
- 모바일에서 모달이 열릴 때 화면을 가득 채우는 반응형 레이아웃 확인.

### 2.3 데이터 동기화
- 실습 이력 수정 후 대시보드 및 학생 테이블에 즉시 반영되도록 `revalidatePath` 및 클라이언트 상태 동기화 확인.

## 📅 3. 실행 계획 (Action Items)

### Phase 1: UI 접점 추가
- `src/components/dashboard/standard-spreadsheet-table.tsx` 수정.
- `MobileDetailModal`에 `field_training_action` 버튼 배치.

### Phase 2: 비즈니스 로직 연결
- `src/app/(dashboard)/students/student-table.tsx` 또는 `page.tsx`에서 `onAction` 핸들러 보강.
- `detailData`의 학생 ID를 `FieldTrainingModal`의 `studentId`로 전달.

### Phase 3: 검증 및 테스트
- 모바일 크롬 개발자 도구(Device Mode)에서 모달 호출 테스트.
- 다중 차수 추가/삭제 시 데이터 정합성 확인.

---

## 📊 4. 기대 효과
- 현장 교사들이 모바일 기기(태블릿, 스마트폰)를 사용하여 실습 현장에서도 즉시 다중 실습 이력을 기록하고 조회할 수 있음.
- 데스크톱과 모바일 간의 기능 파편화 해소.
