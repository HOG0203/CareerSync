'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GraduationCap, CalendarCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CertificationTabs() {
  const pathname = usePathname();

  const tabs = [
    { 
      label: '성적 현황', 
      href: '/admin/grades/summary/grades', 
      icon: GraduationCap 
    },
    { 
      label: '출결 현황', 
      href: '/admin/grades/summary/attendance', 
      icon: CalendarCheck 
    },
  ];

  return (
    <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-xl w-fit border border-slate-200">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
              isActive 
                ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200" 
                : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
            )}
          >
            <tab.icon className={cn("h-4 w-4", isActive ? "text-indigo-600" : "text-slate-400")} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
