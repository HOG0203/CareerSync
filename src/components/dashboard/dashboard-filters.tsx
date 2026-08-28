'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X, Calendar, GraduationCap, Building2, LayoutGrid, ListFilter, Search, Loader2 } from 'lucide-react';

import * as React from 'react';

interface FilterOption {
  label: string;
  value: string;
  count: number;
}

interface DashboardFiltersProps {
  graduationYears: number[];
  majors: FilterOption[];
  classes: FilterOption[];
  statuses: FilterOption[];
  defaultYear: string;
  baseUrl?: string; 
  hideYear?: boolean;
  hideGrade?: boolean;
  hideStatus?: boolean;
  hideMajor?: boolean;
  hideClass?: boolean;
  baseYear: number;
  defaultGrade?: number;
}

export default function DashboardFilters({ 
  graduationYears, 
  majors, 
  classes, 
  statuses,
  defaultYear,
  baseUrl = '/dashboard', 
  hideYear = false,
  hideGrade = false,
  hideStatus = false,
  hideMajor = false,
  hideClass = false,
  baseYear,
  defaultGrade = 3,
}: DashboardFiltersProps) {
  const [mounted, setMounted] = React.useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const currentAY = searchParams.get('ay') || baseYear.toString();
  const currentGrade = searchParams.get('grade') || String(defaultGrade);
  const currentMajor = searchParams.get('major') || 'all';
  const currentClass = searchParams.get('class') || 'all';
  const currentStatus = searchParams.get('status') || 'all';


  const [isPending, startTransition] = React.useTransition();

  const applyFilterChange = (
    nextAY = currentAY,
    nextGrade = currentGrade,
    nextMajor = currentMajor,
    nextClass = currentClass,
    nextStatus = currentStatus
  ) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('dashboard-loading'));
    }
    const params = new URLSearchParams();
    const ayNum = parseInt(nextAY);
    const gradeNum = parseInt(nextGrade);
    const gradYear = ayNum + (4 - gradeNum);
    
    params.set('ay', nextAY);
    params.set('grade', nextGrade);
    params.set('year', gradYear.toString());
    params.set('major', nextMajor);
    params.set('class', nextClass);
    params.set('status', nextStatus);
    
    startTransition(() => {
      router.push(`${baseUrl}?${params.toString()}`);
    });
  };

  const handleAYChange = (val: string) => {
    applyFilterChange(val, currentGrade, 'all', 'all', 'all');
  };

  const handleGradeChange = (val: string) => {
    applyFilterChange(currentAY, val, 'all', 'all', 'all');
  };

  const handleMajorChange = (val: string) => {
    applyFilterChange(currentAY, currentGrade, val, 'all', 'all');
  };

  const handleClassChange = (val: string) => {
    applyFilterChange(currentAY, currentGrade, currentMajor, val, currentStatus);
  };

  const handleStatusChange = (val: string) => {
    applyFilterChange(currentAY, currentGrade, currentMajor, currentClass, val);
  };

  const academicYears = React.useMemo(() => {
    const years = new Set<number>();
    graduationYears.forEach(gy => years.add(gy - 1));
    years.add(baseYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [graduationYears, baseYear]);

  if (!mounted) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200 h-10 w-[350px] animate-pulse" />
      </div>
    );
  }

  const resetFilters = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('dashboard-loading'));
    }
    startTransition(() => {
      router.push(baseUrl);
    });
  };

  const hasActiveFilters = (searchParams.get('major') && searchParams.get('major') !== 'all') || 
                           (searchParams.get('class') && searchParams.get('class') !== 'all') || 
                           (searchParams.get('status') && searchParams.get('status') !== 'all');

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center flex-wrap gap-1.5 bg-slate-100/70 p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs">
        {/* 학사학년도 및 학년 */}
        {!hideYear && (
          <>
            <div className="flex items-center gap-1.5 px-2 bg-white rounded-xl border border-slate-200/70 h-8 shadow-3xs">
              <Calendar className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
              <Select value={currentAY} onValueChange={handleAYChange}>
                <SelectTrigger className="w-[88px] h-7 text-[11px] font-bold border-none bg-transparent shadow-none focus:ring-0 px-0">
                  <SelectValue placeholder="학년도" />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-lg border-slate-200">
                  {academicYears.map((year) => (
                    <SelectItem key={year} value={String(year)} className="text-xs font-bold">{year}학년도</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!hideGrade && (
              <div className="flex items-center gap-1.5 px-2 bg-white rounded-xl border border-slate-200/70 h-8 shadow-3xs">
                <GraduationCap className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <Select value={currentGrade} onValueChange={handleGradeChange}>
                  <SelectTrigger className="w-[72px] h-7 text-[11px] font-bold border-none bg-transparent shadow-none focus:ring-0 px-0">
                    <SelectValue placeholder="학년" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-lg border-slate-200">
                    {[3, 2, 1].map((g) => (
                      <SelectItem key={g} value={String(g)} className="text-xs font-bold">{g}학년</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        )}
        
        {/* 학과 필터 */}
        {!hideMajor && (
          <div className="flex items-center gap-1.5 px-2 bg-white rounded-xl border border-slate-200/70 h-8 shadow-3xs">
            <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <Select value={currentMajor} onValueChange={handleMajorChange}>
              <SelectTrigger className="w-[120px] h-7 text-[11px] font-bold border-none bg-transparent shadow-none focus:ring-0 px-0">
                <SelectValue placeholder="전체 학과" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-lg border-slate-200">
                <SelectItem value="all" className="text-xs font-bold">전체 학과</SelectItem>
                {majors.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-xs">
                    <div className="flex justify-between w-full items-center gap-2">
                      <span>{m.label}</span>
                      <span className="text-[10px] text-muted-foreground opacity-70">({m.count})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* 학반 필터 */}
        {!hideClass && (
          <div className="flex items-center gap-1.5 px-2 bg-white rounded-xl border border-slate-200/70 h-8 shadow-3xs">
            <LayoutGrid className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <Select value={currentClass} onValueChange={handleClassChange}>
              <SelectTrigger className="w-[85px] h-7 text-[11px] font-bold border-none bg-transparent shadow-none focus:ring-0 px-0">
                <SelectValue placeholder="전체 반" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-lg border-slate-200">
                <SelectItem value="all" className="text-xs font-bold">전체 반</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.value} value={c.value} className="text-xs">
                    <div className="flex justify-between w-full items-center gap-2">
                      <span>{c.label === '미지정' ? '미지정' : `${c.label}반`}</span>
                      <span className="text-[10px] text-muted-foreground opacity-70">({c.count})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!hideStatus && (
          <div className="flex items-center gap-1.5 px-2 bg-white rounded-xl border border-slate-200/70 h-8 shadow-3xs">
            <ListFilter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <Select value={currentStatus} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[110px] h-7 text-[11px] font-bold border-none bg-transparent shadow-none focus:ring-0 px-0">
                <SelectValue placeholder="취업여부" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-lg border-slate-200">
                <SelectItem value="all" className="text-xs font-bold">전체 여부</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s.value} value={s.value} className="text-xs">
                    <div className="flex justify-between w-full items-center gap-2">
                      <span>{s.label}</span>
                      <span className="text-[10px] text-muted-foreground opacity-70">({s.count})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {isPending && (
        <div className="flex items-center gap-1 text-xs text-indigo-600 font-bold px-2 py-1 bg-indigo-50 rounded-xl border border-indigo-100 animate-pulse">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>로딩중...</span>
        </div>
      )}

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8.5 px-2.5 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl shrink-0">
          <X className="mr-1 h-3.5 w-3.5" /> 초기화
        </Button>
      )}
    </div>
  );
}
