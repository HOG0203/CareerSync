'use client';

import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { StudentEmploymentData } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { updateLaborEducationStatus } from '@/app/students/actions';
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

  const serverStatus = student.labor_education_status || '미이수';
  const [optimisticStatus, setOptimisticStatus] = React.useState<string | null>(null);

  // 서버 데이터 갱신 시 낙관적 상태 동기화
  React.useEffect(() => {
    setOptimisticStatus(null);
  }, [student.labor_education_status]);

  const currentStatus = optimisticStatus ?? serverStatus;
  const isCompleted = currentStatus === '이수';

  const handleUpdateStatus = async (newStatus: string) => {
    if (!isAdmin) return;
    if (newStatus === currentStatus) return;
    
    // 1. 클릭 즉시 0ms 화면 반영 (초고속 낙관적 UI)
    const prevStatus = currentStatus;
    setOptimisticStatus(newStatus);
    setIsUpdating(true);

    try {
      // 2. 초경량 전용 DB 업데이트 실행
      const result = await updateLaborEducationStatus(student.id, newStatus);
      
      if (result.success) {
        toast({
          title: "이수 상태 변경 완료",
          description: `${student.student_name} 학생: [${newStatus}] 처리되었습니다.`,
        });
      } else {
        // 실패 시에만 원복
        setOptimisticStatus(prevStatus);
        toast({
          variant: "destructive",
          title: "업데이트 실패",
          description: result.error || "상태 변경 중 오류가 발생했습니다.",
        });
      }
    } catch (err: any) {
      setOptimisticStatus(prevStatus);
      toast({
        variant: "destructive",
        title: "오류 발생",
        description: err.message || "네트워크 오류가 발생했습니다.",
      });
    } finally {
      setIsUpdating(false);
    }
  };


  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "h-7 border-b flex items-center justify-between px-1 text-[10px] transition-all cursor-pointer relative select-none",
            isCompleted 
              ? "bg-emerald-500 text-white font-bold border-emerald-600/80 hover:bg-emerald-600" 
              : "bg-white text-slate-800 border-slate-200 hover:bg-slate-100/80"
          )}
        >
          <span className={cn("text-[8px] w-2.5 font-semibold", isCompleted ? "text-emerald-100" : "text-slate-400")}>
            {student.student_number || idx + 1}
          </span>
          <span className="flex-1 text-center font-medium truncate tracking-tighter">
            {student.student_name}
          </span>
        </div>
      </PopoverTrigger>
      <PopoverContent 
        side="right" 
        align="start"
        className="p-4 w-[250px] text-xs shadow-xl border border-slate-200/80 rounded-2xl bg-white z-[100]"
        sideOffset={6}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <span className="font-extrabold text-base text-slate-900">{student.student_name}</span>
            <span className={cn(
              "text-[10px] px-2.5 py-0.5 rounded-full font-bold shadow-2xs",
              isCompleted ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
            )}>
              {currentStatus}
            </span>
          </div>

          <div className="space-y-1.5 text-slate-600 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <p className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">학과</span> 
              <span className="font-bold text-slate-800">{student.major}</span>
            </p>
            <p className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">학반/번호</span> 
              <span className="font-bold text-slate-800">{student.class_info}반 {student.student_number}번</span>
            </p>
          </div>

          {isAdmin ? (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <p className="text-[11px] text-blue-600 font-bold flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> 이수 여부 관리
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  size="sm" 
                  variant={isCompleted ? "default" : "outline"}
                  className={cn("h-8 text-xs font-bold rounded-xl", isCompleted && "bg-emerald-600 hover:bg-emerald-700 text-white")}
                  onClick={() => handleUpdateStatus('이수')}
                  disabled={isUpdating || isCompleted}
                >
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> 이수
                </Button>
                <Button 
                  size="sm" 
                  variant={!isCompleted ? "default" : "outline"}
                  className={cn("h-8 text-xs font-bold rounded-xl", !isCompleted && "bg-rose-600 hover:bg-rose-700 text-white")}
                  onClick={() => handleUpdateStatus('미이수')}
                  disabled={isUpdating || !isCompleted}
                >
                  <XCircle className="mr-1 h-3.5 w-3.5" /> 미이수
                </Button>
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 text-center">
                * 이수 여부 변경은 관리자 권한이 필요합니다.
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

