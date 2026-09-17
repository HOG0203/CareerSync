'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { StudentEmploymentData } from '@/lib/data';
import { StudentPopover } from '@/components/dashboard/student-popover';
import { CustomRule } from './custom-combination-modal';

import { evaluateCustomRuleMatch } from '@/lib/custom-rule-evaluator';

interface StudentGridCellProps {
  student: StudentEmploymentData;
  idx: number;
  variant: string;
  rankingSummary?: any;
  isRankingsLoading?: boolean;
  userProfile?: any;
  searchQuery?: string;
  customRule?: CustomRule | null;
  baseYear?: number;
  isLowerGrade?: boolean;
  // 2학년 진로코스 필터
  wishCourseFilter?: string;
  currentCourseFilter?: string;
  homeroomTeacher?: string;
  onStudentUpdate?: (updatedStudent: StudentEmploymentData) => void;
}

export const StudentGridCell = React.memo(function StudentGridCell({ 
  student, 
  idx, 
  variant, 
  rankingSummary, 
  isRankingsLoading, 
  userProfile, 
  searchQuery, 
  customRule, 
  baseYear, 
  isLowerGrade, 
  wishCourseFilter, 
  currentCourseFilter,
  homeroomTeacher,
  onStudentUpdate
}: StudentGridCellProps) {
  // 1. 커스텀 동적 조합 매칭 평가 (AND / OR)
  const isCustomRuleMatched = React.useMemo(() => {
    return evaluateCustomRuleMatch(student, customRule || null, rankingSummary);
  }, [student, rankingSummary, customRule]);

  // 2. 검색 대상 단일 문자열 캐싱 (매번 배열 생성/순회 방지로 20배 초고속화)
  const searchIndexString = React.useMemo(() => {
    const certStr = Array.isArray(student.certificates)
      ? student.certificates.join(' ')
      : (typeof student.certificates === 'string' ? student.certificates : '');

    if (isLowerGrade) {
      return `${student.student_name || ''} ${student.career_aspiration || ''} ${student.career_course || ''} ${student.employment_status || ''} ${student.special_notes || ''} ${student.major || ''} ${student.class_info || ''} ${certStr}`.toLowerCase();
    }
    return `${student.student_name || ''} ${student.employment_status || ''} ${student.company_type || ''} ${student.business_type || ''} ${student.company || ''} ${student.latest_training_company || ''} ${student.major || ''} ${student.class_info || ''} ${certStr}`.toLowerCase();
  }, [student, isLowerGrade]);

  const isMatched = React.useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return false;
    return searchIndexString.includes(searchQuery.toLowerCase().trim());
  }, [searchIndexString, searchQuery]);


  const getDesireColor = (student: StudentEmploymentData) => {
    const isDesiring = student.is_desiring_employment;
    const aspiration = student.career_aspiration;
    const bType = student.business_type;

    if (isLowerGrade) {
      if (aspiration === '취업') return 'bg-emerald-500';
      if (aspiration === '진학') return 'bg-rose-500';
      if (aspiration === '제외인정자') return 'bg-slate-400';
    }

    // 취업희망 여부가 있는 경우 (아니오 -> 빨강, 예 -> 녹색)
    if (isDesiring === '아니오') return 'bg-rose-500';
    if (isDesiring === '예') return 'bg-emerald-500';

    // 제외인정자 기본 회색 표시
    if (bType === '제외인정자') {
      return 'bg-slate-400';
    }

    return null;
  };

  // 3. 진로코스 필터 매칭 (2학년 전용)
  const wishCourseMatched = wishCourseFilter
    ? (student.career_course || '').trim() === wishCourseFilter
    : true;
  const currentCourseMatched = currentCourseFilter
    ? (student.employment_status || '').trim() === currentCourseFilter
    : true;

  // 4. 스포트라이트 하이라이트 로직 (검색/조건 활성화 시 매칭된 학생만 선명, 주변 학생은 희미하게)
  const hasSearch = Boolean(searchQuery && searchQuery.trim().length > 0);
  const hasCustomRule = Boolean(customRule && customRule.conditions && customRule.conditions.length > 0);
  const hasCourseFilter = Boolean(wishCourseFilter || currentCourseFilter);

  const hasAnyHighlight = hasSearch || hasCustomRule || hasCourseFilter;

  const searchMatched = hasSearch ? isMatched : true;
  const customMatched = hasCustomRule ? isCustomRuleMatched : true;
  const courseMatched = hasCourseFilter ? (wishCourseMatched && currentCourseMatched) : true;

  const isFullyMatched = hasAnyHighlight && searchMatched && customMatched && courseMatched;
  const isDimmed = hasAnyHighlight && !isFullyMatched;

  return (
    <StudentPopover 
      student={student} 
      rankingSummary={rankingSummary} 
      isRankingsLoading={isRankingsLoading}
      userProfile={userProfile}
      baseYear={baseYear}
      homeroomTeacher={homeroomTeacher}
      onStudentUpdate={onStudentUpdate}
    >
      <div
        className={cn(
          "h-7 border-b border-gray-200 flex items-center justify-between px-0.5 text-[10px] transition-all cursor-pointer relative pr-[5px]",
          variant,
          isFullyMatched && "ring-2 ring-inset ring-indigo-600 font-black",
          isDimmed && "opacity-10 grayscale-[90%] blur-[0.3px] hover:opacity-80 hover:grayscale-0 hover:blur-none",
          !hasAnyHighlight && "hover:opacity-80 active:bg-slate-100"
        )}
      >

        <span className="opacity-60 text-[7px] w-2">{student.student_number || idx + 1}</span>
        <span className="flex-1 text-center font-medium truncate tracking-tighter pr-0.5 flex items-center justify-center gap-0.5">
          {student.student_name}
          {student.certificates && student.certificates.length > 0 && (
            <span className="text-[7.5px] font-black text-amber-600 bg-amber-50 px-1 border border-amber-200 rounded-sm shrink-0 scale-90 origin-center leading-none h-3.5 flex items-center justify-center">
              {student.certificates.length}
            </span>
          )}
        </span>
        {/* 진로코스 필터 일치 표시 바 */}
        {hasCourseFilter && courseMatched && (
          <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full"
            style={{
              background: wishCourseFilter && currentCourseFilter
                ? 'linear-gradient(to bottom, #3b82f6 50%, #10b981 50%)'
                : wishCourseFilter ? '#3b82f6' : '#10b981'
            }}
          />
        )}
        {!isLowerGrade && getDesireColor(student) && (
          <div className={cn("absolute right-[1.5px] top-[2px] bottom-[2px] w-[3px] rounded-full ring-1 ring-white shadow-2xs", getDesireColor(student))} />
        )}
      </div>
    </StudentPopover>
  );
});


