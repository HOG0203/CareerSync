'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface EmploymentStatusFiltersProps {
  graduationYears: number[];
  defaultYear: string;
}

export default function EmploymentStatusFilters({ graduationYears, defaultYear }: EmploymentStatusFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentYear = searchParams.get('year') || defaultYear;

  const updateYear = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('year', value);
    router.push(`/employment-status?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={currentYear} onValueChange={updateYear}>
        <SelectTrigger className="w-[160px] h-9 text-xs bg-white border-blue-200 text-blue-700 font-bold focus:ring-blue-500">
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
    </div>
  );
}
