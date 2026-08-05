'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { StudentEmploymentData } from '@/lib/data';
import { StudentPopover } from '@/components/dashboard/student-popover';

interface StudentGridCellProps {
  student: StudentEmploymentData;
  idx: number;
  variant: string;
  rankingSummary?: any; // 부모로부터 전달받은 사전 계산된 성적/출결 요약
  isRankingsLoading?: boolean; // 성적/석차 로딩 상태
  userProfile?: any; // 권한 확인을 위한 사용자 프로필
  searchQuery?: string; // 검색어 추가
  certFilter?: string; // 자격증 필터 추가
  baseYear?: number;
  isLowerGrade?: boolean;
}

export function StudentGridCell({ student, idx, variant, rankingSummary, isRankingsLoading, userProfile, searchQuery, certFilter = 'all', baseYear, isLowerGrade }: StudentGridCellProps) {
  // 통합 검색 및 자격증 필터 매칭 여부 확인
  const isMatched = React.useMemo(() => {
    if (!searchQuery && certFilter === 'all') return false;
    
    // 1. 자격증 개수 필터 조건 확인
    const certsCount = student.certificates?.length || 0;
    let certMatch = true;
    if (certFilter === '1+') certMatch = certsCount >= 1;
    else if (certFilter === '2+') certMatch = certsCount >= 2;
    else if (certFilter === '3+') certMatch = certsCount >= 3;
    else if (certFilter === '0') certMatch = certsCount === 0;

    // 2. 검색어 필터 조건 확인
    let searchMatch = true;
    if (searchQuery && searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      const fieldsToSearch = isLowerGrade
        ? [
            student.student_name,
            student.career_aspiration,
            student.career_course,
            student.special_notes,
            student.major,
            student.class_info
          ]
        : [
            student.student_name,
            student.employment_status,
            student.company_type,
            student.business_type,
            student.company,
            student.latest_training_company,
            student.major,
            student.class_info
          ];
      searchMatch = fieldsToSearch.some(field => field?.toLowerCase().includes(query));
    }

    return certMatch && searchMatch;
  }, [student, searchQuery, certFilter, isLowerGrade]);

  const getDesireColor = (student: StudentEmploymentData) => {
    const isDesiring = student.is_desiring_employment;
    const aspiration = student.career_aspiration;

    // 1,2학년은 진로희망(career_aspiration) 우선 적용
    if (isLowerGrade) {
      if (aspiration === '취업') return 'bg-emerald-500';
      if (aspiration === '진학') return 'bg-rose-500';
      if (aspiration === '제외인정자') return 'bg-slate-400';
      // 진로희망이 없으면 기존 로직 폴백
    }

    // 3학년: 취업희망여부(is_desiring_employment)만 체크하여 띠 표시 (진로희망으로 폴백하지 않음)
    if (isDesiring === '예') return 'bg-emerald-500';
    if (isDesiring === '아니오') return 'bg-rose-500';

    return 'bg-transparent';
  };

  return (
    <StudentPopover 
      student={student} 
      rankingSummary={rankingSummary} 
      isRankingsLoading={isRankingsLoading}
      userProfile={userProfile}
      baseYear={baseYear}
    >
      <div
        className={cn(
          "h-7 border-b border-gray-200 flex items-center justify-between px-0.5 text-[10px] transition-colors hover:opacity-80 cursor-pointer active:bg-slate-100 relative pr-[5px]",
          variant,
          isMatched && "search-highlight"
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
        {!isLowerGrade && (
          <div className={cn("absolute right-[1px] top-[2px] bottom-[2px] w-[2.5px] rounded-full", getDesireColor(student))} />
        )}
      </div>
    </StudentPopover>
  );
}
