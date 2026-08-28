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
import { Check, Search, Loader2, GraduationCap, Building2, LayoutGrid, Filter, Users } from 'lucide-react';
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
  const [isPending, startTransition] = React.useTransition();

  // 로컬 선택 상태 관리 (기본값: 관리자는 'all', 담임은 본인 학반)
  const [selectedGrade, setSelectedGrade] = React.useState(String(defaultGrade));
  const [selectedMajor, setSelectedMajor] = React.useState(defaultMajor || 'all');
  const [selectedClass, setSelectedClass] = React.useState(defaultClass || 'all');

  // URL 파라미터나 외부 props 변경 시 동기화
  React.useEffect(() => {
    setSelectedGrade(String(defaultGrade));
    setSelectedMajor(defaultMajor || (isAdmin ? 'all' : ''));
    setSelectedClass(defaultClass || (isAdmin ? 'all' : ''));
  }, [defaultGrade, defaultMajor, defaultClass, isAdmin]);

  const applyNavigation = (grade: string, major: string, cls: string) => {
    const targetBaseUrl = baseUrl || pathname || '/class-management';
    const params = new URLSearchParams();
    params.set('grade', grade);
    if (major && major !== 'all') params.set('major', major);
    else params.set('major', 'all');
    if (cls && cls !== 'all') params.set('class', cls);
    else params.set('class', 'all');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('dashboard-loading'));
    }

    startTransition(() => {
      router.push(`${targetBaseUrl}?${params.toString()}`);
    });
  };

  // 학년 변경 시
  const handleGradeChange = (gradeVal: string) => {
    setSelectedGrade(gradeVal);
    if (isAdmin) {
      setSelectedMajor('all');
      setSelectedClass('all');
      applyNavigation(gradeVal, 'all', 'all');
    }
  };

  // 학과 변경 시
  const handleMajorChange = (majorVal: string) => {
    setSelectedMajor(majorVal);
    if (isAdmin) {
      setSelectedClass('all');
      applyNavigation(selectedGrade, majorVal, 'all');
    }
  };

  // 반 변경 시
  const handleClassChange = (classVal: string) => {
    setSelectedClass(classVal);
    if (isAdmin) {
      applyNavigation(selectedGrade, selectedMajor, classVal);
    }
  };

  // 현재 선택된 학년 기준의 학과 목록 (공식 순서 정렬)
  const currentMajors = React.useMemo(() => {
    if (!isAdmin) return [defaultMajor].filter(Boolean);
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
    if (!isAdmin) return [defaultClass].filter(Boolean);
    const gNum = parseInt(selectedGrade);
    const gradeMajors = classStructure[gNum] || {};
    
    if (selectedMajor === 'all') {
      // 전체 학과일 경우 해당 학년의 모든 반 목록 집계
      const allClassSet = new Set<string>();
      Object.values(gradeMajors).forEach(clsList => {
        clsList.forEach(c => allClassSet.add(c));
      });
      return Array.from(allClassSet).sort((a, b) => parseInt(a || '0') - parseInt(b || '0'));
    }

    return (gradeMajors[selectedMajor] || []).sort((a, b) => parseInt(a || '0') - parseInt(b || '0'));
  }, [selectedGrade, selectedMajor, classStructure, isAdmin, defaultClass]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
      <div className="flex items-center flex-wrap gap-2.5">
        {/* 학년 선택 */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1">
          <GraduationCap className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          <Select value={selectedGrade} onValueChange={handleGradeChange} disabled={!isAdmin || isPending}>
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
          <Select value={selectedMajor} onValueChange={handleMajorChange} disabled={!isAdmin || isPending}>
            <SelectTrigger className={cn("w-[145px] sm:w-[160px] h-7 text-xs font-bold border-none bg-transparent shadow-none focus:ring-0 px-0 truncate", !isAdmin && "opacity-80")}>
              <SelectValue placeholder="학과 선택" />
            </SelectTrigger>
            <SelectContent>
              {isAdmin && (
                <SelectItem value="all" className="text-xs font-bold text-blue-700 bg-blue-50/50">
                  전체 학과
                </SelectItem>
              )}
              {currentMajors.map(m => (
                <SelectItem key={m} value={m} className="text-xs font-medium">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 반 선택 */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1">
          <LayoutGrid className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          <Select value={selectedClass} onValueChange={handleClassChange} disabled={!isAdmin || isPending}>
            <SelectTrigger className={cn("w-[95px] h-7 text-xs font-bold border-none bg-transparent shadow-none focus:ring-0 px-0", !isAdmin && "opacity-80")}>
              <SelectValue placeholder="반 선택" />
            </SelectTrigger>
            <SelectContent>
              {isAdmin && (
                <SelectItem value="all" className="text-xs font-bold text-blue-700 bg-blue-50/50">
                  전체 학반
                </SelectItem>
              )}
              {currentClasses.map(c => (
                <SelectItem key={c} value={c} className="text-xs font-medium">{c}반</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isPending && (
          <div className="flex items-center gap-1.5 text-xs text-blue-600 font-bold bg-blue-50 px-2.5 py-1 rounded-xl animate-pulse shrink-0">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>조회 중...</span>
          </div>
        )}
      </div>
    </div>
  );
}


