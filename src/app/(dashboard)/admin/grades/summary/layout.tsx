import * as React from 'react';
import { LayoutDashboard } from 'lucide-react';
import CertificationTabs from './certification-tabs';

export default function CertificationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full gap-6">
      {/* 페이지 헤더 */}
      <div className="flex flex-col gap-1 px-1">
        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <LayoutDashboard className="h-7 w-7 lg:h-8 lg:w-8 text-indigo-600 shrink-0" />
          옥저인증
        </h2>
        <p className="text-muted-foreground text-xs lg:text-sm font-medium leading-relaxed">
          학생들의 성적, 출결 등 핵심 지표를 종합하여 인증하고 관리합니다.
        </p>
      </div>

      {/* 탭 내비게이션 */}
      <CertificationTabs />

      {/* 콘텐츠 영역 */}
      <div className="flex-1 min-h-0 bg-white/50 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
}
