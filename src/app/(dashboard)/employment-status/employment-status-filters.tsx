'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from 'lucide-react';
import * as React from 'react';

interface EmploymentStatusFiltersProps {
  graduationYears: number[];
  defaultYear: string;
  baseYear: number;
}

export default function EmploymentStatusFilters({ graduationYears, defaultYear, baseYear }: EmploymentStatusFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentAY = searchParams.get('ay') || baseYear.toString();
  const currentGrade = searchParams.get('grade') || '3';

  // 학사학년도 목록 도출
  const academicYears = React.useMemo(() => {
    const years = new Set<number>();
    graduationYears.forEach(gy => years.add(gy - 1));
    years.add(baseYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [graduationYears, baseYear]);

  const updateFilters = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const ay = parseInt(value);
    const grade = 3; // 학년 필터 삭제로 인한 기본값 3 고정
    const gradYear = ay + (4 - grade);
    
    params.set('ay', ay.toString());
    params.set('grade', grade.toString());
    params.set('year', gradYear.toString());
    router.push(`/employment-status?${params.toString()}`);
  };

  return (
    <div className="flex items-center bg-slate-50 p-1 rounded-lg border border-slate-200 w-[130px] min-w-[130px] justify-between">
      {/* 학사학년도 */}
      <div className="flex items-center gap-1.5 px-2 w-full">
        <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <Select value={currentAY} onValueChange={(v) => updateFilters(v)}>
          <SelectTrigger className="w-full h-8 text-[11px] font-bold border-none bg-transparent shadow-none focus:ring-0 px-0">
            <SelectValue placeholder="학년도" />
          </SelectTrigger>
          <SelectContent position="popper" className="w-[130px]">
            {academicYears.map((year) => (
              <SelectItem key={year} value={String(year)} className="text-[11px] font-medium">{year}학년도</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
