'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, GraduationCap } from 'lucide-react';
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

  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const ay = key === 'ay' ? parseInt(value) : parseInt(currentAY);
    const grade = key === 'grade' ? parseInt(value) : parseInt(currentGrade);
    const gradYear = ay + (4 - grade);
    
    params.set('ay', ay.toString());
    params.set('grade', grade.toString());
    params.set('year', gradYear.toString());
    router.push(`/employment-status?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
      {/* 학사학년도 */}
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

      <div className="w-[1px] h-4 bg-slate-200" />

      {/* 학년 */}
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
    </div>
  );
}
