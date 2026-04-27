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
  ClipboardList
} from 'lucide-react';
import { getStudentScoresById } from '@/app/students/actions';
import { Button } from '@/components/ui/button';

interface StudentGridCellProps {
  student: StudentEmploymentData;
  idx: number;
  variant: string;
  rankingSummary?: any; // 부모로부터 전달받은 사전 계산된 성적/출결 요약
}

export function StudentGridCell({ student, idx, variant, rankingSummary }: StudentGridCellProps) {
  const [isGradeModalOpen, setIsGradeModalOpen] = React.useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = React.useState(false);
  const [detailedScores, setDetailedScores] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const getDesireColor = (status?: string) => {
    switch (status) {
      case '예': return 'bg-emerald-500';
      case '아니오': return 'bg-rose-500';
      case '제외인정자': return 'bg-slate-400';
      default: return 'bg-transparent';
    }
  };

  // 모달 열릴 때 상세 성적 조회
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

  // 출결 학년별 그룹화 (랭킹서머리에 이미 집계된 기록 사용)
  const attendanceByGrade = React.useMemo(() => {
    if (!rankingSummary?.attnRecords) return null;
    return (rankingSummary.attnRecords as any[]).sort((a, b) => a.grade - b.grade);
  }, [rankingSummary]);

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <div
            className={cn(
              "h-7 border-b border-gray-200 flex items-center justify-between px-0.5 text-[10px] transition-colors hover:opacity-80 cursor-pointer active:bg-slate-100 relative pr-[5px]",
              variant
            )}
          >
            <span className="opacity-60 text-[7px] w-2">{student.student_number || idx + 1}</span>
            <span className="flex-1 text-center font-medium truncate tracking-tighter pr-0.5">{student.student_name}</span>
            <div className={cn("absolute right-[1px] top-[2px] bottom-[2px] w-[2.5px] rounded-full", getDesireColor(student.is_desiring_employment))} />
          </div>
        </PopoverTrigger>
        <PopoverContent 
          side="right" 
          align="start"
          className="p-4 w-[300px] text-xs shadow-xl border-2 z-[100] max-h-[80vh] overflow-y-auto"
          sideOffset={5}
        >
          <div className="space-y-4">
            {/* 헤더: 이름 및 희망여부 */}
            <div className="flex items-center justify-between border-b-2 pb-1.5 mb-1">
              <span className="font-bold text-[15px] text-blue-900">{student.student_name}</span>
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded-full font-bold",
                student.is_desiring_employment === '예' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
              )}>
                희망: {student.is_desiring_employment || '미정'}
              </span>
            </div>

            {/* 취업 상세 섹션 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-blue-800 font-black uppercase tracking-tight flex items-center gap-1">
                  <BarChart3 className="h-3 w-3" /> 취업 상세
                </p>
                <span className={cn(
                  "text-[9px] px-2 py-0.5 rounded-full font-black",
                  student.business_type === '취업' ? "bg-emerald-100 text-emerald-700" : 
                  student.business_type === '미취업' ? "bg-rose-100 text-rose-700" :
                  student.business_type === '채용진행중' ? "bg-amber-100 text-amber-700" :
                  student.business_type === '현장실습중' ? "bg-blue-100 text-blue-700" :
                  student.business_type === '도제OJT' ? "bg-emerald-50 text-emerald-600" :
                  student.business_type === '제외인정자' ? "bg-slate-100 text-slate-700" :
                  "bg-slate-50 text-slate-400"
                )}>
                  현황: {student.business_type || '미결정'}
                </span>
              </div>
              <div className="space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="flex items-center text-[9px] font-bold text-slate-500 gap-1 flex-wrap">
                  <span>진로코스</span>
                  <span className="text-slate-800">{student.employment_status || '미정'}</span>
                  <span className="text-slate-300 mx-0.5">|</span>
                  <span>기업구분</span>
                  <span className="text-blue-600">{student.company_type || '미분류'}</span>
                </div>
                <div className="pt-1 border-t border-slate-200 mt-1">
                  <p className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">취업처</p>
                  <p className="font-black text-blue-600 text-[17px] leading-tight truncate">
                    {student.company || '미정'}
                  </p>
                </div>
              </div>
            </div>

            {/* 현장실습 상세 섹션 */}
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
                  <div className="pt-1 border-t border-emerald-100 mt-1">
                    <p className="text-[9px] text-slate-500 mb-1">기간: {student.start_date || '?'} ~ {student.end_date || '?'}</p>
                    <p className="text-[9px] text-emerald-500 font-bold uppercase mb-0.5">실습처</p>
                    <p className="font-black text-emerald-700 text-[17px] leading-tight truncate">
                      {student.latest_training_company || '미정'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 성적 및 석차 섹션 */}
            <div className="pt-1 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-indigo-800 font-black uppercase tracking-tight flex items-center gap-1">
                  <Trophy className="h-3 w-3" /> 성적 및 석차
                </p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsGradeModalOpen(true)}
                  className="h-6 px-2 text-[9px] font-black text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 gap-1"
                >
                  상세보기 <ExternalLink className="h-2.5 w-2.5" />
                </Button>
              </div>

              {rankingSummary ? (
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

            {/* 출결 현황 섹션 */}
            <div className="pt-0.5 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-rose-800 font-black uppercase tracking-tight flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" /> 출결 현황
                </p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsAttendanceModalOpen(true)}
                  className="h-6 px-2 text-[9px] font-black text-rose-500 hover:text-rose-700 hover:bg-rose-50 gap-1"
                >
                  상세보기 <ExternalLink className="h-2.5 w-2.5" />
                </Button>
              </div>
              {rankingSummary?.attendance ? (
                <div className="bg-slate-50 p-1 rounded-lg border border-slate-100 overflow-hidden">
                  <table className="w-full text-[9px] border-collapse">
                    <thead>
                      <tr className="text-slate-400 font-black uppercase text-[7px] border-b border-slate-200">
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

            {/* 취득 자격증 섹션 */}
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

            {student.remarks && (
              <div className="mt-2 p-2 bg-amber-50/50 rounded-lg text-[10px] text-amber-700 italic border-l-2 border-amber-200 leading-relaxed">
                "{student.remarks}"
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* 성적 상세 모달 */}
      <Dialog open={isGradeModalOpen} onOpenChange={setIsGradeModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-3xl z-[150] [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:bg-white/10 [&>button]:p-2 [&>button]:rounded-full [&>button]:transition-colors">
          <DialogHeader className="p-8 bg-slate-900 text-white relative">
            <div className="flex items-center gap-5">
              <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10">
                <User className="h-8 w-8 text-white/80" />
              </div>
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-3">
                  <DialogTitle className="text-2xl font-black text-white">{student.student_name}</DialogTitle>
                  <span className="text-[11px] bg-indigo-500 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-widest shadow-sm">
                    {student.student_number}번
                  </span>
                </div>
                <DialogDescription className="text-slate-400 text-sm font-bold mt-1.5 flex items-center gap-2">
                  <span>{student.major}</span>
                  <span className="h-1 w-1 rounded-full bg-slate-700" />
                  <span>{student.class_info}</span>
                  <span className="h-1 w-1 rounded-full bg-slate-700" />
                  <span className="text-indigo-400">{student.graduation_year}년 졸업예정</span>
                </DialogDescription>
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
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-3xl z-[150] [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:bg-white/10 [&>button]:p-2 [&>button]:rounded-full [&>button]:transition-colors">
          <DialogHeader className="p-8 bg-slate-900 text-white relative">
            <div className="flex items-center gap-5">
              <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10">
                <User className="h-8 w-8 text-white/80" />
              </div>
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-3">
                  <DialogTitle className="text-2xl font-black text-white">{student.student_name}</DialogTitle>
                  <span className="text-[11px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-widest shadow-sm">
                    {student.student_number}번
                  </span>
                </div>
                <DialogDescription className="text-slate-400 text-sm font-bold mt-1.5 flex items-center gap-2">
                  <span>{student.major}</span>
                  <span className="h-1 w-1 rounded-full bg-slate-700" />
                  <span>{student.class_info}</span>
                  <span className="h-1 w-1 rounded-full bg-slate-700" />
                  <span className="text-rose-400">{student.graduation_year}년 졸업예정</span>
                </DialogDescription>
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
                        <td className={cn("px-2 py-4 border-r text-center", r.late_other > 0 ? "text-slate-500" : "text-slate-300")}>{r.late_other}</td>
                        <td className={cn("px-2 py-4 border-r text-center", r.early_other > 0 ? "text-slate-500" : "text-slate-300")}>{r.early_other}</td>
                        <td className={cn("px-2 py-4 text-center", r.out_other > 0 ? "text-slate-500" : "text-slate-300")}>{r.out_other}</td>
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
    </>
  );
}
