'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Grid3X3, 
  BookUser, 
  UserPlus, 
  Settings,
  Users,
  UserCog,
  ShieldCheck,
  ShieldAlert,
  ClipboardList,
  GraduationCap
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function MobileBottomTab({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();

  const tabs = [
    { href: '/dashboard', label: '홈', icon: LayoutDashboard },
    { href: '/employment-status', label: '현황', icon: Grid3X3 },
    { href: '/labor-education', label: '인권', icon: ShieldAlert },
    { href: '/students', label: '취업', icon: ClipboardList }, // 학생 취업 및 현장실습 현황 (공통)
    { href: '/class-management', label: '학반', icon: BookUser },
    ...(isAdmin ? [
      { href: '/admin/students', label: '학생', icon: UserPlus },
      { href: '/admin/grades/summary', label: '인증', icon: LayoutDashboard },
      { href: '/admin/users', label: '사용자', icon: UserCog },
      { href: '/admin/settings', label: '설정', icon: Settings }
    ] : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-16 bg-white border-t border-slate-100 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.05)] lg:hidden overflow-x-auto custom-scrollbar-none px-2">
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
    </nav>
  );
}
