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
  userProfile?: any; // 권한 확인을 위한 사용자 프로필
  searchQuery?: string; // 검색어 추가
}

export function StudentGridCell({ student, idx, variant, rankingSummary, userProfile, searchQuery }: StudentGridCellProps) {
  // 통합 검색 매칭 여부 확인
  const isMatched = React.useMemo(() => {
    if (!searchQuery || searchQuery.trim() === '') return false;
    
    const query = searchQuery.toLowerCase().trim();
    const fieldsToSearch = [
      student.student_name,
      student.employment_status,
      student.company_type,
      student.business_type,
      student.company,
      student.latest_training_company,
      student.major,
      student.class_info
    ];

    return fieldsToSearch.some(field => 
      field?.toLowerCase().includes(query)
    );
  }, [student, searchQuery]);

  const getDesireColor = (student: StudentEmploymentData) => {
    const isDesiring = student.is_desiring_employment;
    const aspiration = student.career_aspiration;

    // 1. 취업희망여부(is_desiring_employment) 우선 체크 (사용자 요청 사항)
    if (isDesiring === '예') return 'bg-emerald-500';
    if (isDesiring === '아니오') return 'bg-rose-500';

    // 2. 진로희망 필드(career_aspiration) 보조 체크
    if (aspiration === '취업') return 'bg-emerald-500';
    if (aspiration === '진학') return 'bg-rose-500'; // 진학은 취업희망 '아니오'와 동일하게 빨간색 표시
    if (aspiration === '제외인정자') return 'bg-slate-400';

    return 'bg-transparent';
  };

  return (
    <StudentPopover 
      student={student} 
      rankingSummary={rankingSummary} 
      userProfile={userProfile}
    >
      <div
        className={cn(
          "h-7 border-b border-gray-200 flex items-center justify-between px-0.5 text-[10px] transition-colors hover:opacity-80 cursor-pointer active:bg-slate-100 relative pr-[5px]",
          variant,
          isMatched && "search-highlight"
        )}
      >
        <span className="opacity-60 text-[7px] w-2">{student.student_number || idx + 1}</span>
        <span className="flex-1 text-center font-medium truncate tracking-tighter pr-0.5">{student.student_name}</span>
        <div className={cn("absolute right-[1px] top-[2px] bottom-[2px] w-[2.5px] rounded-full", getDesireColor(student))} />
      </div>
    </StudentPopover>
  );
}
