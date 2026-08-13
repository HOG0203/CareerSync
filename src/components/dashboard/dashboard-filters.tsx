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

  const [selectedAY, setSelectedAY] = React.useState(currentAY);
  const [selectedGrade, setSelectedGrade] = React.useState(currentGrade);
  const [selectedMajor, setSelectedMajor] = React.useState(currentMajor);
  const [selectedClass, setSelectedClass] = React.useState(currentClass);
  const [selectedStatus, setSelectedStatus] = React.useState(currentStatus);

  React.useEffect(() => {
    setSelectedAY(currentAY);
    setSelectedGrade(currentGrade);
    setSelectedMajor(currentMajor);
    setSelectedClass(currentClass);
    setSelectedStatus(currentStatus);
  }, [currentAY, currentGrade, currentMajor, currentClass, currentStatus]);

  const handleAYChange = (val: string) => {
    setSelectedAY(val);
    setSelectedMajor('all');
    setSelectedClass('all');
    setSelectedStatus('all');
  };

  const handleGradeChange = (val: string) => {
    setSelectedGrade(val);
    setSelectedMajor('all');
    setSelectedClass('all');
    setSelectedStatus('all');
  };

  const handleMajorChange = (val: string) => {
    setSelectedMajor(val);
    setSelectedClass('all');
    setSelectedStatus('all');
  };

  const [isPending, startTransition] = React.useTransition();

  const handleSearch = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('dashboard-loading'));
    }
    const params = new URLSearchParams();
    const ay = parseInt(selectedAY);
    const grade = parseInt(selectedGrade);
    const gradYear = ay + (4 - grade);
    
    params.set('ay', selectedAY);
    params.set('grade', selectedGrade);
    params.set('year', gradYear.toString());
    params.set('major', selectedMajor);
    params.set('class', selectedClass);
    params.set('status', selectedStatus);
    
    startTransition(() => {
      router.push(`${baseUrl}?${params.toString()}`);
    });
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

  const resetFilters = () => router.push(baseUrl);
  const hasActiveFilters = searchParams.get('ay') || searchParams.get('grade') || searchParams.get('major') || searchParams.get('class') || searchParams.get('status');

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="flex items-center flex-wrap gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
        {/* 학사학년도 및 학년 */}
        {!hideYear && (
          <>
            <div className="flex items-center gap-1 px-1">
              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <Select value={selectedAY} onValueChange={handleAYChange}>
                <SelectTrigger className="w-[95px] h-8 text-[11px] font-bold border-none bg-transparent shadow-none focus:ring-0 px-0 overflow-hidden">
                  <SelectValue placeholder="학년도" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((year) => (
                    <SelectItem key={year} value={String(year)} className="text-[11px] font-medium">{year}학년도</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!hideGrade && (
              <>
                <div className="w-[1px] h-4 bg-slate-200" />
                <div className="flex items-center gap-1 px-1">
                  <GraduationCap className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <Select value={selectedGrade} onValueChange={handleGradeChange}>
                    <SelectTrigger className="w-[70px] h-8 text-[11px] font-bold border-none bg-transparent shadow-none focus:ring-0 px-0 overflow-hidden">
                      <SelectValue placeholder="학년" />
                    </SelectTrigger>
                    <SelectContent>
                      {[3, 2, 1].map((g) => (
                        <SelectItem key={g} value={String(g)} className="text-[11px] font-medium">{g}학년</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="w-[1px] h-4 bg-slate-200" />
          </>
        )}
        
        {/* 학과 필터 */}
        <div className="flex items-center gap-1 px-1">
          <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <Select value={selectedMajor} onValueChange={handleMajorChange}>
            <SelectTrigger className="w-[130px] h-8 text-[11px] font-bold border-none bg-transparent shadow-none focus:ring-0 px-0 overflow-hidden">
              <SelectValue placeholder="전체 학과" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">전체 학과</SelectItem>
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

        <div className="w-[1px] h-4 bg-slate-200" />

        {/* 학반 필터 */}
        <div className="flex items-center gap-1 px-1">
          <LayoutGrid className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-[90px] h-8 text-[11px] font-bold border-none bg-transparent shadow-none focus:ring-0 px-0 overflow-hidden">
              <SelectValue placeholder="전체 반" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">전체 반</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.value} value={c.value} className="text-xs">
                  <div className="flex justify-between w-full items-center gap-2">
                    <span>{c.label}</span>
                    <span className="text-[10px] text-muted-foreground opacity-70">({c.count})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!hideStatus && (
          <>
            <div className="w-[1px] h-4 bg-slate-200" />
            {/* 취업여부 필터 */}
            <div className="flex items-center gap-1 px-1">
              <ListFilter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[115px] h-8 text-[11px] font-bold border-none bg-transparent shadow-none focus:ring-0 px-0 overflow-hidden">
                  <SelectValue placeholder="취업여부" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">전체 여부</SelectItem>
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
          </>
        )}
      </div>

      {/* 조회 및 초기화 버튼 */}
      <Button 
        onClick={handleSearch}
        disabled={isPending}
        className="h-8.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-all active:scale-95 shrink-0"
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
        조회
      </Button>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8.5 px-2 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg shrink-0">
          <X className="mr-0.5 h-3.5 w-3.5" /> 초기화
        </Button>
      )}
    </div>
  );
}
