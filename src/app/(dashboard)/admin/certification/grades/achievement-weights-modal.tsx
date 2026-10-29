'use client';

import * as React from 'react';
import { Settings, Loader2, Sparkles } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { updateAchievementScores } from '@/app/(dashboard)/admin/grades/actions';

interface AchievementWeightsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialWeights?: Record<string, number>;
  onSuccess?: () => void;
}

export function AchievementWeightsModal({
  isOpen,
  onOpenChange,
  initialWeights = {},
  onSuccess
}: AchievementWeightsModalProps) {
  const { toast } = useToast();
  const [weights, setWeights] = React.useState<Record<string, number>>({
    A: 5,
    B: 4,
    C: 3,
    D: 2,
    E: 1,
    ...initialWeights
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setWeights({
        A: 5,
        B: 4,
        C: 3,
        D: 2,
        E: 1,
        ...initialWeights
      });
    }
  }, [isOpen, initialWeights]);

  const handleWeightChange = (grade: string, val: string) => {
    const num = parseFloat(val);
    setWeights(prev => ({
      ...prev,
      [grade]: isNaN(num) ? 0 : num
    }));
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const res = await updateAchievementScores(weights);
      if (res.success) {
        toast({
          title: '성취도 배점 설정 완료',
          description: '교과 성취도별 배점 기준이 성공적으로 저장되었습니다.'
        });
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast({
          variant: 'destructive',
          title: '저장 실패',
          description: res.error || '성취도 배점을 저장하지 못했습니다.'
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: err.message || '저장 도중 오류가 발생했습니다.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const grades = ['A', 'B', 'C', 'D', 'E'];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] rounded-2xl p-6">
        <DialogHeader className="space-y-1.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1">
            <Settings className="h-5 w-5" />
          </div>
          <DialogTitle className="text-lg font-black text-slate-800 tracking-tight">
            교과 성취도별 배점 기준 설정
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 leading-relaxed">
            옥저인증제 교과 성적 영역 환산 시 적용되는 성취도별(A~E) 기본 배점을 설정합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 space-y-3">
          <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs text-indigo-900 flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              배점 저장 시 전교생의 교과 성취도 환산 점수 및 석차가 실시간으로 재계산되어 반영됩니다.
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2 pt-1">
            {grades.map(grade => (
              <div 
                key={grade} 
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 shadow-2xs"
              >
                <span className="font-black text-sm text-slate-800">{grade}</span>
                <Input
                  type="number"
                  step="0.5"
                  className="h-9 text-center font-black text-indigo-700 bg-white px-1 rounded-lg text-sm"
                  value={weights[grade] ?? 0}
                  onChange={(e) => handleWeightChange(grade, e.target.value)}
                />
                <span className="text-[10px] text-slate-400 font-bold">점</span>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs font-bold"
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting}
            className="rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
          >
            {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            배점 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
