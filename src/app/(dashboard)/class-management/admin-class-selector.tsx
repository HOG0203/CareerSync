'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check, Search, Loader2 } from 'lucide-react';

interface AdminClassSelectorProps {
  availableGrades: number[];
  isAdmin?: boolean;
  classStructure: Record<number, Record<string, string[]>>;
  defaultGrade: number;
  defaultMajor: string;
  defaultClass: string;
  baseUrl?: string;
}

export default function AdminClassSelector({
  availableGrades,
  isAdmin,
  classStructure,
  defaultGrade,
  defaultMajor,
  defaultClass,
  baseUrl,
}: AdminClassSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = React.useState(false);

  // 로컬 선택 상태 관리
  const [selectedGrade, setSelectedGrade] = React.useState(String(defaultGrade));
  const [selectedMajor, setSelectedMajor] = React.useState(defaultMajor);
  const [selectedClass, setSelectedClass] = React.useState(defaultClass);

  // URL 파라미터나 외부 props 변경 시 로컬 상태 동기화 및 로딩 상태 해제
  React.useEffect(() => {
    setSelectedGrade(String(defaultGrade));
    setSelectedMajor(defaultMajor);
    setSelectedClass(defaultClass);
    setIsLoading(false);
  }, [defaultGrade, defaultMajor, defaultClass]);

  // 학년 변경 시 해당 학년의 첫 학과 및 첫 반 자동 선택
  const handleGradeChange = (gradeVal: string) => {
    setSelectedGrade(gradeVal);
    if (isAdmin) {
      const gNum = parseInt(gradeVal);
      const gradeMajors = classStructure[gNum] || {};
      const majorNames = Object.keys(gradeMajors);
      const nextMajor = majorNames[0] || '';
      setSelectedMajor(nextMajor);
      
      const nextClasses = gradeMajors[nextMajor] || [];
      setSelectedClass(nextClasses[0] || '');
    }
  };

  // 학과 변경 시 해당 학과의 첫 반 자동 선택
  const handleMajorChange = (majorVal: string) => {
    setSelectedMajor(majorVal);
    if (isAdmin) {
      const gNum = parseInt(selectedGrade);
      const gradeMajors = classStructure[gNum] || {};
      const nextClasses = gradeMajors[majorVal] || [];
      setSelectedClass(nextClasses[0] || '');
    }
  };

  const [isPending, startTransition] = React.useTransition();

  const handleSearch = () => {
    setIsLoading(true);
    const targetBaseUrl = baseUrl || pathname || '/class-management';
    const params = new URLSearchParams();
    params.set('grade', selectedGrade);
    params.set('major', selectedMajor);
    params.set('class', selectedClass);
    startTransition(() => {
      router.push(`${targetBaseUrl}?${params.toString()}`);
    });
  };


  // 현재 선택된 학년 기준의 학과 목록
  const currentMajors = React.useMemo(() => {
    if (!isAdmin) return [defaultMajor];
    const gNum = parseInt(selectedGrade);
    return Object.keys(classStructure[gNum] || {});
  }, [selectedGrade, classStructure, isAdmin, defaultMajor]);

  // 현재 선택된 학년 및 학과 기준의 반 목록
  const currentClasses = React.useMemo(() => {
    if (!isAdmin) return [defaultClass];
    const gNum = parseInt(selectedGrade);
    const gradeMajors = classStructure[gNum] || {};
    return gradeMajors[selectedMajor] || [];
  }, [selectedGrade, selectedMajor, classStructure, isAdmin, defaultClass]);

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-blue-700 whitespace-nowrap uppercase tracking-wider">학년</span>
        <Select value={selectedGrade} onValueChange={handleGradeChange} disabled={!isAdmin || isLoading}>
          <SelectTrigger className="w-[120px] h-9 text-xs bg-white border-blue-200">
            <SelectValue placeholder="학년 선택" />
          </SelectTrigger>
          <SelectContent>
            {availableGrades.sort().map(grade => (
              <SelectItem key={grade} value={String(grade)} className="text-xs">{grade}학년</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-blue-700 whitespace-nowrap uppercase tracking-wider">학과</span>
        <Select value={selectedMajor} onValueChange={handleMajorChange} disabled={!isAdmin || isLoading}>
          <SelectTrigger className={cn("w-[180px] h-9 text-xs bg-white border-blue-200", !isAdmin && "bg-slate-50 opacity-80")}>
            <SelectValue placeholder="학과 선택" />
          </SelectTrigger>
          <SelectContent>
            {currentMajors.map(m => (
              <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-blue-700 whitespace-nowrap uppercase tracking-wider">반</span>
        <Select value={selectedClass} onValueChange={setSelectedClass} disabled={!isAdmin || isLoading}>
          <SelectTrigger className={cn("w-[100px] h-9 text-xs bg-white border-blue-200", !isAdmin && "bg-slate-50 opacity-80")}>
            <SelectValue placeholder="반 선택" />
          </SelectTrigger>
          <SelectContent>
            {currentClasses.sort().map(c => (
              <SelectItem key={c} value={c} className="text-xs">{c}반</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isAdmin && (
        <Button
          onClick={handleSearch}
          disabled={isLoading || isPending}
          className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 shrink-0"
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
      )}

      
      <div className="ml-auto flex items-center gap-4">
        {isAdmin ? (
           <div className="text-[10px] text-blue-500 font-medium flex items-center gap-1">
             <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
             관리자 권한: 모든 학반 조회가 가능합니다.
           </div>
        ) : (
           <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
             <Check className="w-3 h-3" />
             담당 학반 전용 모드
           </div>
        )}
      </div>
    </div>
  );
}
