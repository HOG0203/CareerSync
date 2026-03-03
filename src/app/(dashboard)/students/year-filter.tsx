'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StudentYearFilterProps {
  graduationYears: number[];
  defaultYear: string;
}

export default function StudentYearFilter({ graduationYears, defaultYear }: StudentYearFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentYear = searchParams.get('year') || defaultYear;

  const updateYear = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('year', value);
    router.push(`/students?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={currentYear} onValueChange={updateYear}>
        <SelectTrigger className="w-[140px] h-8 text-xs bg-white border-blue-200 text-blue-700 font-bold focus:ring-blue-500">
          <SelectValue placeholder="졸업연도" />
        </SelectTrigger>
        <SelectContent>
          {graduationYears.sort((a, b) => b - a).map((year) => (
            <SelectItem key={year} value={String(year)} className="text-xs">
              {year}년 졸업생
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
