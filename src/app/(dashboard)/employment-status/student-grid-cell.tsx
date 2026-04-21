'use client';

import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { StudentEmploymentData } from '@/lib/data';

interface StudentGridCellProps {
  student: StudentEmploymentData;
  idx: number;
  variant: string;
}

export function StudentGridCell({ student, idx, variant }: StudentGridCellProps) {
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
        <div className="space-y-3">
          {/* 헤더: 이름 및 희망여부 */}
          <div className="flex items-center justify-between border-b-2 pb-1.5 mb-1.5">
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
              <p className="text-xs text-blue-800 font-black uppercase tracking-tight">취업 상세</p>
              <span className={cn(
                "text-[9px] px-2 py-0.5 rounded-full font-black",
                student.business_type === '취업' ? "bg-emerald-100 text-emerald-700" : 
                student.business_type === '미취업' ? "bg-rose-100 text-rose-700" :
                student.business_type === '면접중' ? "bg-amber-100 text-amber-700" :
                student.business_type === '현장실습중' ? "bg-blue-100 text-blue-700" :
                student.business_type === '제외인정자' ? "bg-slate-100 text-slate-700" :
                "bg-slate-50 text-slate-400"
              )}>
                현황: {student.business_type || '미결정'}
              </span>
            </div>
            <div className="space-y-1.5 text-slate-600">
              <p className="flex justify-between text-[11px]"><span className="text-slate-400 font-medium">진로코스</span> <span className="font-bold text-slate-700">{student.employment_status || '-'}</span></p>
              <p className="flex justify-between text-[11px]"><span className="text-slate-400 font-medium">기업구분</span> <span className="font-bold text-slate-700">{student.company_type || '-'}</span></p>
            </div>
            <div className="pt-1.5">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mb-1">취업처</p>
              <p className="font-black text-blue-700 text-[15px] leading-tight bg-blue-50/50 p-1.5 rounded-lg border border-blue-100">
                {student.company || '취업처 미정'}
              </p>
            </div>
          </div>
          
          {/* 현장실습 상세 섹션: 이력이 있는 경우에만 표시 */}
          {(student.has_field_training === 'O' || (student.training_records && student.training_records.length > 0)) && (
            <div className="pt-2 border-t-2 mt-1 space-y-2">
              <p className="text-xs text-emerald-800 font-black uppercase tracking-tight">현장실습 상세</p>
              <div className="grid grid-cols-2 gap-x-3 text-[11px]">
                <p className="flex justify-between"><span className="text-slate-400">실습결과</span> <span className={cn(
                  "font-black",
                  student.is_hiring_conversion ? "text-blue-600" : 
                  student.is_returned === 'O' ? "text-rose-600" : "text-slate-600"
                )}>{student.is_hiring_conversion ? '채용전환' : student.is_returned === 'O' ? '복교' : student.has_field_training === 'O' ? '진행중' : '-'}</span></p>
                <p className="flex justify-between"><span className="text-slate-400">지원금</span> <span className="font-black text-slate-700">{student.training_stipend_status || '-'}</span></p>
              </div>
              <div className="grid grid-cols-2 gap-x-3 text-[11px] pt-1 border-t border-slate-100">
                <p className="flex justify-between"><span className="text-slate-400">시작일</span> <span className="font-bold text-slate-700">{student.start_date || '-'}</span></p>
                <p className="flex justify-between"><span className="text-slate-400">종료일</span> <span className="font-bold text-slate-700">{student.end_date || '-'}</span></p>
              </div>
              <div className="pt-1.5">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mb-1">실습처</p>
                <p className="font-black text-emerald-600 text-[15px] leading-tight bg-emerald-50/50 p-1.5 rounded-lg border border-emerald-100">
                  {student.latest_training_company || '실습처 미정'}
                </p>
              </div>
              {student.is_returned === 'O' && student.return_to_school_reason && (
                <p className="text-[10px] text-rose-500 leading-tight bg-rose-50 p-2 rounded-lg border border-rose-100 mt-1">
                  <span className="font-black">복교사유:</span> {student.return_to_school_reason}
                </p>
              )}
            </div>
          )}

          {student.remarks && (
            <div className="mt-2 p-2 bg-amber-50/50 rounded-lg text-[11px] text-amber-700 italic border-l-4 border-amber-200 leading-relaxed">
              "{student.remarks}"
            </div>
          )}

          {/* 취득 자격증 섹션 */}
          {student.certificates && student.certificates.length > 0 && (
            <div className="pt-2 border-t-2 mt-2">
              <p className="text-xs text-slate-500 font-black uppercase tracking-tight mb-1.5">취득 자격증</p>
              <div className="flex flex-wrap gap-1.5">
                {student.certificates.map((cert, i) => (
                  <span key={i} className="bg-slate-100 text-slate-700 px-2 py-1 rounded-md text-[10px] font-bold border border-slate-200 shadow-sm">
                    {cert}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
