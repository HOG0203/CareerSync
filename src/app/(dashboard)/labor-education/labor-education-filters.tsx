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
import { Calendar, Filter, Search, Loader2 } from 'lucide-react';
import * as React from 'react';

interface LaborEducationFiltersProps {
  graduationYears: number[];
  defaultYear: string;
  baseYear: number;
}

export default function LaborEducationFilters({ graduationYears, defaultYear, baseYear }: LaborEducationFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentAY = searchParams.get('ay') || baseYear.toString();
  const [selectedAY, setSelectedAY] = React.useState(currentAY);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  // URL 변경 시 로컬 선택 상태 동기화 및 로딩 해제
  React.useEffect(() => {
    setSelectedAY(currentAY);
    setIsLoading(false);
  }, [currentAY]);

  // 학사학년도 목록 도출
  const academicYears = React.useMemo(() => {
    const years = new Set<number>();
    graduationYears.forEach(gy => years.add(gy - 1));
    years.add(baseYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [graduationYears, baseYear]);

  // 조회 버튼 클릭 시에만 라우팅 이동 실행
  const handleSearch = () => {
    setIsLoading(true);
    const params = new URLSearchParams(searchParams.toString());
    const ay = parseInt(selectedAY);
    const grade = 3; // 학년 고정
    const gradYear = ay + (4 - grade);
    
    params.set('ay', ay.toString());
    params.set('grade', grade.toString());
    params.set('year', gradYear.toString());

    startTransition(() => {
      router.push(`/labor-education?${params.toString()}`);
    });
  };

  return (
    <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs">
      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100/80 px-2.5 py-1 rounded-xl">
        <Filter className="h-3.5 w-3.5 text-emerald-600" />
        <span>학년도:</span>
      </div>

      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-0.5">
        <Calendar className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
        <Select value={selectedAY} onValueChange={setSelectedAY} disabled={isLoading || isPending}>
          <SelectTrigger className="w-[95px] h-7 text-xs font-bold border-none bg-transparent shadow-none focus:ring-0 px-0">
            <SelectValue placeholder="학년도 선택" />
          </SelectTrigger>
          <SelectContent position="popper">
            {academicYears.map((year) => (
              <SelectItem key={year} value={String(year)} className="text-xs font-medium">{year}학년도</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        onClick={handleSearch}
        disabled={isLoading || isPending}
        className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 shrink-0"
      >
        {isLoading || isPending ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            조회 중...
          </>
        ) : (
          <>
            <Search className="h-3.5 w-3.5" />
            조회
          </>
        )}
      </Button>
    </div>
  );
}


