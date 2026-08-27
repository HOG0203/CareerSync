'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  ShieldAlert, 
  Trash2, 
  Calendar, 
  User, 
  Clock, 
  Award,
  Loader2,
  FileText
} from 'lucide-react';
import { 
  StudentMeritDemeritSummary, 
  MeritDemeritRecord, 
  getStudentMeritDemeritHistory,
  deleteMeritDemeritRecordAction
} from './actions';
import { useToast } from '@/hooks/use-toast';
import { cn, formatStudentClassTag } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentMeritDemeritSummary | null;
  onRecordDeleted: () => void;
}

export function HistoryModal({
  isOpen,
  onClose,
  student,
  onRecordDeleted,
}: HistoryModalProps) {
  const [records, setRecords] = React.useState<MeritDemeritRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    if (isOpen && student) {
      setLoading(true);
      getStudentMeritDemeritHistory(student.id)
        .then(data => {
          setRecords(data);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, student]);

  const handleDeleteRecord = async (recordId: string) => {
    if (!student) return;
    if (!window.confirm('이 상벌점 부여 기록을 삭제/취소하시겠습니까? (삭제 시 즉시 점수가 원상복구됩니다)')) {
      return;
    }

    setDeletingId(recordId);
    try {
      const res = await deleteMeritDemeritRecordAction(recordId, student.id, student.academic_year);
      if (res.success) {
        toast({ title: '기록 삭제 완료', description: '상벌점 기록이 성공적으로 취소되었습니다.' });
        setRecords(prev => prev.filter(r => r.id !== recordId));
        onRecordDeleted();
      } else {
        toast({ variant: 'destructive', title: '삭제 실패', description: res.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: '오류 발생', description: err.message });
    } finally {
      setDeletingId(null);
    }
  };

  if (!student) return null;

  const totalMerit = records.filter(r => r.type === 'merit').reduce((sum, r) => sum + r.points, 0);
  const totalDemerit = records.filter(r => r.type === 'demerit').reduce((sum, r) => sum + r.points, 0);
  const net = totalMerit - totalDemerit;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-[620px] max-h-[92vh] p-0 flex flex-col overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl">
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b bg-slate-50/80 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                {student.student_name} ({formatStudentClassTag(student)}) 학생 상벌점 이력
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-medium mt-0.5">
                {student.major} {student.class_info}반 {student.student_number ? `${student.student_number}번` : ''}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* 상단 통계 요약 배너 */}
        <div className="p-3 sm:p-4 bg-slate-100/70 border-b flex items-center justify-around gap-1 sm:gap-2 text-center shrink-0">
          <div className="flex flex-col items-center">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500">총 상점</span>
            <span className="text-base sm:text-lg font-black text-emerald-600">+{totalMerit}점</span>
          </div>
          <div className="h-7 w-px bg-slate-200" />
          <div className="flex flex-col items-center">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500">총 벌점</span>
            <span className="text-base sm:text-lg font-black text-rose-600">-{totalDemerit}점</span>
          </div>
          <div className="h-7 w-px bg-slate-200" />
          <div className="flex flex-col items-center">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500">누계 점수</span>
            <span className={cn("text-base sm:text-lg font-black", net >= 0 ? "text-indigo-600" : "text-rose-600")}>
              {net > 0 ? `+${net}` : net}점
            </span>
          </div>
          <div className="h-7 w-px bg-slate-200" />
          <div className="flex flex-col items-center">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500">총 기록</span>
            <span className="text-base sm:text-lg font-black text-slate-800">{records.length}건</span>
          </div>
        </div>

        {/* 이력 목록 */}
        <div className="p-3 sm:p-5 flex-1 overflow-y-auto space-y-2.5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              <span className="text-xs font-medium">상벌점 이력을 불러오는 중...</span>
            </div>
          ) : records.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 font-medium">
              부여된 상벌점 이력이 없습니다.
            </div>
          ) : (
            records.map((r) => (
              <div 
                key={r.id}
                className={cn(
                  "p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all",
                  r.type === 'merit' ? "bg-emerald-50/40 border-emerald-100" : "bg-rose-50/40 border-rose-100"
                )}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0",
                        r.type === 'merit' ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-rose-100 text-rose-800 border-rose-300"
                      )}
                    >
                      {r.type === 'merit' ? `🌟 상점 +${r.points}점` : `⚠️ 벌점 -${r.points}점`}
                    </Badge>
                    <span className="text-xs font-extrabold text-slate-900 truncate">{r.rule_name}</span>
                  </div>
                  {r.memo && (
                    <p className="text-xs text-slate-600 font-medium pl-1 bg-white/70 p-1.5 rounded-md border border-slate-200/60">
                      💬 {r.memo}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-[10.5px] text-slate-400 font-medium pt-0.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {r.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      부여 교사: {r.granted_by?.userName || '교사'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={deletingId === r.id}
                    onClick={() => handleDeleteRecord(r.id)}
                    className="h-8 px-2.5 text-xs font-bold text-rose-600 hover:bg-rose-100/70 hover:text-rose-700 rounded-lg gap-1"
                  >
                    {deletingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    <span>취소/삭제</span>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3.5 bg-slate-50 border-t flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-8.5 px-4 rounded-xl text-xs font-bold text-slate-600 border-slate-200 bg-white"
          >
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}