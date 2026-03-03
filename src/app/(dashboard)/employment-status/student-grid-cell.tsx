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
  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "h-7 border-b border-gray-200 flex items-center justify-between px-0.5 text-[10px] transition-colors hover:opacity-80 cursor-pointer active:bg-slate-100",
            variant
          )}
        >
          <span className="opacity-60 text-[7px] w-2">{student.student_number || idx + 1}</span>
          <span className="flex-1 text-center font-medium truncate tracking-tighter">{student.student_name}</span>
        </div>
      </PopoverTrigger>
      <PopoverContent 
        side="right" 
        align="start"
        className="p-3 w-[220px] text-xs shadow-xl border-2 z-[100]"
        sideOffset={5}
      >
        <div className="space-y-1.5">
          <div className="flex items-center justify-between border-b pb-1 mb-1">
            <span className="font-bold text-[13px] text-blue-900">{student.student_name}</span>
            <span className={cn(
              "text-[9px] px-1.5 py-0.5 rounded-full font-bold",
              student.is_desiring_employment === '예' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
            )}>
              희망: {student.is_desiring_employment || '미정'}
            </span>
          </div>
          <div className="space-y-1 text-slate-600">
            <p className="flex justify-between"><span className="text-slate-400 font-medium">취업구분</span> <span className="font-semibold text-slate-700">{student.employment_status || '-'}</span></p>
            <p className="flex justify-between"><span className="text-slate-400 font-medium">사업구분</span> <span className="font-semibold text-slate-700">{student.business_type || '-'}</span></p>
            <p className="flex justify-between"><span className="text-slate-400 font-medium">기업구분</span> <span className="font-semibold text-slate-700">{student.company_type || '-'}</span></p>
          </div>
          <div className="pt-1.5 border-t mt-1">
            <p className="text-[10px] text-slate-400 font-bold mb-0.5 uppercase tracking-tighter">취업/실습처</p>
            <p className="font-black text-blue-700 text-sm leading-tight">
              {student.company || '취업처 미정'}
            </p>
          </div>
          {student.remarks && (
            <div className="mt-1.5 p-1.5 bg-slate-50 rounded text-[10px] text-slate-500 italic border-l-2 border-slate-200">
              "{student.remarks}"
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
