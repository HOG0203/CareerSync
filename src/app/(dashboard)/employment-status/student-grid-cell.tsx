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
      // 1. 자격증 대분류
      if (cond.mainCategory === 'cert' || (cond as any).category === 'cert_name' || (cond as any).category === 'cert_count') {
        const isName = cond.subType === 'name' || (cond as any).category === 'cert_name';
        if (isName) {
          const query = (cond.value || '').toLowerCase().trim();
          if (!query) return true;
          return certList.some((c: string) => c.toLowerCase().includes(query));
        } else {
          if (cond.value === '1+') return certCount >= 1;
          if (cond.value === '2+') return certCount >= 2;
          if (cond.value === '3+') return certCount >= 3;
          if (cond.value === '0') return certCount === 0;
          return true;
        }
      }

      // 2. 출결 대분류
      const attn = rankingSummary?.attendance;
      const unexcusedTotal = (attn?.unexcused?.absent || 0) + (attn?.unexcused?.late || 0) + (attn?.unexcused?.early || 0) + (attn?.unexcused?.out || 0) + (rankingSummary?.unexcused_absent_count || 0) + (rankingSummary?.unexcused_late_count || 0);
      const diseaseTotal = (attn?.disease?.absent || 0) + (attn?.disease?.late || 0) + (attn?.disease?.early || 0) + (attn?.disease?.out || 0);
      const otherTotal = (attn?.other?.absent || 0) + (attn?.other?.late || 0) + (attn?.other?.early || 0) + (attn?.other?.out || 0);

      if (cond.mainCategory === 'attendance' || (cond as any).category?.startsWith('attendance')) {
        const sub = cond.subType || (cond as any).category?.replace('attendance_', '');
        if (sub === 'perfect' || sub === 'attendance_perfect') {
          return unexcusedTotal === 0 && diseaseTotal === 0 && otherTotal === 0;
        }
        if (sub === 'unexcused' || sub === 'attendance_unexcused') {
          if (cond.value === '0') return unexcusedTotal === 0;
          if (cond.value === 'le_1') return unexcusedTotal <= 1;
          if (cond.value === 'le_2') return unexcusedTotal <= 2;
          if (cond.value === 'le_3') return unexcusedTotal <= 3;
          return true;
        }
        if (sub === 'disease' || sub === 'attendance_disease') {
          if (cond.value === '0') return diseaseTotal === 0;
          if (cond.value === 'le_1') return diseaseTotal <= 1;
          if (cond.value === 'le_2') return diseaseTotal <= 2;
          if (cond.value === 'le_3') return diseaseTotal <= 3;
          if (cond.value === 'le_5') return diseaseTotal <= 5;
          return true;
        }
      }

      // 3. 취업/진로 대분류
      if (cond.mainCategory === 'status' || (cond as any).category === 'status') {
        const status = student.employment_status || '';
        const bType = student.business_type || '';
        const aspiration = student.career_aspiration || '';
        const val = cond.value;

        if (val === '미취업') {
          // 진학자/진학희망자는 미취업이 아님
          if (bType === '진학' || status === '진학' || aspiration === '진학') return false;
          // 제외인정자 제외
          if (bType === '제외인정자' || status === '제외인정자' || aspiration === '제외인정자') return false;
          // 이미 취업, 현장실습, 도제, 채용진행 중인 학생 제외
          if (['취업', '현장실습중', '도제OJT', '채용진행중'].includes(bType) || status === '취업') return false;
          
          return bType === '미취업' || bType === '아니오' || status === '미취업' || status === '미설정' || (!bType && !status);
        }
        if (val === '취업') return bType === '취업' || status === '취업';
        if (val === '현장실습/도제OJT' || val === '현장실습중' || val === '도제OJT') {
          const isTrainingType = ['현장실습중', '현장실습', '도제OJT', '도제'].some(k => bType.includes(k));
          const hasRecord = student.has_field_training === 'O' || (student.training_records && student.training_records.length > 0);
          const isDojeCourse = (student.career_course || '').includes('도제');
          return isTrainingType || hasRecord || isDojeCourse;
        }
        if (val === '채용진행중') return bType === '채용진행중';
        if (val === '진학') return status === '진학' || bType === '진학' || aspiration === '진학';
        if (val === '제외인정자') return bType === '제외인정자' || status === '제외인정자' || aspiration === '제외인정자';
        return true;
      }

      // 4. 성적/석차 대분류
      if (cond.mainCategory === 'rank' || (cond as any).category === 'rank') {
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
          (isMatched || isCustomRuleMatched) && "search-highlight"
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
