# CareerSync 개발 및 유지보수 가이드 (Preventions)

본 문서는 시스템 고도화 이후 안정적인 운영과 지속적인 개발을 위해 반드시 준수해야 할 기술적 주의사항을 기록합니다.

## 1. 배포 및 인프라 (Vercel)
- **미들웨어 금지**: `src/middleware.ts`를 생성하거나 Supabase 라이브러리를 미들웨어에 포함하지 마십시오. Vercel 배포 엔진과의 충돌(Internal Error)이 발생합니다.
- **서버 사이드 보안**: 인증 및 권한 체크(RBAC)는 `src/app/(dashboard)/layout.tsx`에서 서버 컴포넌트 방식으로 처리합니다.
- **배포 최적화**: `.vercelignore`를 통해 `docs/` 및 정적 이미지 파일이 배포 패키지에 포함되지 않도록 유지하십시오.

## 2. 테이블 엔진 성능 (Performance)
- **가상화 구조**: `StandardSpreadsheetTable`은 가상화 렌더링을 사용합니다. `ROW_HEIGHT(32px)`와 `HEADER_HEIGHT` 상수를 기준으로 스크롤 위치를 계산하므로 레이아웃 변경 시 이를 동기화해야 합니다.
- **Hook 순서 보장**: `SpreadsheetCell` 내부의 모든 React Hook은 반드시 컴포넌트 최상단에 위치해야 하며, `isEditing` 등의 조건문 뒤로 밀려나서는 안 됩니다.
- **Zero-Rerender Selection**: 선택 영역 이동 시 셀 리렌더링을 방지하기 위해 CSS 클래스 기반의 선택 방식을 유지하십시오.

## 3. 학사 데이터 관리 (Business Logic)
- **학년도 기준**: 시스템의 모든 학년도 계산은 DB의 `system_settings` 테이블(또는 `baseYear`)을 기준으로 합니다.
- **공식**: `학년(Grade) = 4 - (졸업연도 - 기준년도)`. 이 공식은 진급 및 배정 로직의 핵심입니다.
- **자격증 처리**: 자격증 데이터는 반드시 `normalizeCertificates`를 거쳐 처리하여 `자격증명(급수)` 형식을 유지하십시오.

## 4. 모바일 UI (Mobile UX)
- **하단 탭 바**: 메뉴 추가 시 `MobileBottomTab`의 공간(최대 7개)을 고려하십시오.
- **터치 타겟**: 모바일 버튼은 최소 `h-10`(40px) 이상을 유지하고 `active:scale` 피드백을 포함하십시오.
