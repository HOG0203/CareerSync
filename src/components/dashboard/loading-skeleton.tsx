'use client';

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 전 페이지 공통 시계방향 회전 로딩 컴포넌트 (Option 2 - 브랜드 통합 로더)
 */
export function GlobalRotatingLoader({ message = "데이터를 안전하게 불러오는 중입니다..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[460px] w-full py-20 animate-in fade-in duration-300">
      <div className="relative">
        {/* 바깥쪽 회전 링 */}
        <div className="absolute inset-0 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" style={{ animationDuration: '1.2s' }} />
        
        {/* 안쪽 아이콘 로더 */}
        <div className="bg-white p-5 sm:p-6 rounded-full shadow-xl border border-slate-100 relative z-10">
          <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 text-indigo-600 animate-spin" style={{ animationDuration: '1.8s' }} />
        </div>

        {/* 후광 효과 */}
        <div className="absolute -inset-4 bg-indigo-500/10 rounded-full blur-2xl animate-pulse" />
      </div>

      <div className="mt-8 space-y-2.5 text-center">
        <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">{message}</h3>
        <div className="flex items-center justify-center gap-1.5">
          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <p className="text-[11px] text-slate-400 font-extrabold tracking-widest pt-3 uppercase">
          대구공업고등학교 CareerSync
        </p>
      </div>
    </div>
  );
}

export function DashboardLoadingSkeleton() {
  return <GlobalRotatingLoader message="대시보드 통계를 분석하고 있습니다..." />;
}

export function TableLoadingSkeleton() {
  return <GlobalRotatingLoader message="명단 데이터를 정밀하게 조회 중입니다..." />;
}

export function GridLoadingSkeleton() {
  return <GlobalRotatingLoader message="현황판 데이터를 실시간 동기화 중입니다..." />;
}

export function CertificationSkeleton() {
  return <GlobalRotatingLoader message="인증제 평가 데이터를 불러오는 중입니다..." />;
}

export function CertificationDataSkeleton() {
  return <GlobalRotatingLoader message="상세 데이터를 불러오는 중입니다..." />;
}

export default GlobalRotatingLoader;