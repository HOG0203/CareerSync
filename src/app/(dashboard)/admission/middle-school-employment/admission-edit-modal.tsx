'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { StudentEmploymentData } from '@/lib/data';
import { updateStudentAdmissionAction } from './actions';
import { School, Check, Loader2 } from 'lucide-react';

interface AdmissionEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentEmploymentData | null;
  onSuccess: () => void;
  existingMiddleSchools?: string[];
}

export function AdmissionEditModal({
  isOpen,
  onClose,
  student,
  onSuccess,
  existingMiddleSchools = [],
}: AdmissionEditModalProps) {
  const { toast } = useToast();
  const [middleSchool, setMiddleSchool] = React.useState('');
  const [admissionRankPercentile, setAdmissionRankPercentile] = React.useState('');
  const [admissionType, setAdmissionType] = React.useState('일반전형');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (student) {
      setMiddleSchool(student.middle_school || '');
      setAdmissionRankPercentile(student.admission_rank_percentile !== undefined && student.admission_rank_percentile !== null ? String(student.admission_rank_percentile) : '');
      setAdmissionType(student.admission_type || '일반전형');
    }
  }, [student]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    setIsSubmitting(true);
    try {
      const rankNum = admissionRankPercentile.trim() ? parseFloat(admissionRankPercentile) : null;

      const res = await updateStudentAdmissionAction(student.id, {
        middle_school: middleSchool.trim() || null,
        admission_rank_percentile: isNaN(rankNum as any) ? null : rankNum,
        admission_type: admissionType.trim() || null,
      });

      if (res.success) {
        toast({
          title: '저장 완료',
          description: `${student.student_name} 학생의 입학 및 출신 중학교 정보가 업데이트되었습니다.`,
        });
        onSuccess();
        onClose();
      } else {
        toast({
          variant: 'destructive',
          title: '저장 실패',
          description: res.error || '저장 중 오류가 발생했습니다.',
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: err?.message || '네트워크 오류가 발생했습니다.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="p-5 bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
              <School className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                입학 정보 및 출신교 수정
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                {student?.student_name} ({student?.student_number || student?.class_info || student?.major})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4 bg-slate-50/50 text-xs">
            {/* 출신 중학교 입력 */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">출신 중학교</Label>
              <Input
                placeholder="예: 옥천중학교"
                value={middleSchool}
                onChange={(e) => setMiddleSchool(e.target.value)}
                className="h-9 text-xs bg-white border-slate-200"
                list="middle-school-suggestions"
              />
              <datalist id="middle-school-suggestions">
                {existingMiddleSchools.map((sch) => (
                  <option key={sch} value={sch} />
                ))}
              </datalist>
            </div>

            {/* 입학 석차 백분율 */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">입학 석차 백분율 (%)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="예: 15.4"
                value={admissionRankPercentile}
                onChange={(e) => setAdmissionRankPercentile(e.target.value)}
                className="h-9 text-xs bg-white border-slate-200"
              />
            </div>

            {/* 입학 전형 구분 */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">전형 구분</Label>
              <Select value={admissionType} onValueChange={setAdmissionType}>
                <SelectTrigger className="h-9 text-xs bg-white border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="일반전형" className="text-xs">일반전형</SelectItem>
                  <SelectItem value="특별전형" className="text-xs">특별전형</SelectItem>
                  <SelectItem value="특성화고특별전형" className="text-xs">특성화고특별전형</SelectItem>
                  <SelectItem value="취업희망자전형" className="text-xs">취업희망자전형</SelectItem>
                  <SelectItem value="정원외" className="text-xs">정원외전형</SelectItem>
                  <SelectItem value="기타" className="text-xs">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="p-4 bg-white border-t border-slate-100 flex flex-row items-center justify-between gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs font-bold border-slate-200"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-sm px-5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  저장
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
