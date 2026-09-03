'use client';

import * as React from 'react';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';
import { StudentEmploymentData } from '@/lib/data';
import { 
  Trophy, 
  BarChart3, 
  Award, 
  Briefcase, 
  CalendarClock, 
  ExternalLink,
  Loader2,
  User,
  ClipboardList,
  MessageSquare,
  Phone,
  ChevronDown,
  AlertTriangle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getStudentScoresById, getStudentRankSummary, updateStudentField } from '@/app/students/actions';
import { Button } from '@/components/ui/button';
import { CounselingModal } from '@/app/(dashboard)/class-management/counseling-modal';

import { useIsMobile } from '@/hooks/use-mobile';

interface StudentPopoverProps {
  student: StudentEmploymentData;
  children: React.ReactNode;
  rankingSummary?: any;
  isRankingsLoading?: boolean;
  userProfile?: any;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  baseYear?: number;
  isLowerGrade?: boolean;
  homeroomTeacher?: string;
}

export function StudentPopover({ 
  student, 
  children, 
  rankingSummary, 
  isRankingsLoading,
  userProfile,
  side,
  align,
  baseYear,
  isLowerGrade: propIsLowerGrade,
  homeroomTeacher
}: StudentPopoverProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const isMobile = useIsMobile();
  const resolvedSide = side || (isMobile ? 'bottom' : 'right');
  const resolvedAlign = align || (isMobile ? 'center' : 'start');

  const [isGradeModalOpen, setIsGradeModalOpen] = React.useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = React.useState(false);
  const [isCounselingModalOpen, setIsCounselingModalOpen] = React.useState(false);
  const [detailedScores, setDetailedScores] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const [internalRankSummary, setInternalRankSummary] = React.useState<any>(null);
  const [isInternalRankLoading, setIsInternalRankLoading] = React.useState(false);

  const effectiveRankSummary = (rankingSummary !== undefined && rankingSummary !== null) ? rankingSummary : internalRankSummary;
  const effectiveRankLoading = isRankingsLoading || (isInternalRankLoading && !effectiveRankSummary);

  const resolvedBaseYear = baseYear || 2026;
  const studentGrade = student.graduation_year ? (4 - (student.graduation_year - resolvedBaseYear)) : 3;
  const isLowerGrade = propIsLowerGrade !== undefined ? propIsLowerGrade : (studentGrade === 1 || studentGrade === 2);

  const [currentEmploymentStatus, setCurrentEmploymentStatus] = React.useState(student.employment_status || '');
  const [isStatusSaving, setIsStatusSaving] = React.useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = React.useState(false);

  React.useEffect(() => {
    setCurrentEmploymentStatus(student.employment_status || '');
  }, [student.employment_status]);

  // 팝오버가 열렸을 때 rankingSummary가 없으면 단건 석차 요약을 비동기로 자동 조회
  React.useEffect(() => {
    if ((open || isGradeModalOpen || isAttendanceModalOpen) && (!rankingSummary || !rankingSummary.subjectCount) && student.id && student.graduation_year) {
      setIsInternalRankLoading(true);
      getStudentRankSummary(student.id, student.graduation_year)
        .then(res => {
          if (res) setInternalRankSummary(res);
          setIsInternalRankLoading(false);
        })
        .catch(() => {
          setIsInternalRankLoading(false);
        });
    }
  }, [open, isGradeModalOpen, isAttendanceModalOpen, rankingSummary, student.id, student.graduation_year]);

  // 팝오버가 닫힐 때 커스텀 드롭다운도 함께 닫기
  React.useEffect(() => {
    if (!open) setIsStatusDropdownOpen(false);
  }, [open]);

  const handleStatusChange = async (val: string) => {
    setCurrentEmploymentStatus(val);
    setIsStatusSaving(true);
    try {
      await updateStudentField(student.id, 'employment_status', val);
      student.employment_status = val;
      router.refresh();
    } catch (err) {
      console.error('Failed to update employment_status:', err);
    } finally {
      setIsStatusSaving(false);
    }
  };

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

  const hasCounselingAccess = React.useMemo(() => {
    if (!userProfile) return false;
    if (userProfile.role === 'admin') return true;
    
    const userMajor = (userProfile.assigned_major || '').replace(/과|공업계/g, '').trim();
    const userClass = (userProfile.assigned_class || '').replace(/반|학년/g, '').trim();
    const userYear = userProfile.assigned_year;
    
    const studentMajor = (student.major || '').replace(/과|공업계/g, '').trim();
    const studentClass = (student.class_info || '').replace(/반|학년/g, '').trim();
    const studentYear = student.graduation_year;

    if (!userMajor || !userClass) return false;

    return userProfile.role === 'teacher' && 
           userMajor === studentMajor && 
           userClass === studentClass &&
           userYear === studentYear;
  }, [userProfile, student]);

  React.useEffect(() => {
    if (isGradeModalOpen && student.id) {
      setIsLoading(true);
      getStudentScoresById(student.id).then(scores => {
        setDetailedScores(scores);
        setIsLoading(false);
      });
    }
  }, [isGradeModalOpen, student.id]);

  const groupedDetails = React.useMemo(() => {
    if (detailedScores.length === 0) return null;
    const groups: Record<string, any[]> = {};
    detailedScores.forEach(r => {
      const semesterKey = `${r.grade}학년 ${r.semester}학기`;
      if (!groups[semesterKey]) groups[semesterKey] = [];
      groups[semesterKey].push(r);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [detailedScores]);

  const attendanceByGrade = React.useMemo(() => {
    if (!effectiveRankSummary?.attnRecords) return null;
    return (effectiveRankSummary.attnRecords as any[]).sort((a, b) => a.grade - b.grade);
  }, [effectiveRankSummary]);

  const totalAttendance = React.useMemo(() => {
    if (!attendanceByGrade || attendanceByGrade.length === 0) return null;
    const tot = {
      unexcused: { absent: 0, late: 0, early: 0, out: 0, total: 0 },
      disease: { absent: 0, late: 0, early: 0, out: 0, total: 0 },
      other: { absent: 0, late: 0, early: 0, out: 0, total: 0 },
    };
    attendanceByGrade.forEach((r: any) => {
      tot.unexcused.absent += (r.absent_unexcused || 0);
      tot.unexcused.late += (r.late_unexcused || 0);
      tot.unexcused.early += (r.early_unexcused || 0);
      tot.unexcused.out += (r.out_unexcused || 0);

      tot.disease.absent += (r.absent_disease || 0);
      tot.disease.late += (r.late_disease || 0);
      tot.disease.early += (r.early_disease || 0);
      tot.disease.out += (r.out_disease || 0);

      tot.other.absent += (r.absent_other || 0);
      tot.other.late += (r.late_other || 0);
      tot.other.early += (r.early_other || 0);
      tot.other.out += (r.out_other || 0);
    });
    tot.unexcused.total = tot.unexcused.absent + tot.unexcused.late + tot.unexcused.early + tot.unexcused.out;
    tot.disease.total = tot.disease.absent + tot.disease.late + tot.disease.early + tot.disease.out;
    tot.other.total = tot.other.absent + tot.other.late + tot.other.early + tot.other.out;
    return tot;
  }, [attendanceByGrade]);

  const popoverBody = (
    <div className="space-y-4">
      <div className="flex items-start justify-between border-b-2 pb-2 mb-1 gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-[15px] text-blue-900">{student.student_name}</span>
            {(homeroomTeacher || student.teacher_name) && (
              <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 font-bold shrink-0">
                {homeroomTeacher || student.teacher_name}T
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium flex-wrap">
            {(student.major || student.class_info || student.student_number) && (
              <span>{[student.major, student.class_info ? `${student.class_info}반` : '', student.student_number ? `${student.student_number}번` : ''].filter(Boolean).join(' • ')}</span>
            )}
            {student.phone_number && (
              <a 
                href={`tel:${student.phone_number}`}
                onClick={(e) => e.stopPropagation()}
                className="text-blue-600 hover:underline flex items-center gap-0.5 font-bold"
              >
                <Phone className="h-3 w-3 text-blue-500" />
                {student.phone_number}
              </a>
            )}
          </div>
        </div>
        <span className={cn(
          "text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 mt-0.5",
          isLowerGrade ? (
            student.career_aspiration === '취업' ? "bg-emerald-100 text-emerald-700" : 
            student.career_aspiration === '진학' ? "bg-rose-100 text-rose-700" : 
            student.career_aspiration === '제외인정자' ? "bg-slate-100 text-slate-600" : "bg-slate-100 text-slate-600"
          ) : (
            student.is_desiring_employment === '예' ? "bg-emerald-100 text-emerald-700" : 
            student.is_desiring_employment === '아니오' ? "bg-rose-100 text-rose-700" : 
            "bg-slate-100 text-slate-600"
          )
        )}>
          희망: {isLowerGrade ? (student.career_aspiration || '미정') : (student.is_desiring_employment || '미정')}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-blue-800 font-black uppercase tracking-tight flex items-center gap-1">
            <BarChart3 className="h-3 w-3" /> {isLowerGrade ? '진로희망' : '취업 상세'}
          </p>
          {!isLowerGrade && (
            <span className={cn(
              "text-[9px] px-2 py-0.5 rounded-full font-black",
              student.business_type === '취업' ? "bg-emerald-100 text-emerald-700" : 
              student.business_type === '미취업' ? "bg-rose-100 text-rose-700" :
              student.business_type === '채용진행중' ? "bg-amber-100 text-amber-700" :
              student.business_type === '현장실습중' ? "bg-blue-100 text-blue-700" :
              student.business_type === '도제OJT' ? "bg-emerald-50 text-emerald-600" :
              (student.business_type === '제외인정자' || student.career_aspiration === '제외인정자') ? "bg-slate-100 text-slate-700" :
              "bg-slate-50 text-slate-400"
            )}>
              현황: {student.business_type || (student.career_aspiration === '진학' ? '진학희망' : '미결정')}
            </span>
          )}
        </div>
        <div className="space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
          {isLowerGrade ? (
            <>
              <div className="text-[10px]">
                <p className="flex justify-between">
                  <span className="text-slate-400">희망기업유형</span> 
                  <span className="font-black text-blue-600 text-right">{student.special_notes || '미설정'}</span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-200 mt-1">
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">희망진로코스</p>
                  <p className="font-black text-blue-600 text-xs sm:text-sm leading-tight truncate">
                    {student.career_course || '미설정'}
                  </p>
                </div>
                <div className="relative">
                  <p className="text-[9px] text-emerald-600 font-bold uppercase mb-0.5 flex items-center justify-between">
                    <span>현재진로코스</span>
                    {isStatusSaving && <Loader2 className="h-2.5 w-2.5 animate-spin text-emerald-600" />}
                  </p>
                  {userProfile?.role === 'admin' ? (
                    <div className="relative mt-0.5">
                      <select
                        disabled={isStatusSaving}
                        value={currentEmploymentStatus || ''}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-md py-1 pl-2 pr-6 hover:border-slate-300 transition-colors cursor-pointer appearance-none outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                      >
                        <option value="">(미선택)</option>
                        {['청솔반', '취업맞춤반', '중견기업반', '반도체아카데미반', '혁신인재반', '부사관반', '일학습병행', '계약학과', '도제반', '아우스빌둥', '일반취업', '기술사관', '군특성화', '운동부', '진학', '입대', '기타'].map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="h-3 w-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  ) : (
                    /* 일반 교사: 읽기 전용 */
                    <p className="font-black text-slate-800 text-xs sm:text-sm leading-tight truncate">
                      {currentEmploymentStatus || '미설정'}
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-3 text-[10px] items-center">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 shrink-0">진로코스</span> 
                  {userProfile?.role === 'admin' ? (
                    <div className="relative inline-block w-[100px] text-right">
                      <select
                        disabled={isStatusSaving}
                        value={currentEmploymentStatus || ''}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-[10px] font-bold text-slate-800 bg-white border border-slate-200 rounded py-0.5 pl-1.5 pr-4 hover:border-slate-300 transition-colors cursor-pointer appearance-none outline-none text-left shadow-2xs"
                      >
                        <option value="">(미선택)</option>
                        {['청솔반', '취업맞춤반', '중견기업반', '반도체아카데미반', '혁신인재반', '부사관반', '일학습병행', '계약학과', '도제반', '아우스빌둥', '일반취업', '기술사관', '군특성화', '운동부', '진학', '입대', '기타'].map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="h-2.5 w-2.5 text-slate-400 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  ) : (
                    <span className="font-bold text-slate-700 text-right">{currentEmploymentStatus || student.employment_status || '미정'}</span>
                  )}
                </div>

                <p className="flex justify-between items-center">
                  <span className="text-slate-400 pl-2">기업구분</span> 
                  <span className="font-black text-blue-600 text-right">{student.company_type || '미분류'}</span>
                </p>
              </div>
              <div className="pt-1 border-t border-slate-200 mt-1">
                <p className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">취업처</p>
                <p className="font-black text-blue-600 text-[17px] leading-tight truncate">
                  {student.company || '미정'}
                </p>
              </div>
            </>
          )}

        </div>
      </div>

      {(student.has_field_training === 'O' || (student.training_records && student.training_records.length > 0)) && (
        <div className="pt-1 space-y-2">
          <p className="text-[11px] text-emerald-800 font-black uppercase tracking-tight flex items-center gap-1">
            <Briefcase className="h-3 w-3" /> 현장실습 상세
          </p>
          <div className="space-y-1 bg-emerald-50/30 p-2 rounded-lg border border-emerald-100">
            <div className="grid grid-cols-2 gap-x-3 text-[10px]">
              <p className="flex justify-between"><span className="text-slate-400">실습내용</span> <span className={cn(
                "font-black text-right",
                student.is_hiring_conversion ? "text-blue-600" : 
                student.is_returned === 'O' ? "text-rose-600" : "text-emerald-700"
              )}>{student.is_hiring_conversion ? '채용전환' : student.is_returned === 'O' ? '복교' : student.has_field_training === 'O' ? '현장실습' : '-'}</span></p>
              <p className="flex justify-between"><span className="text-slate-400 pl-2">지원금</span> <span className="font-bold text-slate-700">{student.training_stipend_status || '-'}</span></p>
            </div>
            <div className="pt-1 border-t border-emerald-100 mt-1 space-y-1">
              <p className="flex justify-between text-[10px]">
                <span className="text-slate-400">실습기간</span>
                <span className="font-bold text-slate-700 text-right">{student.start_date || '?'} ~ {student.end_date || '?'}</span>
              </p>
              <div className="pt-1 border-t border-emerald-100/50">
                <p className="text-[9px] text-emerald-500 font-bold uppercase mb-0.5">실습처</p>
                <p className="font-black text-emerald-700 text-[17px] leading-tight truncate">
                  {student.latest_training_company || '미정'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="pt-1 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-indigo-800 font-black uppercase tracking-tight flex items-center gap-1">
            <Trophy className="h-3 w-3" /> 성적 및 석차
          </p>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={(e) => { e.stopPropagation(); setIsGradeModalOpen(true); }}
            className="h-6 px-2 text-[9px] font-black text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 gap-1"
          >
            상세보기 <ExternalLink className="h-2.5 w-2.5" />
          </Button>
        </div>

        {effectiveRankLoading ? (
          <div className="space-y-2 bg-slate-50 p-2 rounded-lg border border-slate-100 animate-pulse">
            <div className="h-3 bg-slate-200 rounded w-3/4 mb-1"></div>
            <div className="h-3 bg-slate-200 rounded w-1/2"></div>
          </div>
        ) : effectiveRankSummary && effectiveRankSummary.subjectCount > 0 ? (
          <div className="space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
            <div className="grid grid-cols-2 gap-x-3 text-[10px]">
              <p className="flex justify-between">
                <span className="text-slate-400">전교 석차</span>
                <span className="font-black text-indigo-700 text-right">
                  {effectiveRankSummary.totalRank}
                  <span className="text-[8px] text-indigo-400 font-medium ml-0.5">/ {effectiveRankSummary.schoolTotal}</span>
                </span>
              </p>
              <p className="flex justify-between">
                <span className="text-slate-400 pl-2">반 석차</span>
                <span className="font-black text-amber-700 text-right">
                  {effectiveRankSummary.classRank}
                  <span className="text-[8px] text-amber-500 font-medium ml-0.5">/ {effectiveRankSummary.classTotal}</span>
                </span>
              </p>
            </div>

            <div className="pt-1 border-t border-slate-200 mt-1">
              <p className="text-[9px] text-slate-400 font-bold mb-1.5 flex justify-between uppercase tracking-tighter">
                <span>성취도별 과목 수 (A-E)</span>
                <span>총 {effectiveRankSummary.subjectCount}개 과목</span>
              </p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(effectiveRankSummary.gradeCounts || {}).map(([grade, count]) => (
                  <div key={grade} className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-slate-200 min-w-[36px] justify-center">
                    <span className={cn(
                      "text-[9px] font-black",
                      grade === 'A' ? "text-emerald-600" :
                      grade === 'B' ? "text-blue-600" :
                      grade === 'C' ? "text-amber-600" :
                      grade === 'D' ? "text-orange-600" :
                      "text-rose-600"
                    )}>{grade}</span>
                    <span className="text-[10px] font-bold text-slate-700">{count as number}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-slate-400 italic bg-slate-50 p-2 rounded-lg text-center border border-dashed">등록된 성적 데이터가 없습니다.</p>
        )}
      </div>

      <div className="pt-0.5 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-rose-800 font-black uppercase tracking-tight flex items-center gap-1">
            <CalendarClock className="h-3 w-3" /> 출결 현황
          </p>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={(e) => { e.stopPropagation(); setIsAttendanceModalOpen(true); }}
            className="h-6 px-2 text-[9px] font-black text-rose-500 hover:text-rose-700 hover:bg-rose-50 gap-1"
          >
            상세보기 <ExternalLink className="h-2.5 w-2.5" />
          </Button>
        </div>
        {effectiveRankLoading ? (
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 animate-pulse">
            <div className="h-6 bg-slate-200 rounded w-full"></div>
          </div>
        ) : effectiveRankSummary?.attendance ? (
          <div className="bg-slate-50 p-1 rounded-lg border border-slate-100 overflow-hidden">
            <table className="w-full text-[9px] border-collapse">
              <thead>
                <tr className="text-slate-400 font-black uppercase text-[9px] border-b border-slate-200">
                  <th className="py-0.5 text-left">구분</th>
                  <th className="py-0.5">결석</th><th className="py-0.5">지각</th><th className="py-0.5">조퇴</th><th className="py-0.5">결과</th>
                </tr>
              </thead>
              <tbody className="font-bold text-center">
                <tr className="border-b border-slate-100">
                  <td className="py-1 text-left text-rose-600 font-black">미인정</td>
                  <td className={cn(effectiveRankSummary.attendance.unexcused.absent > 0 && "text-rose-600 font-black")}>{effectiveRankSummary.attendance.unexcused.absent}</td>
                  <td className={cn(effectiveRankSummary.attendance.unexcused.late > 0 && "text-rose-500")}>{effectiveRankSummary.attendance.unexcused.late}</td>
                  <td className={cn(effectiveRankSummary.attendance.unexcused.early > 0 && "text-rose-500")}>{effectiveRankSummary.attendance.unexcused.early}</td>
                  <td className={cn(effectiveRankSummary.attendance.unexcused.out > 0 && "text-rose-500")}>{effectiveRankSummary.attendance.unexcused.out}</td>
                </tr>
                <tr>
                  <td className="py-1 text-left text-blue-600 font-black">질병</td>
                  <td className="text-slate-600">{effectiveRankSummary.attendance.disease.absent}</td>
                  <td className="text-slate-600">{effectiveRankSummary.attendance.disease.late}</td>
                  <td className="text-slate-600">{effectiveRankSummary.attendance.disease.early}</td>
                  <td className="text-slate-600">{effectiveRankSummary.attendance.disease.out}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[10px] text-slate-400 italic bg-slate-50 p-1.5 rounded-lg text-center border border-dashed">등록된 출결 데이터가 없습니다.</p>
        )}
      </div>

      {student.certificates && student.certificates.length > 0 && (
        <div className="pt-1 space-y-1.5">
          <p className="text-[11px] text-slate-500 font-black uppercase tracking-tight flex items-center gap-1">
            <Award className="h-3 w-3" /> 취득 자격증
          </p>
          <div className="flex flex-wrap gap-1">
            {student.certificates.map((cert, i) => (
              <span key={i} className="bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-200 text-[9px] font-bold shadow-sm">
                {cert}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasCounselingAccess && (
        <div className="pt-2 flex justify-center">
          <Button 
            variant="outline"
            size="sm"
            onClick={(e) => { e.stopPropagation(); setIsCounselingModalOpen(true); }}
            className="px-3 h-7 text-[9px] font-black text-blue-600 border-blue-200 hover:bg-blue-50 gap-1 shadow-sm"
          >
            <MessageSquare className="h-3 w-3" />
            상담일지 보기
          </Button>
        </div>
      )}

      {student.remarks && (
        <div className="mt-2 p-2 bg-amber-50/50 rounded-lg text-[10px] text-amber-700 italic border-l-2 border-amber-200 leading-relaxed">
          "{student.remarks}"
        </div>
      )}
    </div>
  );

  return (
    <>
      {isMobile ? (
        <>
          <div onClick={() => setOpen(true)} className="cursor-pointer">
            {children}
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent 
              className="w-[92vw] max-w-[360px] max-h-[85vh] p-4 overflow-y-auto rounded-2xl shadow-2xl bg-white border-none z-[100] [&>button]:hidden"
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('button') || target.closest('a')) return;
                setOpen(false);
              }}
            >
              <DialogHeader className="sr-only">
                <DialogTitle>{student.student_name} 학생 정보</DialogTitle>
                <DialogDescription>{student.student_name} 학생의 취업, 성적 및 출결 상세 정보 모달</DialogDescription>
              </DialogHeader>
              {popoverBody}
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            {children}
          </PopoverTrigger>
          <PopoverContent 
            side={resolvedSide} 
            align={resolvedAlign}
            className="p-4 w-[300px] text-xs shadow-xl border-2 z-[100] max-h-[80vh] overflow-y-auto bg-white"
            sideOffset={5}
            collisionPadding={16}
            avoidCollisions={true}
            onPointerDownOutside={(e) => {
              const target = e.target as HTMLElement;
              if (target?.closest('select') || target?.tagName === 'OPTION') {
                e.preventDefault();
              }
            }}
            onFocusOutside={(e) => {
              // select 조작 시 포커스 이동으로 인한 팝오버 닫힘 원천 차단
              e.preventDefault();
            }}
            onInteractOutside={(e) => {
              const target = e.target as HTMLElement;
              if (target?.closest('select') || target?.tagName === 'OPTION') {
                e.preventDefault();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {popoverBody}
          </PopoverContent>
        </Popover>
      )}


      {/* 성적 상세 모달 */}
      <Dialog open={isGradeModalOpen} onOpenChange={setIsGradeModalOpen}>
        <DialogContent className="w-[96vw] sm:max-w-4xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-2xl sm:rounded-3xl z-[200] bg-white">
          <DialogHeader className="p-3 sm:p-6 bg-white border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between mr-4 sm:mr-8">
              <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
                <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100">
                  <User className="h-4 w-4 sm:h-6 sm:w-6 text-indigo-600" />
                </div>
                <div className="flex flex-col text-left min-w-0">
                  <DialogTitle className="text-sm sm:text-xl font-black flex items-center gap-1.5 sm:gap-2 text-slate-900 truncate">
                    {student.student_name}
                    <span className="text-[9px] sm:text-xs bg-indigo-600 text-white px-1.5 sm:px-2 py-0.5 rounded-full font-bold shrink-0">
                      {student.student_number}번
                    </span>
                  </DialogTitle>
                  <DialogDescription className="text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-wide mt-0.5 truncate">
                    {student.major} • {student.class_info}반 • {student.graduation_year}년 졸업
                  </DialogDescription>
                </div>
              </div>
              <div className="text-right shrink-0 pl-2">
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-black uppercase tracking-tighter mb-0.5">전교 석차</p>
                <p className="text-base sm:text-2xl font-black text-indigo-600">
                  {effectiveRankSummary?.totalRank ? `${effectiveRankSummary.totalRank}위` : '-'}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-2.5 sm:p-6 bg-slate-50 custom-scrollbar">
            {isLoading ? (
              <div className="h-64 flex flex-col items-center justify-center gap-3 sm:gap-4">
                <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 text-indigo-500 animate-spin" />
                <p className="text-xs sm:text-sm font-bold text-slate-400">상세 성적을 불러오는 중...</p>
              </div>
            ) : (
              groupedDetails && groupedDetails.length > 0 ? groupedDetails.map(([semesterKey, records]) => (
                <div key={semesterKey} className="mb-4 sm:mb-8 last:mb-0 space-y-1.5 sm:space-y-3">
                  <h4 className="font-black text-slate-800 flex items-center gap-2 text-xs sm:text-sm border-l-4 border-indigo-500 pl-2 sm:pl-3">
                    {semesterKey} 
                    <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {records.length}개 과목
                    </span>
                  </h4>
                  <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-x-auto custom-scrollbar">
                    <table className="w-full text-xs text-left min-w-[360px] sm:min-w-[480px]">
                      <thead className="bg-slate-50/50 text-slate-400 border-b font-black uppercase tracking-widest text-[9px] sm:text-[10px]">
                        <tr>
                          <th className="px-2.5 sm:px-4 py-2 sm:py-3.5">과목명</th>
                          <th className="px-1.5 sm:px-3 py-2 sm:py-3.5 text-center">학점</th>
                          <th className="px-1.5 sm:px-3 py-2 sm:py-3.5 text-center text-indigo-600">원점수</th>
                          <th className="px-1.5 sm:px-3 py-2 sm:py-3.5 text-center">과목평균</th>
                          <th className="px-1.5 sm:px-3 py-2 sm:py-3.5 text-center">성취도</th>
                          <th className="px-1.5 sm:px-3 py-2 sm:py-3.5 text-center">석차등급</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {records.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-2.5 sm:px-4 py-2 sm:py-3 font-bold text-slate-700 text-[11px] sm:text-xs">{r.subject}</td>
                            <td className="px-1.5 sm:px-3 py-2 sm:py-3 text-center font-medium text-slate-500 text-[10px] sm:text-xs">{r.credits || '-'}</td>
                            <td className="px-1.5 sm:px-3 py-2 sm:py-3 text-center font-black text-indigo-600 text-xs sm:text-sm">{r.score || '-'}</td>
                            <td className="px-1.5 sm:px-3 py-2 sm:py-3 text-center text-slate-400 font-medium text-[10px] sm:text-xs">{r.average_score || '-'}</td>
                            <td className="px-1.5 sm:px-3 py-2 sm:py-3 text-center">
                              <span className={cn(
                                "px-1.5 sm:px-2.5 py-0.5 rounded-full font-black text-[9px] sm:text-[10px]",
                                r.achievement === 'A' ? "bg-emerald-100 text-emerald-700" :
                                r.achievement === 'B' ? "bg-blue-100 text-blue-700" :
                                r.achievement === 'C' ? "bg-amber-100 text-amber-700" :
                                r.achievement === 'D' ? "bg-orange-100 text-orange-700" :
                                r.achievement === 'E' ? "bg-rose-100 text-rose-700" :
                                "bg-slate-100 text-slate-500"
                              )}>
                                {r.achievement || 'P'}
                              </span>
                            </td>
                            <td className="px-1.5 sm:px-3 py-2 sm:py-3 text-center font-black text-slate-700 text-[11px] sm:text-xs">{r.rank_grade ? `${r.rank_grade}등급` : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )) : (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 italic text-xs sm:text-sm">
                  기록된 성적 데이터가 없습니다.
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 출결 상세 모달 */}
      <Dialog open={isAttendanceModalOpen} onOpenChange={setIsAttendanceModalOpen}>
        <DialogContent className="w-[96vw] sm:max-w-4xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-2xl sm:rounded-3xl z-[200] bg-white">
          <DialogHeader className="p-3 sm:p-6 bg-white border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between mr-4 sm:mr-8">
              <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
                <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-xl bg-rose-50 flex items-center justify-center shrink-0 border border-rose-100">
                  <User className="h-4 w-4 sm:h-6 sm:w-6 text-rose-600" />
                </div>
                <div className="flex flex-col text-left min-w-0">
                  <DialogTitle className="text-sm sm:text-xl font-black flex items-center gap-1.5 sm:gap-2 text-slate-900 truncate">
                    {student.student_name}
                    <span className="text-[9px] sm:text-xs bg-rose-600 text-white px-1.5 sm:px-2 py-0.5 rounded-full font-bold shrink-0">
                      {student.student_number}번
                    </span>
                  </DialogTitle>
                  <DialogDescription className="text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-wide mt-0.5 truncate">
                    {student.major} • {student.class_info}반 • {student.graduation_year}년 졸업
                  </DialogDescription>
                </div>
              </div>
              <div className="text-right shrink-0 pl-2">
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-black uppercase tracking-tighter mb-0.5">미인정 결석</p>
                <p className="text-base sm:text-2xl font-black text-rose-600">
                  {effectiveRankSummary?.attendance?.unexcused?.absent ? `${effectiveRankSummary.attendance.unexcused.absent}회` : '0회'}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-2.5 sm:p-6 bg-slate-50 space-y-3 sm:space-y-6 custom-scrollbar">
            <div className="space-y-2 sm:space-y-3">
              <h3 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5 sm:gap-2 uppercase tracking-tight">
                <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-500 shrink-0" />
                학년별 상세 출결 기록
              </h3>

              {/* 통일된 컴팩트 표 형식 (가로 스크롤 지원) */}
              <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-x-auto custom-scrollbar">
                <table className="w-full text-xs text-left border-collapse min-w-[480px]">
                  <thead className="bg-slate-50 text-slate-600 font-black text-[9px] sm:text-[10px] tracking-tight border-b">
                    <tr>
                      <th className="px-2.5 sm:px-4 py-2 sm:py-3 border-r w-16 sm:w-20 text-center bg-slate-100/50">학년</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 border-r text-rose-600 bg-rose-50/40 text-center font-black" colSpan={4}>미인정(무단)</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 border-r text-blue-600 bg-blue-50/40 text-center font-black" colSpan={4}>질병</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-center bg-slate-50 font-black text-slate-700" colSpan={4}>기타</th>
                    </tr>
                    <tr className="bg-slate-50/80 text-[8.5px] sm:text-[9.5px] text-slate-500 border-b font-bold">
                      <th className="border-r bg-slate-100/30"></th>
                      <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 border-r text-center text-rose-500">결석</th>
                      <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 border-r text-center text-rose-500">지각</th>
                      <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 border-r text-center text-rose-500">조퇴</th>
                      <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 border-r text-center text-rose-500">결과</th>
                      <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 border-r text-center text-blue-500">결석</th>
                      <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 border-r text-center text-blue-500">지각</th>
                      <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 border-r text-center text-blue-500">조퇴</th>
                      <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 border-r text-center text-blue-500">결과</th>
                      <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 border-r text-center text-slate-500">결석</th>
                      <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 border-r text-center text-slate-500">지각</th>
                      <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 border-r text-center text-slate-500">조퇴</th>
                      <th className="px-1.5 sm:px-2 py-1 sm:py-1.5 text-center text-slate-500">결과</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {attendanceByGrade && attendanceByGrade.length > 0 ? (
                      attendanceByGrade.map((r: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-2.5 sm:px-4 py-2 sm:py-3 border-r font-black text-slate-800 text-center bg-slate-50/40 text-[11px] sm:text-xs whitespace-nowrap">{r.grade}학년</td>
                          <td className={cn("px-1.5 sm:px-2 py-2 sm:py-3 border-r text-center text-[11px] sm:text-xs", r.absent_unexcused > 0 ? "text-rose-600 font-black bg-rose-50/30" : "text-slate-300")}>{r.absent_unexcused}</td>
                          <td className={cn("px-1.5 sm:px-2 py-2 sm:py-3 border-r text-center text-[11px] sm:text-xs", r.late_unexcused > 0 ? "text-rose-500 font-black bg-rose-50/30" : "text-slate-300")}>{r.late_unexcused}</td>
                          <td className={cn("px-1.5 sm:px-2 py-2 sm:py-3 border-r text-center text-[11px] sm:text-xs", r.early_unexcused > 0 ? "text-rose-500 font-black bg-rose-50/30" : "text-slate-300")}>{r.early_unexcused}</td>
                          <td className={cn("px-1.5 sm:px-2 py-2 sm:py-3 border-r text-center text-[11px] sm:text-xs", r.out_unexcused > 0 ? "text-rose-500 font-black bg-rose-50/30" : "text-slate-300")}>{r.out_unexcused}</td>
                          <td className={cn("px-1.5 sm:px-2 py-2 sm:py-3 border-r text-center text-[11px] sm:text-xs", r.absent_disease > 0 ? "text-blue-600 font-bold bg-blue-50/20" : "text-slate-300")}>{r.absent_disease}</td>
                          <td className={cn("px-1.5 sm:px-2 py-2 sm:py-3 border-r text-center text-[11px] sm:text-xs", r.late_disease > 0 ? "text-blue-500 font-bold bg-blue-50/20" : "text-slate-300")}>{r.late_disease}</td>
                          <td className={cn("px-1.5 sm:px-2 py-2 sm:py-3 border-r text-center text-[11px] sm:text-xs", r.early_disease > 0 ? "text-blue-500 font-bold bg-blue-50/20" : "text-slate-300")}>{r.early_disease}</td>
                          <td className={cn("px-1.5 sm:px-2 py-2 sm:py-3 border-r text-center text-[11px] sm:text-xs", r.out_disease > 0 ? "text-blue-500 font-bold bg-blue-50/20" : "text-slate-300")}>{r.out_disease}</td>
                          <td className={cn("px-1.5 sm:px-2 py-2 sm:py-3 border-r text-center text-[11px] sm:text-xs", r.absent_other > 0 ? "text-slate-800 font-bold" : "text-slate-300")}>{r.absent_other}</td>
                          <td className={cn("px-1.5 sm:px-2 py-2 sm:py-3 border-r text-center text-[11px] sm:text-xs", r.late_other > 0 ? "text-slate-700 font-medium" : "text-slate-300")}>{r.late_other}</td>
                          <td className={cn("px-1.5 sm:px-2 py-2 sm:py-3 border-r text-center text-[11px] sm:text-xs", r.early_other > 0 ? "text-slate-700 font-medium" : "text-slate-300")}>{r.early_other}</td>
                          <td className={cn("px-1.5 sm:px-2 py-2 sm:py-3 text-center text-[11px] sm:text-xs", r.out_other > 0 ? "text-slate-700 font-medium" : "text-slate-300")}>{r.out_other}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={13} className="py-10 text-center text-slate-400 italic text-xs">기록된 출결 데이터가 없습니다.</td>
                      </tr>
                    )}

                    {/* 전체 누적 합계 행 */}
                    {totalAttendance && attendanceByGrade && attendanceByGrade.length > 0 && (
                      <tr className="bg-slate-50/90 font-black border-t-2 border-slate-200">
                        <td className="px-2.5 sm:px-4 py-2 sm:py-3 border-r font-black text-slate-900 text-center bg-slate-100/80 text-[11px] sm:text-xs whitespace-nowrap">누적 합계</td>
                        <td className={cn("px-1.5 sm:px-2 py-2 sm:py-3 border-r text-center text-[11px] sm:text-xs font-black", totalAttendance.unexcused.absent > 0 ? "text-rose-600 bg-rose-100/40" : "text-slate-400")}>{totalAttendance.unexcused.absent}</td>
                        <td className={cn("px-1.5 sm:px-2 py-2 sm:py-3 border-r text-center text-[11px] sm:text-xs font-black", totalAttendance.unexcused.late > 0 ? "text-rose-600 bg-rose-100/40" : "text-slate-400")}>{totalAttendance.unexcused.late}</td>
                        <td className={cn("px-1.5 sm:px-2 py-2 sm:py-3 border-r text-center text-[11px] sm:text-xs font-black", totalAttendance.unexcused.early > 0 ? "text-rose-600 bg-rose-100/40" : "text-slate-400")}>{totalAttendance.unexcused.early}</td>
                        <td className={cn("px-1.5 sm:px-2 py-2 sm:py-3 border-r text-center text-[11px] sm:text-xs font-black", totalAttendance.unexcused.out > 0 ? "text-rose-600 bg-rose-100/40" : "text-slate-400")}>{totalAttendance.unexcused.out}</td>
                        <td className={cn("px-1.5 sm:px-2 py-2 sm:py-3 border-r text-center text-[11px] sm:text-xs font-black", totalAttendance.disease.absent > 0 ? "text-blue-600 bg-blue-100/30" : "text-slate-400")}>{totalAttendance.disease.absent}</td>
                        <td className={cn("px-1.5 sm:px-2 py-2 sm:py-3 border-r text-center text-[11px] sm:text-xs font-black", totalAttendance.disease.late > 0 ? "text-blue-600 bg-blue-100/30" : "text-slate-400")}>{totalAttendance.disease.late}</td>
                        <td className={cn("px-1.5 sm:px-2 py-2 sm:py-3 border-r text-center text-[11px] sm:text-xs font-black", totalAttendance.disease.early > 0 ? "text-blue-600 bg-blue-100/30" : "text-slate-400")}>{totalAttendance.disease.early}</td>
                        <td className={cn("px-1.5 sm:px-2 py-2 sm:py-3 border-r text-center text-[11px] sm:text-xs font-black", totalAttendance.disease.out > 0 ? "text-blue-600 bg-blue-100/30" : "text-slate-400")}>{totalAttendance.disease.out}</td>
                        <td className={cn("px-1.5 sm:px-2 py-2 sm:py-3 border-r text-center text-[11px] sm:text-xs font-black", totalAttendance.other.absent > 0 ? "text-slate-800" : "text-slate-400")}>{totalAttendance.other.absent}</td>
                        <td className={cn("px-1.5 sm:px-2 py-2 sm:py-3 border-r text-center text-[11px] sm:text-xs font-black", totalAttendance.other.late > 0 ? "text-slate-800" : "text-slate-400")}>{totalAttendance.other.late}</td>
                        <td className={cn("px-1.5 sm:px-2 py-2 sm:py-3 border-r text-center text-[11px] sm:text-xs font-black", totalAttendance.other.early > 0 ? "text-slate-800" : "text-slate-400")}>{totalAttendance.other.early}</td>
                        <td className={cn("px-1.5 sm:px-2 py-2 sm:py-3 text-center text-[11px] sm:text-xs font-black", totalAttendance.other.out > 0 ? "text-slate-800" : "text-slate-400")}>{totalAttendance.other.out}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {attendanceByGrade?.some((r: any) => r.remarks) && (
              <div className="space-y-2 sm:space-y-3 pt-1">
                <h4 className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest">출결 특기사항</h4>
                <div className="grid gap-2 sm:gap-3">
                  {attendanceByGrade.filter((r: any) => r.remarks).map((r: any, i: number) => (
                    <div key={i} className="bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm flex gap-2.5 sm:gap-4 items-start">
                      <span className="text-[9px] sm:text-[10px] bg-slate-100 text-slate-500 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg font-black shrink-0">{r.grade}학년</span>
                      <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed italic">"{r.remarks}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CounselingModal 
        isOpen={isCounselingModalOpen}
        onClose={() => setIsCounselingModalOpen(false)}
        student={{
          id: student.id,
          student_name: student.student_name,
          major: student.major || '',
          class_info: student.class_info || '',
          student_number: student.student_number || ''
        }}
      />
    </>
  );
}
