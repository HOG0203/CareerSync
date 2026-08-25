'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Grid3X3,
  ClipboardList,
  Factory,
  BookUser,
  Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';

import * as React from 'react';
import { Loader2 } from 'lucide-react';

export function MobileBottomTab({ isAdmin = false, role, userGrade }: { isAdmin?: boolean; role?: string; userGrade?: number }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const [navigatingHref, setNavigatingHref] = React.useState<string | null>(null);

  React.useEffect(() => {
    setNavigatingHref(null);
  }, [pathname]);

  const isLowerGradeTeacher = role === 'teacher' && (userGrade === 1 || userGrade === 2);
  const isStudent = role === 'student';

  // 학생(student), 담임 선생님(teacher)과 관리자(admin)의 하단 탭 구성을 다르게 설정
  const tabs = isStudent
    ? [
        { href: '/student/certification', label: '내 평가표', icon: BookUser },
      ]
    : isLowerGradeTeacher
    ? [
        { href: '/dashboard', label: '홈', icon: LayoutDashboard },
        { href: '/employment-status', label: '현황', icon: Grid3X3 },
        { href: '/company-info', label: '업체정보', icon: Factory },
        { href: '/class-management', label: '학반관리', icon: BookUser },
      ]
    : role === 'teacher'
    ? [
        { href: '/dashboard', label: '홈', icon: LayoutDashboard },
        { href: '/employment-status', label: '현황', icon: Grid3X3 },
        { href: '/students', label: '취업데이터', icon: ClipboardList },
        { href: '/class-management', label: '학반관리', icon: BookUser },
      ]
    : [
        { href: '/dashboard', label: '홈', icon: LayoutDashboard },
        { href: '/employment-status', label: '현황', icon: Grid3X3 },
        { href: '/company-info', label: '업체정보', icon: Factory },
        { href: '/students', label: '취업데이터', icon: ClipboardList },
      ];


  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-16 bg-white border-t border-slate-100 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.05)] lg:hidden px-2">
      {tabs.map((tab) => {
        const isNav = navigatingHref === tab.href;
        const isActive = isNav || (navigatingHref === null && pathname === tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch={false}
            onClick={() => setNavigatingHref(tab.href)}
            className={cn(
              "flex flex-col items-center justify-center min-w-[56px] flex-1 h-full gap-1 transition-all relative shrink-0",
              isActive ? "text-indigo-600 font-bold" : "text-slate-400"
            )}
          >
            {isNav ? (
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            ) : (
              <tab.icon className={cn("h-5 w-5", isActive ? "stroke-[2.5px]" : "stroke-2")} />
            )}
            <span className="text-[9px] font-bold tracking-tighter">{tab.label}</span>
            {isActive && <div className="absolute bottom-0 w-8 h-1 bg-indigo-600 rounded-t-full animate-in fade-in zoom-in-95 duration-200" />}
          </Link>
        );
      })}

      
      {/* 전체 메뉴 버튼 (서랍 열기) */}
      <button
        onClick={() => setOpenMobile(true)}
        className="flex flex-col items-center justify-center min-w-[56px] flex-1 h-full gap-1 text-slate-400 active:text-indigo-600 transition-all shrink-0"
      >
        <Menu className="h-5 w-5 stroke-2" />
        <span className="text-[9px] font-bold tracking-tighter">메뉴</span>
      </button>
    </nav>
  );
}
