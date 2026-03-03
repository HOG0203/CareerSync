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
import { X } from 'lucide-react';

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
  baseUrl?: string; // 추가
  hideYear?: boolean; // 추가
}

export default function DashboardFilters({ 
  graduationYears, 
  majors, 
  classes, 
  statuses,
  defaultYear,
  baseUrl = '/dashboard', // 기본값
  hideYear = false
}: DashboardFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 필터 상태 결정
  const currentYear = searchParams.get('year') || defaultYear;
  const currentMajor = searchParams.get('major') || 'all';
  const currentClass = searchParams.get('class') || 'all';
  const currentStatus = searchParams.get('status') || 'all';

  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    if (key === 'year' || key === 'major') {
      params.delete('class');
    }
    router.push(`${baseUrl}?${params.toString()}`);
  };

  const resetFilters = () => {
    router.push(baseUrl);
  };

  const hasActiveFilters = searchParams.get('year') || searchParams.get('major') || searchParams.get('class') || searchParams.get('status');

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 연도 필터 */}
      {!hideYear && (
        <Select value={currentYear} onValueChange={(v) => updateFilters('year', v)}>
          <SelectTrigger className="w-[150px] h-9 text-xs">
            <SelectValue placeholder="학년도 선택" />
          </SelectTrigger>
          <SelectContent>
            {graduationYears.sort((a, b) => b - a).map((year) => (
              <SelectItem key={year} value={String(year)} className="text-xs">
                {parseInt(String(year)) - 1}학년도
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      
      {/* 학과 필터 */}
      <Select value={currentMajor} onValueChange={(v) => updateFilters('major', v)}>
        <SelectTrigger className="w-[150px] h-9 text-xs">
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

      {/* 학반 필터 */}
      <Select value={currentClass} onValueChange={(v) => updateFilters('class', v)}>
        <SelectTrigger className="w-[110px] h-9 text-xs">
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

      {/* 취업상태 필터 */}
      <Select value={currentStatus} onValueChange={(v) => updateFilters('status', v)}>
        <SelectTrigger className="w-[140px] h-9 text-xs">
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
      
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 px-2 text-xs text-muted-foreground text-rose-600 hover:text-rose-700 hover:bg-rose-50">
          <X className="mr-1 h-3 w-3" /> 필터 초기화
        </Button>
      )}
    </div>
  );
}
