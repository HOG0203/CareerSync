# PDCA Design: CareerSync Mobile Support (PWA & Responsive)

## 1. UI/UX Layout Design

### 1.1 Navigation Strategy
- **Desktop:** 기존 사이드바(`src/components/dashboard/nav.tsx`) 유지.
- **Mobile (Max-width: 768px):** 
    - **Bottom Tab Bar:** 홈(대시보드), 현황(그리드), 관리(학반), 설정(프로필) 4개 핵심 메뉴 배치.
    - **Top Bar:** 로고, 알림 아이콘, 현재 페이지 제목 표시.
    - **Hamburger Menu:** 드물게 사용하는 기능(로그아웃, 사용자 관리 등)은 상단 우측 햄버거 메뉴로 수용.

### 1.2 Data Table Adaptation (Adaptive Grid)
- **Problem:** `StandardSpreadsheetTable`은 모바일 가로 해상도에서 사용이 불가능함.
- **Solution:**
    - `use-mobile.tsx` 훅을 사용하여 `isMobile`일 경우 테이블 대신 **Card List View** 렌더링.
    - 각 카드는 학생의 성명, 학과, 취업처, 상태를 요약하여 보여줌.
    - 상세 수정은 카드를 탭했을 때 나타나는 **Bottom Sheet (Drawer)** 내에서 수행.

### 1.3 Chart Responsiveness
- Recharts의 `ResponsiveContainer`를 100% 폭으로 설정하고, 모바일에서는 차트의 범례(Legend)를 하단으로 이동하거나 숨김 처리하여 가독성 확보.

## 2. PWA (Progressive Web App) Design

### 2.1 Web Manifest (`public/manifest.json`)
```json
{
  "name": "CareerSync - 취업 관리 시스템",
  "short_name": "CareerSync",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#4f46e5",
  "icons": [
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 2.2 Offline Strategy
- `next-pwa`를 사용하여 런타임 캐싱 설정.
- 데이터 변경(Server Action)은 온라인 상태에서만 가능하도록 처리하고, 오프라인 시 "네트워크 연결 확인" 안내 표시.

## 3. 기술 스택 및 라이브러리
- **Framework:** Next.js 15 (App Router)
- **Library:** `next-pwa` (PWA 지원)
- **UI Components:** `shadcn/ui` (Drawer, Tabs, Card)
- **Icons:** `lucide-react` (Mobile-optimized icons)

## 4. 인터랙션 설계
- **Pull-to-refresh:** 대시보드 및 리스트 페이지에서 데이터 새로고침 지원.
- **Haptic Feedback:** 버튼 클릭 및 성공적인 데이터 저장 시 미세한 진동 피드백 (Web Vibration API).
- **Safe Area:** iOS 노치 디자인을 고려한 `env(safe-area-inset-bottom)` 여백 확보.
