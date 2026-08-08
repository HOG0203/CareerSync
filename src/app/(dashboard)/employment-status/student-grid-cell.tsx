'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { StudentEmploymentData } from '@/lib/data';
import { StudentPopover } from '@/components/dashboard/student-popover';
import { CustomRule } from './custom-combination-modal';

interface StudentGridCellProps {
  student: StudentEmploymentData;
  idx: number;
  variant: string;
  rankingSummary?: any; // 부모로부터 전달받은 사전 계산된 성적/출결 요약
  isRankingsLoading?: boolean; // 성적/석차 로딩 상태
  userProfile?: any; // 권한 확인을 위한 사용자 프로필
  searchQuery?: string; // 검색어 추가
  certFilter?: string; // 자격증 필터 추가
  customRule?: CustomRule | null; // 커스텀 조합 필터 추가
  baseYear?: number;
  isLowerGrade?: boolean;
}

export function StudentGridCell({ student, idx, variant, rankingSummary, isRankingsLoading, userProfile, searchQuery, certFilter = 'all', customRule, baseYear, isLowerGrade }: StudentGridCellProps) {
  // 1. 커스텀 동적 조합 매칭 평가 (AND / OR)
  const isCustomRuleMatched = React.useMemo(() => {
    if (!customRule || !customRule.conditions || customRule.conditions.length === 0) return false;

    const certList = Array.isArray(student.certificates)
      ? student.certificates
      : (typeof student.certificates === 'string' ? [student.certificates] : []);
    const certCount = certList.length;

    const matches = customRule.conditions.map(cond => {
      if (cond.category === 'cert_name') {
        const query = (cond.value || '').toLowerCase().trim();
        if (!query) return true;
        return certList.some((c: string) => c.toLowerCase().includes(query));
      }
      if (cond.category === 'cert_count') {
        if (cond.value === '1+') return certCount >= 1;
        if (cond.value === '2+') return certCount >= 2;
        if (cond.value === '3+') return certCount >= 3;
        if (cond.value === '0') return certCount === 0;
        return true;
      }
      if (cond.category === 'attendance') {
        const absent = rankingSummary?.unexcused_absent_count || 0;
        const late = rankingSummary?.unexcused_late_count || 0;
        const score = rankingSummary?.attendance_score ?? 100;

        if (cond.value === 'perfect') return absent === 0 && late === 0 && score === 100;
        if (cond.value === 'absent_le_1') return absent <= 1;
        if (cond.value === 'score_ge_90') return score >= 90;
        return true;
      }
      if (cond.category === 'status') {
        const status = student.employment_status || '';
        const bType = student.business_type || '';
        if (cond.value === '미취업') return status === '미취업' || status === '미설정' || !status;
        if (cond.value === '취업') return status === '취업' || bType === '취업' || bType === '도제OJT';
        if (cond.value === '현장실습중') return bType === '현장실습중' || bType === '채용진행중';
        if (cond.value === '진학') return status === '진학';
        return true;
      }
      if (cond.category === 'rank') {
        const pct = rankingSummary?.rank_percentile;
        if (pct === undefined || pct === null) return false;
        if (cond.value === 'top30') return pct <= 30;
        if (cond.value === 'top50') return pct <= 50;
        return true;
      }
      return true;
    });

    if (customRule.operator === 'OR') {
      return matches.some(m => m === true);
    }
    return matches.every(m => m === true);
  }, [student, rankingSummary, customRule]);

  // 2. 검색어 및 기본 필터 매칭
  const isMatched = React.useMemo(() => {
    if (!searchQuery && certFilter === 'all') return false;
    
    const certsCount = student.certificates?.length || 0;
    let certMatch = true;
    if (certFilter === '1+') certMatch = certsCount >= 1;
    else if (certFilter === '2+') certMatch = certsCount >= 2;
    else if (certFilter === '3+') certMatch = certsCount >= 3;
    else if (certFilter === '0') certMatch = certsCount === 0;

    let searchMatch = true;
    if (searchQuery && searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      const certList = Array.isArray(student.certificates)
        ? student.certificates
        : (typeof student.certificates === 'string' ? [student.certificates] : []);

      const fieldsToSearch = isLowerGrade
        ? [
            student.student_name,
            student.career_aspiration,
            student.career_course,
            student.special_notes,
            student.major,
            student.class_info,
            ...certList
          ]
        : [
            student.student_name,
            student.employment_status,
            student.company_type,
            student.business_type,
            student.company,
            student.latest_training_company,
            student.major,
            student.class_info,
            ...certList
          ];
      searchMatch = fieldsToSearch.some(field => field?.toLowerCase().includes(query));
    }

    return certMatch && searchMatch;

  }, [student, searchQuery, certFilter, isLowerGrade]);

  const getDesireColor = (student: StudentEmploymentData) => {
    const isDesiring = student.is_desiring_employment;
    const aspiration = student.career_aspiration;

    if (isLowerGrade) {
      if (aspiration === '취업') return 'bg-emerald-500';
      if (aspiration === '진학') return 'bg-rose-500';
      if (aspiration === '제외인정자') return 'bg-slate-400';
    }

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
          isMatched && "search-highlight",
          isCustomRuleMatched && "ring-2 ring-blue-600 bg-blue-100/90 shadow-md text-blue-950 font-bold z-10 scale-[1.02] border-blue-400"
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
