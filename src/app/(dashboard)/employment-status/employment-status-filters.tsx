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
import { Calendar, GraduationCap, Search } from 'lucide-react';
import * as React from 'react';

interface EmploymentStatusFiltersProps {
  graduationYears: number[];
  defaultYear: string;
  baseYear: number;
  initialAY: string;
  initialGrade: string;
}

export default function EmploymentStatusFilters({ graduationYears, defaultYear, baseYear, initialAY, initialGrade }: EmploymentStatusFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentAY = searchParams.get('ay') || initialAY;
  const currentGrade = searchParams.get('grade') || initialGrade;

  // 로컬 상태로 선택값 관리
  const [selectedAY, setSelectedAY] = React.useState(currentAY);
  const [selectedGrade, setSelectedGrade] = React.useState(currentGrade);

  // URL 변경 시 로컬 상태 동기화
  React.useEffect(() => {
    setSelectedAY(currentAY);
    setSelectedGrade(currentGrade);
  }, [currentAY, currentGrade]);

  // 학사학년도 목록 도출
  const academicYears = React.useMemo(() => {
    const years = new Set<number>();
    graduationYears.forEach(gy => years.add(gy - 1));
    years.add(baseYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [graduationYears, baseYear]);

  const handleSearch = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('employment-status-loading'));
    }
    const params = new URLSearchParams(searchParams.toString());
    const ay = parseInt(selectedAY);
    const grade = parseInt(selectedGrade);
    const gradYear = ay + (4 - grade);
    
    params.set('ay', selectedAY);
    params.set('grade', selectedGrade);
    params.set('year', gradYear.toString());
    router.push(`/employment-status?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200 shadow-sm">
      {/* 학사학년도 */}
      <div className="flex items-center gap-1.5 px-2 bg-white rounded border border-slate-200 h-8 w-[110px]">
        <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <Select value={selectedAY} onValueChange={setSelectedAY}>
          <SelectTrigger className="w-full h-full text-[11px] font-bold border-none bg-transparent shadow-none focus:ring-0 px-0">
            <SelectValue placeholder="학년도" />
          </SelectTrigger>
          <SelectContent position="popper" className="w-[110px]">
            {academicYears.map((year) => (
              <SelectItem key={year} value={String(year)} className="text-[11px] font-medium">{year}학년도</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 학년 */}
      <div className="flex items-center gap-1.5 px-2 bg-white rounded border border-slate-200 h-8 w-[95px]">
        <GraduationCap className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <Select value={selectedGrade} onValueChange={setSelectedGrade}>
          <SelectTrigger className="w-full h-full text-[11px] font-bold border-none bg-transparent shadow-none focus:ring-0 px-0">
            <SelectValue placeholder="학년" />
          </SelectTrigger>
          <SelectContent position="popper" className="w-[95px]">
            {[3, 2, 1].map((g) => (
              <SelectItem key={g} value={String(g)} className="text-[11px] font-medium">{g}학년</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 조회 버튼 */}
      <Button 
        onClick={handleSearch}
        className="h-8 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all"
      >
        <Search className="h-3.5 w-3.5" />
        조회
      </Button>
    </div>
  );
}
