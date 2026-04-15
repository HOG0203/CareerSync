'use client';

import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { StudentEmploymentData } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { updateStudentField } from '@/app/students/actions';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import * as React from 'react';

interface LaborEducationGridCellProps {
  student: StudentEmploymentData;
  idx: number;
  isAdmin: boolean;
}

export function LaborEducationGridCell({ student, idx, isAdmin }: LaborEducationGridCellProps) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = React.useState(false);

  const status = student.labor_education_status || '미이수';
  const isCompleted = status === '이수';

  const handleUpdateStatus = async (newStatus: string) => {
    if (!isAdmin) return;
    
    setIsUpdating(true);
    const result = await updateStudentField(student.id, 'labor_education_status', newStatus);
    
    if (result.success) {
      toast({
        title: "업데이트 완료",
        description: `${student.student_name} 학생의 이수 여부가 '${newStatus}'로 변경되었습니다.`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "업데이트 실패",
        description: result.error || "알 수 없는 오류가 발생했습니다.",
      });
    }
    setIsUpdating(false);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "h-7 border-b border-gray-200 flex items-center justify-between px-0.5 text-[10px] transition-colors hover:opacity-80 cursor-pointer active:bg-slate-100 relative",
            isCompleted ? "bg-emerald-500 text-white border-emerald-600" : "bg-white text-black border-gray-200"
          )}
        >
          <span className="opacity-60 text-[7px] w-2">{student.student_number || idx + 1}</span>
          <span className="flex-1 text-center font-medium truncate tracking-tighter">{student.student_name}</span>
        </div>
      </PopoverTrigger>
      <PopoverContent 
        side="right" 
        align="start"
        className="p-4 w-[240px] text-xs shadow-xl border-2 z-[100]"
        sideOffset={5}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b-2 pb-1.5 mb-1.5">
            <span className="font-bold text-[15px] text-blue-900">{student.student_name}</span>
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded-full font-bold",
              isCompleted ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
            )}>
              {status}
            </span>
          </div>

          <div className="space-y-1 text-slate-600 text-[11px]">
            <p className="flex justify-between"><span className="text-slate-400">학과</span> <span className="font-bold">{student.major}</span></p>
            <p className="flex justify-between"><span className="text-slate-400">반/번호</span> <span className="font-bold">{student.class_info}반 {student.student_number}번</span></p>
          </div>

          {isAdmin ? (
            <div className="pt-2 border-t space-y-2">
              <p className="text-[10px] text-blue-600 font-black flex items-center gap-1 uppercase tracking-tight">
                <ShieldCheck className="h-3 w-3" /> 관리자 설정
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  size="sm" 
                  variant={isCompleted ? "default" : "outline"}
                  className={cn("h-8 text-[11px] font-bold", isCompleted && "bg-emerald-600 hover:bg-emerald-700")}
                  onClick={() => handleUpdateStatus('이수')}
                  disabled={isUpdating || isCompleted}
                >
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> 이수 처리
                </Button>
                <Button 
                  size="sm" 
                  variant={!isCompleted ? "default" : "outline"}
                  className={cn("h-8 text-[11px] font-bold", !isCompleted && "bg-rose-600 hover:bg-rose-700")}
                  onClick={() => handleUpdateStatus('미이수')}
                  disabled={isUpdating || !isCompleted}
                >
                  <XCircle className="mr-1 h-3.5 w-3.5" /> 미이수 처리
                </Button>
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t">
              <p className="text-[10px] text-slate-400 text-center italic">
                * 이수 여부 수정은 관리자만 가능합니다.
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
