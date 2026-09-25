# [Plan] 관리자 이력 페이지 실시간성 개선 및 수동 새로고침 기능 추가

- **상태**: 완료 (Completed)
- **대상 파일**:
  - `src/lib/audit-logger.ts`
  - `src/app/(dashboard)/admin/login-history/login-history-client.tsx`
  - `src/app/(dashboard)/admin/audit-logs/audit-logs-client.tsx`
- **대상 페이지**:
  - `http://localhost:9002/admin/login-history` (로그인 및 활동 이력)
  - `http://localhost:9002/admin/audit-logs` (시스템 작업 이력)
- **작성일**: 2026-09-26
- **완료일**: 2026-09-26
- **작성자**: CareerSync 개발팀

---

## 🎯 1. 개요 및 배경 (Overview & Background)

### 1.1 배경
관리자 로그인/활동 이력 및 시스템 감사 로그 페이지에서 새로 발생한 로그인이나 작업 내역이 즉시 반영되지 않고 최대 24시간 지연되거나 불규칙하게 업데이트되는 현상이 존재했습니다.
원인은 `src/lib/audit-logger.ts`의 `getCachedAuditLogs` 함수가 `unstable_cache`로 24시간(`revalidate: 86400`) 동안 서버 메모리에 캐시되어 있었기 때문입니다.

### 1.2 요구사항
1. **관리자 이력 페이지 캐시 수명 단축 또는 캐시 제거**:
   - 실시간성이 필수적인 감사/로그인 이력 데이터의 24시간 캐시를 제거하고, 매 조회 시 항상 최신 DB 데이터를 조회(`revalidate: 0` 또는 직접 DB 쿼리)하도록 개선.
2. **클라이언트 수동 새로고침(Refresh) 버튼 제공**:
   - 로그인 이력(`login-history-client.tsx`) 및 시스템 작업 이력(`audit-logs-client.tsx`) 상단 툴바에 수동 "새로고침" 버튼을 배치하여 사용자가 원할 때 즉시 최신 로그를 갱신할 수 있도록 지원.

---

## 🛠️ 2. 개선 세부 계획 (Action Items)

### Phase 1: `src/lib/audit-logger.ts` 실시간 DB 조회로 개편
- [x] `getCachedAuditLogs` 함수를 `unstable_cache` 없이 직접 DB 쿼리로 최신 로그를 조회하도록 변경
- [x] 최신순 정렬 및 최대 제한(`maxLimit = 3000`) 유지로 성능과 안정성 확보
- [x] 페이지 진입 및 새로고침 시 항상 최신 DB 상태가 반영되도록 보장

### Phase 2: `login-history-client.tsx` 수동 새로고침 버튼 추가
- [x] 상단 필터 툴바 우측(전체 펼치기/접기 옆)에 [새로고침] 버튼 배치
- [x] `useRouter`의 `router.refresh()`와 로딩 스피너 애니메이션 연동

### Phase 3: `audit-logs-client.tsx` 수동 새로고침 버튼 추가
- [x] 상단 카드 헤더 우측에 [새로고침] 버튼 배치
- [x] `useRouter`의 `router.refresh()`와 로딩 스피너 애니메이션 연동

### Phase 4: 검증 및 테스트
- [x] Next.js 개발 서버 컴파일 및 런타임 정상 동작 확인
- [x] `/admin/login-history` 및 `/admin/audit-logs` 접속 및 새로고침 인터랙션 확인
