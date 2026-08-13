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
  Phone
} from 'lucide-react';
import { getStudentScoresById, updateStudentField } from '@/app/students/actions';
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
  isLowerGrade: propIsLowerGrade
}: StudentPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const isMobile = useIsMobile();
  const resolvedSide = side || (isMobile ? 'bottom' : 'right');
  const resolvedAlign = align || (isMobile ? 'center' : 'start');

  const [isGradeModalOpen, setIsGradeModalOpen] = React.useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = React.useState(false);
  const [isCounselingModalOpen, setIsCounselingModalOpen] = React.useState(false);
  const [detailedScores, setDetailedScores] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const resolvedBaseYear = baseYear || 2026;
  const studentGrade = student.graduation_year ? (4 - (student.graduation_year - resolvedBaseYear)) : 3;
  const isLowerGrade = propIsLowerGrade !== undefined ? propIsLowerGrade : (studentGrade === 1 || studentGrade === 2);

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
    if (!rankingSummary?.attnRecords) return null;
    return (rankingSummary.attnRecords as any[]).sort((a, b) => a.grade - b.grade);
  }, [rankingSummary]);

  const popoverBody = (
    <div className="space-y-4">
      <div className="flex items-start justify-between border-b-2 pb-2 mb-1 gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-[15px] text-blue-900">{student.student_name}</span>
            {student.teacher_name && (
              <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 font-bold shrink-0">
                {student.teacher_name}T
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
              <div className="pt-1 border-t border-slate-200 mt-1">
                <p className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">희망진로코스</p>
                <p className="font-black text-blue-600 text-[17px] leading-tight truncate">
                  {student.career_course || '미설정'}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-3 text-[10px]">
                <p className="flex justify-between">
                  <span className="text-slate-400">진로코스</span> 
                  <span className="font-bold text-slate-700 text-right">{student.employment_status || '미정'}</span>
                </p>
                <p className="flex justify-between">
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
              <p className="flex justify-between"><span className="text-slate-400">실습결과</span> <span className={cn(
                "font-black text-right",
                student.is_hiring_conversion ? "text-blue-600" : 
                student.is_returned === 'O' ? "text-rose-600" : "text-emerald-700"
              )}>{student.is_hiring_conversion ? '채용전환' : student.is_returned === 'O' ? '복교' : student.has_field_training === 'O' ? '진행중' : '-'}</span></p>
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

        {isRankingsLoading ? (
          <div className="space-y-2 bg-slate-50 p-2 rounded-lg border border-slate-100 animate-pulse">
            <div className="h-3 bg-slate-200 rounded w-3/4 mb-1"></div>
            <div className="h-3 bg-slate-200 rounded w-1/2"></div>
          </div>
        ) : rankingSummary && rankingSummary.subjectCount > 0 ? (
          <div className="space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
            <div className="grid grid-cols-2 gap-x-3 text-[10px]">
              <p className="flex justify-between">
                <span className="text-slate-400">전교 석차</span>
                <span className="font-black text-indigo-700 text-right">
                  {rankingSummary.totalRank}
                  <span className="text-[8px] text-indigo-400 font-medium ml-0.5">/ {rankingSummary.schoolTotal}</span>
                </span>
              </p>
              <p className="flex justify-between">
                <span className="text-slate-400 pl-2">반 석차</span>
                <span className="font-black text-amber-700 text-right">
                  {rankingSummary.classRank}
                  <span className="text-[8px] text-amber-500 font-medium ml-0.5">/ {rankingSummary.classTotal}</span>
                </span>
              </p>
            </div>

            <div className="pt-1 border-t border-slate-200 mt-1">
              <p className="text-[9px] text-slate-400 font-bold mb-1.5 flex justify-between uppercase tracking-tighter">
                <span>성취도별 과목 수 (A-E)</span>
                <span>총 {rankingSummary.subjectCount}개 과목</span>
              </p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(rankingSummary.gradeCounts || {}).map(([grade, count]) => (
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
        {isRankingsLoading ? (
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 animate-pulse">
            <div className="h-6 bg-slate-200 rounded w-full"></div>
          </div>
        ) : rankingSummary?.attendance ? (
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
                  <td className={cn(rankingSummary.attendance.unexcused.absent > 0 && "text-rose-600 font-black")}>{rankingSummary.attendance.unexcused.absent}</td>
                  <td className={cn(rankingSummary.attendance.unexcused.late > 0 && "text-rose-500")}>{rankingSummary.attendance.unexcused.late}</td>
                  <td className={cn(rankingSummary.attendance.unexcused.early > 0 && "text-rose-500")}>{rankingSummary.attendance.unexcused.early}</td>
                  <td className={cn(rankingSummary.attendance.unexcused.out > 0 && "text-rose-500")}>{rankingSummary.attendance.unexcused.out}</td>
                </tr>
                <tr>
                  <td className="py-1 text-left text-blue-600 font-black">질병</td>
                  <td className="text-slate-600">{rankingSummary.attendance.disease.absent}</td>
                  <td className="text-slate-600">{rankingSummary.attendance.disease.late}</td>
                  <td className="text-slate-600">{rankingSummary.attendance.disease.early}</td>
                  <td className="text-slate-600">{rankingSummary.attendance.disease.out}</td>
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
        <Popover open={open} onOpenChange={setOpen} modal={false}>
          <PopoverTrigger asChild>
            {children}
          </PopoverTrigger>
          <PopoverContent 
            side={resolvedSide} 
            align={resolvedAlign}
            className="p-4 w-[300px] text-xs shadow-xl border-2 z-[100] max-h-[80vh] overflow-y-auto bg-white cursor-pointer"
            sideOffset={5}
            collisionPadding={16}
            avoidCollisions={true}
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest('button') || target.closest('a')) return;
              setOpen(false);
            }}
          >
            {popoverBody}
          </PopoverContent>
        </Popover>
      )}

      {/* 성적 상세 모달 */}
      <Dialog open={isGradeModalOpen} onOpenChange={setIsGradeModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-3xl z-[200] bg-white">
          <DialogHeader className="p-4 sm:p-6 bg-white border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between mr-6 sm:mr-8">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100">
                  <User className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" />
                </div>
                <div className="flex flex-col text-left min-w-0">
                  <DialogTitle className="text-base sm:text-xl font-black flex items-center gap-2 text-slate-900 truncate">
                    {student.student_name}
                    <span className="text-[10px] sm:text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold shrink-0">
                      {student.student_number}번
                    </span>
                  </DialogTitle>
                  <DialogDescription className="text-slate-500 text-[11px] sm:text-xs font-bold uppercase tracking-wide mt-0.5 truncate">
                    {student.major} • {student.class_info}반 • {student.graduation_year}년 졸업예정
                  </DialogDescription>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-black uppercase tracking-tighter mb-0.5 sm:mb-1">전교 석차</p>
                <p className="text-lg sm:text-2xl font-black text-indigo-600">
                  {rankingSummary?.totalRank ? `${rankingSummary.totalRank}위` : '-'}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
            {isLoading ? (
              <div className="h-64 flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                <p className="text-sm font-bold text-slate-400">상세 성적을 불러오는 중...</p>
              </div>
            ) : (
              groupedDetails ? groupedDetails.map(([semesterKey, records]) => (
                <div key={semesterKey} className="mb-8 last:mb-0 space-y-3">
                  <h4 className="font-black text-slate-800 flex items-center gap-2 text-sm border-l-4 border-indigo-500 pl-3">
                    {semesterKey} 
                    <span className="text-[10px] text-slate-400 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {records.length}개 과목
                    </span>
                  </h4>
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50/50 text-slate-400 border-b font-black uppercase tracking-widest text-[10px]">
                        <tr>
                          <th className="px-6 py-4">과목명</th>
                          <th className="px-4 py-4 text-center">학점</th>
                          <th className="px-4 py-4 text-center text-indigo-600">원점수</th>
                          <th className="px-4 py-4 text-center">과목평균</th>
                          <th className="px-4 py-4 text-center">성취도</th>
                          <th className="px-4 py-4 text-center">석차등급</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {records.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-700">{r.subject}</td>
                            <td className="px-4 py-4 text-center font-medium text-slate-500">{r.credits || '-'}</td>
                            <td className="px-4 py-4 text-center font-black text-indigo-600 text-sm">{r.score || '-'}</td>
                            <td className="px-4 py-4 text-center text-slate-400 font-medium">{r.average_score || '-'}</td>
                            <td className="px-4 py-4 text-center">
                              <span className={cn(
                                "px-2.5 py-1 rounded-full font-black text-[10px]",
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
                            <td className="px-4 py-4 text-center font-black text-slate-700">{r.rank_grade ? `${r.rank_grade}등급` : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )) : (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 italic">
                  기록된 성적 데이터가 없습니다.
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 출결 상세 모달 */}
      <Dialog open={isAttendanceModalOpen} onOpenChange={setIsAttendanceModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-3xl z-[200] bg-white">
          <DialogHeader className="p-4 sm:p-6 bg-white border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between mr-6 sm:mr-8">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-rose-50 flex items-center justify-center shrink-0 border border-rose-100">
                  <User className="h-5 w-5 sm:h-6 sm:w-6 text-rose-600" />
                </div>
                <div className="flex flex-col text-left min-w-0">
                  <DialogTitle className="text-base sm:text-xl font-black flex items-center gap-2 text-slate-900 truncate">
                    {student.student_name}
                    <span className="text-[10px] sm:text-xs bg-rose-600 text-white px-2 py-0.5 rounded-full font-bold shrink-0">
                      {student.student_number}번
                    </span>
                  </DialogTitle>
                  <DialogDescription className="text-slate-500 text-[11px] sm:text-xs font-bold uppercase tracking-wide mt-0.5 truncate">
                    {student.major} • {student.class_info}반 • {student.graduation_year}년 졸업예정
                  </DialogDescription>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-black uppercase tracking-tighter mb-0.5 sm:mb-1">미인정 결석</p>
                <p className="text-lg sm:text-2xl font-black text-rose-600">
                  {rankingSummary?.attendance?.unexcused?.absent ? `${rankingSummary.attendance.unexcused.absent}회` : '0회'}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-8 bg-slate-50 space-y-8">
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                <ClipboardList className="h-4 w-4 text-rose-500" />
                학년별 상세 출결 기록
              </h3>
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest border-b">
                    <tr>
                      <th className="px-6 py-4 border-r w-24 text-center">대상 학년</th>
                      <th className="px-6 py-4 border-r text-rose-600 bg-rose-50/30 text-center" colSpan={4}>미인정(무단)</th>
                      <th className="px-6 py-4 border-r text-blue-600 bg-blue-50/30 text-center" colSpan={4}>질병</th>
                      <th className="px-6 py-4 text-center bg-slate-50/30" colSpan={4}>기타</th>
                    </tr>
                    <tr className="bg-slate-50/30 text-[9px] text-slate-400 border-b">
                      <th className="border-r"></th>
                      <th className="px-2 py-2 border-r text-center">결석</th><th className="px-2 py-2 border-r text-center">지각</th><th className="px-2 py-2 border-r text-center">조퇴</th><th className="px-2 py-2 border-r text-center">결과</th>
                      <th className="px-2 py-2 border-r text-center">결석</th><th className="px-2 py-2 border-r text-center">지각</th><th className="px-2 py-2 border-r text-center">조퇴</th><th className="px-2 py-2 border-r text-center">결과</th>
                      <th className="px-2 py-2 border-r text-center">결석</th><th className="px-2 py-2 border-r text-center">지각</th><th className="px-2 py-2 border-r text-center">조퇴</th><th className="px-2 py-2 text-center">결과</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendanceByGrade?.map((r: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 border-r font-black text-slate-700 text-center bg-slate-50/30">{r.grade}학년</td>
                        <td className={cn("px-2 py-4 border-r text-center font-black", r.absent_unexcused > 0 ? "text-rose-600" : "text-slate-300")}>{r.absent_unexcused}</td>
                        <td className={cn("px-2 py-4 border-r text-center font-bold", r.late_unexcused > 0 ? "text-rose-500" : "text-slate-300")}>{r.late_unexcused}</td>
                        <td className={cn("px-2 py-4 border-r text-center font-bold", r.early_unexcused > 0 ? "text-rose-500" : "text-slate-300")}>{r.early_unexcused}</td>
                        <td className={cn("px-2 py-4 border-r text-center font-bold", r.out_unexcused > 0 ? "text-rose-500" : "text-slate-300")}>{r.out_unexcused}</td>
                        <td className={cn("px-2 py-4 border-r text-center", r.absent_disease > 0 ? "text-blue-600" : "text-slate-300")}>{r.absent_disease}</td>
                        <td className={cn("px-2 py-4 border-r text-center", r.late_disease > 0 ? "text-blue-500" : "text-slate-300")}>{r.late_disease}</td>
                        <td className={cn("px-2 py-4 border-r text-center", r.early_disease > 0 ? "text-blue-500" : "text-slate-300")}>{r.early_disease}</td>
                        <td className={cn("px-2 py-4 text-center", r.out_disease > 0 ? "text-blue-500" : "text-slate-300")}>{r.out_disease}</td>
                        <td className={cn("px-2 py-4 border-r text-center", r.absent_other > 0 ? "text-slate-600" : "text-slate-300")}>{r.absent_other}</td>
                        <td className={cn("px-2 py-2 border-r text-center", r.late_other > 0 ? "text-slate-500" : "text-slate-300")}>{r.late_other}</td>
                        <td className={cn("px-2 py-2 border-r text-center", r.early_other > 0 ? "text-slate-500" : "text-slate-300")}>{r.early_other}</td>
                        <td className={cn("px-2 py-2 text-center", r.out_other > 0 ? "text-slate-500" : "text-slate-300")}>{r.out_other}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {attendanceByGrade?.some((r: any) => r.remarks) && (
              <div className="space-y-3">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">출결 특기사항</h4>
                <div className="grid gap-3">
                  {attendanceByGrade.filter((r: any) => r.remarks).map((r: any, i: number) => (
                    <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex gap-4 items-start">
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-lg font-black shrink-0">{r.grade}학년</span>
                      <p className="text-xs text-slate-600 leading-relaxed italic">"{r.remarks}"</p>
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
