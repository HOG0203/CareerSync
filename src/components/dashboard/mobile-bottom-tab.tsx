'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Grid3X3, 
  BookUser, 
  Factory,
  Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';

export function MobileBottomTab({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const tabs = [
    { href: '/dashboard', label: '홈', icon: LayoutDashboard },
    { href: '/employment-status', label: '현황', icon: Grid3X3 },
    { href: '/company-info', label: '업체', icon: Factory },
    { href: '/class-management', label: '학반', icon: BookUser },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-16 bg-white border-t border-slate-100 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.05)] lg:hidden px-2">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex flex-col items-center justify-center min-w-[56px] flex-1 h-full gap-1 transition-all relative shrink-0",
              isActive ? "text-indigo-600" : "text-slate-400"
            )}
          >
            <tab.icon className={cn("h-5 w-5", isActive ? "stroke-[2.5px]" : "stroke-2")} />
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
