'use client';

import * as React from 'react';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { StudentEmploymentData } from '@/lib/data';
import { Trophy, BarChart3, Award, Briefcase } from 'lucide-react';

interface StudentGridCellProps {
  student: StudentEmploymentData;
  idx: number;
  variant: string;
  rankingSummary?: any; // 부모로부터 전달받은 사전 계산된 성적 요약
}

export function StudentGridCell({ student, idx, variant, rankingSummary }: StudentGridCellProps) {
  const getDesireColor = (status?: string) => {
    switch (status) {
      case '예': return 'bg-emerald-500';
      case '아니오': return 'bg-rose-500';
      case '제외인정자': return 'bg-slate-400';
      default: return 'bg-transparent';
    }
  };

  return (
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
        className="p-4 w-[280px] text-xs shadow-xl border-2 z-[100]"
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
                student.business_type === '제외인정자' ? "bg-slate-100 text-slate-700" :
                "bg-slate-50 text-slate-400"
              )}>
                현황: {student.business_type || '미결정'}
              </span>
            </div>
            <div className="space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
              <p className="flex justify-between text-[10px]"><span className="text-slate-400 font-medium">진로코스</span> <span className="font-bold text-slate-700">{student.employment_status || '-'}</span></p>
              <p className="flex justify-between text-[10px]"><span className="text-slate-400 font-medium">기업구분</span> <span className="font-bold text-slate-700">{student.company_type || '-'}</span></p>
              <div className="pt-1 border-t border-slate-200 mt-1">
                <p className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">취업처</p>
                <p className="font-black text-blue-600 text-[17px] leading-tight truncate">
                  {student.company || '미정'}
                </p>
              </div>
            </div>
          </div>

          {/* 현장실습 상세 섹션: 이력이 있는 경우에만 표시 */}
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
                {student.is_returned === 'O' && student.return_to_school_reason && (
                  <p className="text-[9px] text-rose-500 leading-tight bg-white/50 p-1.5 rounded border border-rose-100 mt-1">
                    <span className="font-black">복교사유:</span> {student.return_to_school_reason}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 성적 및 석차 요약 섹션 */}
          <div className="pt-1 space-y-2">
            <p className="text-[11px] text-indigo-800 font-black uppercase tracking-tight flex items-center gap-1">
              <Trophy className="h-3 w-3" /> 성적 및 석차 요약
            </p>

            {rankingSummary ? (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 text-center">
                    <p className="text-[9px] text-indigo-400 font-bold uppercase mb-0.5">전교 석차</p>
                    <p className="text-sm font-black text-indigo-700">{rankingSummary.totalRank}<span className="text-[10px] ml-0.5 text-indigo-400 font-medium">/ {rankingSummary.schoolTotal}명</span></p>
                  </div>
                  <div className="bg-amber-50/50 p-2 rounded-lg border border-amber-100 text-center">
                    <p className="text-[9px] text-amber-500 font-bold uppercase mb-0.5">반 석차</p>
                    <p className="text-sm font-black text-amber-700">{rankingSummary.classRank}<span className="text-[10px] ml-0.5 text-amber-400 font-medium">/ {rankingSummary.classTotal}명</span></p>
                  </div>
                </div>

                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <p className="text-[9px] text-slate-400 font-bold mb-1.5 flex justify-between uppercase tracking-tighter">
                    <span>성취도별 과목 수 (A-E)</span>
                    <span>총 {rankingSummary.subjectCount}개 과목</span>
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(rankingSummary.gradeCounts || {}).map(([grade, count]) => (
                      <div key={grade} className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 min-w-[36px] justify-center">
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
  );
}
