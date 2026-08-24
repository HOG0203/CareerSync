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
import { Check, Search, Loader2, GraduationCap, Building2, LayoutGrid, Filter } from 'lucide-react';
import { getMajorOrderIndex } from '@/lib/student-utils';

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
      const majorNames = Object.keys(gradeMajors).sort((a, b) => {
        const orderA = getMajorOrderIndex(a);
        const orderB = getMajorOrderIndex(b);
        if (orderA !== orderB) return orderA - orderB;
        return a.localeCompare(b, 'ko');
      });
      const nextMajor = majorNames[0] || '';
      setSelectedMajor(nextMajor);
      
      const nextClasses = (gradeMajors[nextMajor] || []).sort((a, b) => parseInt(a || '0') - parseInt(b || '0'));
      setSelectedClass(nextClasses[0] || '');
    }
  };

  // 학과 변경 시 해당 학과의 첫 반 자동 선택
  const handleMajorChange = (majorVal: string) => {
    setSelectedMajor(majorVal);
    if (isAdmin) {
      const gNum = parseInt(selectedGrade);
      const gradeMajors = classStructure[gNum] || {};
      const nextClasses = (gradeMajors[majorVal] || []).sort((a, b) => parseInt(a || '0') - parseInt(b || '0'));
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

  // 현재 선택된 학년 기준의 학과 목록 (공식 순서 정렬)
  const currentMajors = React.useMemo(() => {
    if (!isAdmin) return [defaultMajor];
    const gNum = parseInt(selectedGrade);
    return Object.keys(classStructure[gNum] || {}).sort((a, b) => {
      const orderA = getMajorOrderIndex(a);
      const orderB = getMajorOrderIndex(b);
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b, 'ko');
    });
  }, [selectedGrade, classStructure, isAdmin, defaultMajor]);

  // 현재 선택된 학년 및 학과 기준의 반 목록 (숫자 자연어 정렬)
  const currentClasses = React.useMemo(() => {
    if (!isAdmin) return [defaultClass];
    const gNum = parseInt(selectedGrade);
    const gradeMajors = classStructure[gNum] || {};
    return (gradeMajors[selectedMajor] || []).sort((a, b) => parseInt(a || '0') - parseInt(b || '0'));
  }, [selectedGrade, selectedMajor, classStructure, isAdmin, defaultClass]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
      <div className="flex items-center flex-wrap gap-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100/80 px-2.5 py-1.5 rounded-xl">
          <Filter className="h-3.5 w-3.5 text-blue-600" />
          <span>학반 조회:</span>
        </div>

        {/* 학년 선택 */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1">
          <GraduationCap className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          <Select value={selectedGrade} onValueChange={handleGradeChange} disabled={!isAdmin || isLoading}>
            <SelectTrigger className="w-[85px] h-7 text-xs font-bold border-none bg-transparent shadow-none focus:ring-0 px-0">
              <SelectValue placeholder="학년 선택" />
            </SelectTrigger>
            <SelectContent>
              {availableGrades.sort().map(grade => (
                <SelectItem key={grade} value={String(grade)} className="text-xs font-medium">{grade}학년</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 학과 선택 */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1">
          <Building2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          <Select value={selectedMajor} onValueChange={handleMajorChange} disabled={!isAdmin || isLoading}>
            <SelectTrigger className={cn("w-[145px] sm:w-[160px] h-7 text-xs font-bold border-none bg-transparent shadow-none focus:ring-0 px-0 truncate", !isAdmin && "opacity-80")}>
              <SelectValue placeholder="학과 선택" />
            </SelectTrigger>
            <SelectContent>
              {currentMajors.map(m => (
                <SelectItem key={m} value={m} className="text-xs font-medium">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 반 선택 */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1">
          <LayoutGrid className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          <Select value={selectedClass} onValueChange={setSelectedClass} disabled={!isAdmin || isLoading}>
            <SelectTrigger className={cn("w-[75px] h-7 text-xs font-bold border-none bg-transparent shadow-none focus:ring-0 px-0", !isAdmin && "opacity-80")}>
              <SelectValue placeholder="반 선택" />
            </SelectTrigger>
            <SelectContent>
              {currentClasses.map(c => (
                <SelectItem key={c} value={c} className="text-xs font-medium">{c}반</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isAdmin && (
          <Button
            onClick={handleSearch}
            disabled={isLoading || isPending}
            className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 shrink-0 ml-1"
          >
            {isLoading || isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                조회 중...
              </>
            ) : (
              <>
                <Search className="h-3.5 w-3.5" />
                학반 조회
              </>
            )}
          </Button>
        )}
      </div>

      <div className="hidden sm:flex items-center gap-2">
        {isAdmin ? (
          <div className="text-[11px] text-blue-600 font-semibold flex items-center gap-1.5 bg-blue-50/80 px-3 py-1.5 rounded-xl border border-blue-100">
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span>관리자 모드: 전체 학반 조회 가능</span>
          </div>
        ) : (
          <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/80 shadow-2xs">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>담당 학반 전용 조회 모드</span>
          </div>
        )}
      </div>
    </div>
  );
}

