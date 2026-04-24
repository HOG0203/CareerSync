import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * 전 페이지 공통 시계방향 회전 로딩 컴포넌트
 */
function GlobalRotatingLoader({ message = "데이터를 안전하게 불러오는 중입니다..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full py-20 animate-in fade-in duration-500">
      <div className="relative">
        {/* 바깥쪽 회전 링 */}
        <div className="absolute inset-0 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin" style={{ animationDuration: '1.5s' }} />
        
        {/* 안쪽 아이콘 로더 */}
        <div className="bg-white p-6 rounded-full shadow-xl border border-slate-50 relative z-10">
          <Loader2 className="h-12 w-12 text-indigo-600 animate-spin" style={{ animationDuration: '2s' }} />
        </div>

        {/* 후광 효과 */}
        <div className="absolute -inset-4 bg-indigo-500/5 rounded-full blur-2xl animate-pulse" />
      </div>

      <div className="mt-10 space-y-2 text-center">
        <h3 className="text-lg font-black text-slate-800 tracking-tight">{message}</h3>
        <div className="flex items-center justify-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <p className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em] pt-4">CareerSync Intelligence</p>
      </div>
    </div>
  )
}

/**
 * 기존 스켈레톤 함수들을 모두 회전 로더로 통합
 * (기존 loading.tsx 파일들의 수정을 최소화하기 위해 이름 유지)
 */
export function DashboardLoadingSkeleton() {
  return <GlobalRotatingLoader message="대시보드 통계를 분석하고 있습니다..." />
}

export function TableLoadingSkeleton() {
  return <GlobalRotatingLoader message="명단 데이터를 정밀하게 조회 중입니다..." />
}

export function GridLoadingSkeleton() {
  return <GlobalRotatingLoader message="현황판 데이터를 실시간 동기화 중입니다..." />
}
