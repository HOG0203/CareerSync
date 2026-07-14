'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { LayoutDashboard } from 'lucide-react';

export default function CertificationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // 현재 경로에 맞는 소제목 결정
  const getSubTitle = () => {
    if (pathname.includes('/attendance')) return '출결현황';
    if (pathname.includes('/certificates')) return '자격증 현황';
    return '성적현황'; // 기본값 (grades 등)
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* 페이지 헤더 */}
      <div className="flex flex-col gap-1 px-1">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <LayoutDashboard className="h-7 w-7 lg:h-8 lg:w-8 text-indigo-600 shrink-0" />
            옥저인재인증제
          </h2>
          <div className="h-5 w-[1.5px] bg-slate-300 self-center hidden sm:block" />
          <span className="text-lg lg:text-xl font-bold text-indigo-600 hidden sm:inline">
            {getSubTitle()}
          </span>
        </div>
        <p className="text-muted-foreground text-xs lg:text-sm font-medium leading-relaxed">
          학생들의 성적, 출결 등 핵심 지표를 종합하여 인증하고 관리합니다.
        </p>
      </div>

      {/* 콘텐츠 영역 */}
      <div className="flex-1 min-h-0 bg-white/50 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
}
