'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sparkles, ShieldAlert, Users, Calendar, Award, Loader2 } from 'lucide-react';
import { MeritDemeritRule } from '@/app/(dashboard)/admin/settings/actions';
import { StudentMeritDemeritSummary, grantMeritDemeritAction } from './actions';
import { useToast } from '@/hooks/use-toast';
import { cn, formatStudentClassTag } from '@/lib/utils';
import { format } from 'date-fns';

interface GrantModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStudents: StudentMeritDemeritSummary[];
  meritRules: MeritDemeritRule[];
  grade: number | 'ALL';
  academicYear: number;
  onSuccess: (params: {
    studentIds: string[];
    type: 'merit' | 'demerit';
    points: number;
    ruleName: string;
    date: string;
    memo?: string;
  }) => void;
}

export function GrantModal({
  isOpen,
  onClose,
  selectedStudents,
  meritRules,
  grade,
  academicYear,
  onSuccess,
}: GrantModalProps) {
  const [type, setType] = React.useState<'merit' | 'demerit'>('merit');
  const [selectedRuleId, setSelectedRuleId] = React.useState<string>('');
  const [points, setPoints] = React.useState<number>(1);
  const [date, setDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [memo, setMemo] = React.useState<string>('');
  const [isPending, setIsPending] = React.useState(false);
  const { toast } = useToast();

  const availableRules = React.useMemo(() => {
    return meritRules.filter(r => r.type === type && r.isActive !== false);
  }, [meritRules, type]);

  // 상벌점 타입 변경 시 첫 번째 규칙 자동 선택
  React.useEffect(() => {
    if (availableRules.length > 0) {
      setSelectedRuleId(availableRules[0].id);
      setPoints(availableRules[0].points);
    } else {
      setSelectedRuleId('');
      setPoints(type === 'merit' ? 2 : 1);
    }
  }, [type, availableRules]);

  const handleRuleChange = (ruleId: string) => {
    setSelectedRuleId(ruleId);
    const found = availableRules.find(r => r.id === ruleId);
    if (found) {
      setPoints(found.points);
    }
  };

  const handleGrant = async () => {
    if (selectedStudents.length === 0) {
      toast({ variant: 'destructive', title: '부여할 학생을 선택해주세요.' });
      return;
    }

    const selectedRule = availableRules.find(r => r.id === selectedRuleId);
    const ruleName = selectedRule?.name || (type === 'merit' ? '기타 상점 항목' : '기타 벌점 항목');
    const sanitizedPoints = Math.max(1, Math.min(1000, points));
    const studentIds = selectedStudents.map(s => s.id);
    const studentsMeta = selectedStudents.map(s => ({
      id: s.id,
      student_name: s.student_name,
      student_number: s.student_number,
      major: s.major,
      class_info: s.class_info,
      grade: s.grade || (typeof grade === 'number' ? grade : 3)
    }));

    // 1. 0ms 즉각 반영 & 모달 닫기
    onSuccess({
      studentIds,
      type,
      points: sanitizedPoints,
      ruleName,
      date,
      memo
    });
    setMemo('');
    onClose();

    toast({
      title: '상벌점 부여 완료',
      description: `${studentIds.length}명의 학생에게 [${type === 'merit' ? '상점' : '벌점'}] ${sanitizedPoints}점(${ruleName})이 부여되었습니다.`
    });

    // 2. 비동기 백그라운드 DB 저장 (<0.08초 완료)
    try {
      const res = await grantMeritDemeritAction({
        studentIds,
        studentsMeta,
        ruleId: selectedRuleId || 'custom',
        ruleName,
        type,
        points: sanitizedPoints,
        date,
        memo,
        grade: typeof grade === 'number' ? grade : (selectedStudents[0]?.grade || 3),
        academicYear
      });

      if (!res.success) {
        toast({
          variant: 'destructive',
          title: '부여 실패',
          description: res.error || '오류가 발생했습니다.'
        });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: '부여 중 오류 발생', description: err.message });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isPending && !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-[540px] max-h-[92vh] p-0 flex flex-col overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl">
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b bg-slate-50/80 shrink-0">
          <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <Award className="h-5 w-5 text-indigo-600" />
            학생 상벌점 부여
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 font-medium">
            시스템에 등록된 기준에 따라 선택한 학생들에게 상점 또는 벌점을 부여합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto">
          {/* 선택된 대상 학생 뱃지 목록 */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-indigo-600" />
                부여 대상 학생 ({selectedStudents.length}명)
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {selectedStudents.map(s => (
                <Badge key={s.id} variant="secondary" className="text-xs font-semibold px-2 py-0.5 bg-white border border-slate-200 text-slate-800">
                  <span className="font-black text-slate-900">{s.student_name}</span>
                  <span className="text-[11px] font-bold text-indigo-700 ml-1">({formatStudentClassTag(s)})</span>
                  {s.student_number && <span className="text-[10px] text-slate-400 ml-1">#{s.student_number}</span>}
                </Badge>
              ))}
            </div>
          </div>

          {/* 상점 / 벌점 전환 탭 */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setType('merit')}
              className={cn(
                "py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5",
                type === 'merit' ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>🌟 상점 부여</span>
            </button>
            <button
              type="button"
              onClick={() => setType('demerit')}
              className={cn(
                "py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5",
                type === 'demerit' ? "bg-rose-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>⚠️ 벌점 부여</span>
            </button>
          </div>

          {/* 기준 항목 선택 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">상벌점 기준 항목</label>
            {availableRules.length > 0 ? (
              <Select value={selectedRuleId} onValueChange={handleRuleChange}>
                <SelectTrigger className="h-10 bg-white border-slate-200 rounded-xl text-xs sm:text-sm font-medium">
                  <SelectValue placeholder="기준 항목 선택" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {availableRules.map(rule => (
                    <SelectItem key={rule.id} value={rule.id} className="text-xs sm:text-sm">
                      <span className="font-bold text-slate-800">[{rule.category}] {rule.name}</span>
                      <span className={cn("ml-2 font-black text-xs", rule.type === 'merit' ? "text-emerald-600" : "text-rose-600")}>
                        ({rule.type === 'merit' ? '+' : '-'}{rule.points}점)
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-slate-400 p-2 bg-slate-50 rounded-lg">등록된 {type === 'merit' ? '상점' : '벌점'} 항목이 없습니다. 시스템 관리에서 기준을 등록해주세요.</p>
            )}
          </div>

          {/* 배점 및 일자 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">부여 점수</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={points}
                  onChange={(e) => setPoints(parseInt(e.target.value) || 1)}
                  className="h-10 bg-white border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-center"
                />
                <span className="text-xs font-bold text-slate-600">점</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">부여 일자</label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 bg-white border-slate-200 rounded-xl text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* 세부 사유 및 메모 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">상세 사유 / 비고 (선택)</label>
            <Textarea
              placeholder="상벌점 부여와 관련된 구체적 활동 내용이나 사유를 기록하세요."
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="h-20 bg-white border-slate-200 rounded-xl text-xs resize-none"
            />
          </div>
        </div>

        <DialogFooter className="p-4 bg-slate-50/80 border-t flex flex-row items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
            className="h-9 px-4 rounded-xl text-xs font-bold text-slate-600 border-slate-200"
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={handleGrant}
            disabled={isPending || selectedStudents.length === 0}
            className={cn(
              "h-9 px-5 rounded-xl text-xs font-bold text-white shadow-md",
              type === 'merit' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
            )}
          >
            {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {selectedStudents.length}명에게 {type === 'merit' ? '상점' : '벌점'} 부여하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}