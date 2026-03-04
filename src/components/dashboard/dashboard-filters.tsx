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
import { X, Calendar, GraduationCap, Building2, LayoutGrid, ListFilter } from 'lucide-react';
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
  hideGrade?: boolean; // 추가
  baseYear: number;
}

export default function DashboardFilters({ 
  graduationYears, 
  majors, 
  classes, 
  statuses,
  defaultYear,
  baseUrl = '/dashboard', 
  hideYear = false,
  hideGrade = false, // 기본값
  baseYear
}: DashboardFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentAY = searchParams.get('ay') || baseYear.toString();
  const currentGrade = searchParams.get('grade') || '3';
  const currentMajor = searchParams.get('major') || 'all';
  const currentClass = searchParams.get('class') || 'all';
  const currentStatus = searchParams.get('status') || 'all';

  const academicYears = React.useMemo(() => {
    const years = new Set<number>();
    graduationYears.forEach(gy => years.add(gy - 1));
    years.add(baseYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [graduationYears, baseYear]);

  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (key === 'ay' || key === 'grade') {
      const ay = key === 'ay' ? parseInt(value) : parseInt(currentAY);
      const grade = key === 'grade' ? parseInt(value) : parseInt(currentGrade);
      const gradYear = ay + (4 - grade);
      params.set('ay', ay.toString());
      params.set('grade', grade.toString());
      params.set('year', gradYear.toString());
      params.delete('class');
    } else {
      params.set(key, value);
      if (key === 'major') params.delete('class');
    }
    router.push(`${baseUrl}?${params.toString()}`);
  };

  const resetFilters = () => router.push(baseUrl);
  const hasActiveFilters = searchParams.get('ay') || searchParams.get('grade') || searchParams.get('major') || searchParams.get('class') || searchParams.get('status');

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center flex-wrap gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
        {/* 학사학년도 및 학년 */}
        {!hideYear && (
          <>
            <div className="flex items-center gap-1.5 px-2">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <Select value={currentAY} onValueChange={(v) => updateFilters('ay', v)}>
                <SelectTrigger className="w-[95px] h-8 text-[11px] font-bold border-none bg-transparent shadow-none focus:ring-0 px-0">
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
                <div className="flex items-center gap-1.5 px-2">
                  <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                  <Select value={currentGrade} onValueChange={(v) => updateFilters('grade', v)}>
                    <SelectTrigger className="w-[70px] h-8 text-[11px] font-bold border-none bg-transparent shadow-none focus:ring-0 px-0">
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
        <div className="flex items-center gap-1.5 px-2">
          <Building2 className="h-3.5 w-3.5 text-slate-400" />
          <Select value={currentMajor} onValueChange={(v) => updateFilters('major', v)}>
            <SelectTrigger className="w-[125px] h-8 text-[11px] font-bold border-none bg-transparent shadow-none focus:ring-0 px-0">
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
        <div className="flex items-center gap-1.5 px-2">
          <LayoutGrid className="h-3.5 w-3.5 text-slate-400" />
          <Select value={currentClass} onValueChange={(v) => updateFilters('class', v)}>
            <SelectTrigger className="w-[85px] h-8 text-[11px] font-bold border-none bg-transparent shadow-none focus:ring-0 px-0">
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

        <div className="w-[1px] h-4 bg-slate-200" />

        {/* 취업상태 필터 */}
        <div className="flex items-center gap-1.5 px-2">
          <ListFilter className="h-3.5 w-3.5 text-slate-400" />
          <Select value={currentStatus} onValueChange={(v) => updateFilters('status', v)}>
            <SelectTrigger className="w-[110px] h-8 text-[11px] font-bold border-none bg-transparent shadow-none focus:ring-0 px-0">
              <SelectValue placeholder="취업상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">전체 상태</SelectItem>
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
      </div>
      
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 px-2 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50">
          <X className="mr-1 h-3.5 w-3.5" /> 초기화
        </Button>
      )}
    </div>
  );
}
