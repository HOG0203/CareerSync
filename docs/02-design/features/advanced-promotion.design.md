# PDCA Design: 진급 시스템 고도화

## 1. 인터페이스 설계 (UI/UX)

### 1.1 `PromotionModal` 컴포넌트
- **목록 인터페이스**: 
  - 선택된 학생 리스트를 작은 테이블 형태로 출력.
  - 열 구성: [ 성명 | 현재 반/번호 | 진급 후 반(Input) | 진급 후 번호(Input) ]
- **일괄 설정 바**:
  - `Select`박스로 학과 변경(필요 시).
  - `Input`으로 "모든 학생을 [ ] 반으로 지정" 버튼.
- **졸업연도 자동 계산**: 현재 `graduation_year - 1` 값을 기본값으로 세팅.

## 2. 데이터 처리 설계 (Server Actions)

### 2.1 `promoteStudents(updates: PromotionDetail[])`
```typescript
interface PromotionDetail {
  id: string;
  next_major: string;
  next_class: string;
  next_number: string;
  next_graduation_year: number;
}
```
- **로직**:
  1. 각 `id`에 해당하는 레코드를 `update`.
  2. `student_id` 필드를 `${next_major}_${next_class}_${next_number}_${student_name}_${next_graduation_year}` 형식으로 재계산.
  3. 전체 성공 시 `revalidatePath` 호출.

## 3. 컴포넌트 구조 변경

### 3.1 `StandardSpreadsheetTable`
- `onPromote`의 시그니처를 `(ids: string[]) => void`에서 데이터 수집을 위한 트리거로 변경하거나, 외부에서 모달을 제어하도록 수정.
- 여기서는 `onPromote` 호출 시 `id` 목록을 부모(`ClassTable`)에게 넘기고, 부모가 `PromotionModal`을 띄우는 방식 채택.

## 4. 예외 및 보안 설계
- **중복 검사**: 진급 후의 [학과+반+번호+연도] 조합이 기존 데이터와 충돌하는지 사전 체크 로직 포함.
- **권한**: 관리자(`admin`) 및 해당 반 담임교사에게만 진급 처리 버튼 노출.
