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
}

export const StudentGridCell = React.memo(function StudentGridCell({ student, idx, variant, rankingSummary, isRankingsLoading, userProfile, searchQuery, customRule, baseYear, isLowerGrade, wishCourseFilter, currentCourseFilter }: StudentGridCellProps) {
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
          const limit = parseInt(String(cond.value).replace('le_', '')) || 0;
          return unexcusedTotal <= limit;
        }
        if (sub === 'disease' || sub === 'attendance_disease') {
          const limit = parseInt(String(cond.value).replace('le_', '')) || 0;
          return diseaseTotal <= limit;
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

    if (isLowerGrade) {
      if (aspiration === '취업') return 'bg-emerald-500';
      if (aspiration === '진학') return 'bg-rose-500';
      if (aspiration === '제외인정자') return 'bg-slate-400';
    }

    if (isDesiring === '예') return 'bg-emerald-500';
    if (isDesiring === '아니오') return 'bg-rose-500';

    return 'bg-transparent';
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
    >
      <div
        className={cn(
          "h-7 border-b border-gray-200 flex items-center justify-between px-0.5 text-[10px] transition-opacity cursor-pointer relative pr-[5px]",
          variant,
          isDimmed && "opacity-15 grayscale-[60%] blur-[0.2px] hover:opacity-80 hover:grayscale-0 hover:blur-none",
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
        {!isLowerGrade && (
          <div className={cn("absolute right-[1px] top-[2px] bottom-[2px] w-[2.5px] rounded-full", getDesireColor(student))} />
        )}
      </div>
    </StudentPopover>
  );
});


