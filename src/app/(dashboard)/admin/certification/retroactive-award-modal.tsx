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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FullStudentEvaluation, CertificationRank, getDefaultPrizeName } from '@/lib/certification-calculator';
import { recordPastRewardAction } from './actions';
import { useToast } from '@/hooks/use-toast';
import { History, Gift, Trophy, CheckCircle2, User } from 'lucide-react';

interface RetroactiveAwardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetStudent: FullStudentEvaluation | null;
  evaluations: FullStudentEvaluation[];
  academicYear: number;
  grade: number;
  onSuccess: () => Promise<void>;
}

export function RetroactiveAwardModal({
  open,
  onOpenChange,
  targetStudent,
  evaluations,
  academicYear,
  grade,
  onSuccess,
}: RetroactiveAwardModalProps) {
  const { toast } = useToast();

  const [selectedStudentId, setSelectedStudentId] = React.useState<string>('');
  const [rewardType, setRewardType] = React.useState<'prize' | 'certificate_award'>('prize');
  const [rank, setRank] = React.useState<CertificationRank>('C');
  const [itemName, setItemName] = React.useState<string>('');
  const [awardedDate, setAwardedDate] = React.useState<string>(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = React.useState<string>('과거 오프라인 지급 이력 소급 등록');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [studentSearch, setStudentSearch] = React.useState('');
  const [selectedClass, setSelectedClass] = React.useState<string>('all');

  // targetStudent가 변경될 때마다 폼 동기화
  React.useEffect(() => {
    if (targetStudent) {
      setSelectedStudentId(targetStudent.studentId);
      const defaultRank = (targetStudent.rank !== 'D' ? targetStudent.rank : 'C') as CertificationRank;
      setRank(defaultRank);
      setItemName(getDefaultPrizeName(defaultRank));
    } else {
      setSelectedStudentId('');
      setRank('C');
      setItemName(getDefaultPrizeName('C'));
    }
  }, [targetStudent, open]);

  // 학반 목록 추출
  const availableClasses = React.useMemo(() => {
    const set = new Set<string>();
    evaluations.forEach(e => {
      const c = String(e.classInfo || '').trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')));
  }, [evaluations]);

  // 등급 변경 시 추천 상품명 자동 세팅
  const handleRankChange = (newRank: CertificationRank) => {
    setRank(newRank);
    if (rewardType === 'prize') {
      setItemName(getDefaultPrizeName(newRank));
    }
  };

  // 포상 유형 변경 시 품목명 세팅
  const handleTypeChange = (type: 'prize' | 'certificate_award') => {
    setRewardType(type);
    if (type === 'certificate_award') {
      setItemName('옥저인재인증상');
    } else {
      setItemName(getDefaultPrizeName(rank));
    }
  };

  // 학생 필터링 (반 필터 + 검색어)
  const filteredStudents = React.useMemo(() => {
    let list = evaluations;
    if (selectedClass !== 'all') {
      list = list.filter(s => String(s.classInfo || '').trim() === selectedClass);
    }
    if (!studentSearch.trim()) return list;

    const q = studentSearch.trim().toLowerCase();
    return list.filter(s =>
      s.studentName.toLowerCase().includes(q) ||
      s.studentNumber.includes(q) ||
      s.major.toLowerCase().includes(q) ||
      s.classInfo.includes(q)
    );
  }, [evaluations, selectedClass, studentSearch]);

  const activeStudent = evaluations.find(e => e.studentId === selectedStudentId) || targetStudent;

  const handleSubmit = async () => {
    if (!selectedStudentId) {
      toast({ title: '학생 선택 필요', description: '소급 등록할 대상 학생을 선택해주세요.', variant: 'destructive' });
      return;
    }
    if (!itemName.trim()) {
      toast({ title: '품목명 필요', description: '지급 품목명 또는 상장명을 입력해주세요.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await recordPastRewardAction({
        studentId: selectedStudentId,
        rewardType,
        academicYear,
        certifiedRank: rank,
        itemName: itemName.trim(),
        awardedDate: awardedDate || undefined,
        remarks: remarks.trim() || undefined,
        gradeNum: grade,
      });

      if (!res.success) {
        toast({ title: '소급 등록 실패', description: res.error || '오류가 발생했습니다.', variant: 'destructive' });
      } else {
        toast({
          title: '✅ 과거 수령 이력 소급 등록 완료',
          description: `${activeStudent?.studentName || ''} 학생의 ${itemName} 수령 기록이 등록되었습니다.`,
        });
        onOpenChange(false);
        await onSuccess();
      }
    } catch (err: any) {
      toast({ title: '오류 발생', description: err?.message || '처리 중 오류가 발생했습니다.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[94vw] rounded-2xl p-5 bg-white shadow-xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <History className="h-4 w-4" />
            </div>
            <span>과거 수령 이력 개별 소급 등록</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            과거 오프라인으로 이미 지급했던 등급별 상품이나 인증상을 시스템에 등록하여 이력을 동기화합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2 text-xs">
          {/* 학생 선택 */}
          {targetStudent ? (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-400 block font-medium">대상 학생</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-black text-slate-900">
                  {targetStudent.studentName}
                </span>
                <span className="text-xs font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  {targetStudent.currentGrade}학년 {targetStudent.major} {targetStudent.classInfo}반 {targetStudent.studentNumber}번
                </span>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                  현재 {targetStudent.rank}등급
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">대상 학생 검색 및 선택 (학년·학과·반·번호·성명)</Label>
              <div className="flex gap-1.5 mb-1">
                {/* 반 선택 필터 */}
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="h-8 w-24 text-xs rounded-lg shrink-0 bg-slate-50">
                    <SelectValue placeholder="전체 반" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">전체 반</SelectItem>
                    {availableClasses.map(c => (
                      <SelectItem key={c} value={c} className="text-xs">{c}반</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* 검색 인풋 */}
                <Input
                  placeholder="학과, 번호, 성명 검색 (예: 5번, 홍길동, 스마트)..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="h-8 text-xs rounded-lg flex-1"
                />
              </div>

              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="학생을 선택하세요" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {filteredStudents.length === 0 ? (
                    <div className="py-3 text-center text-xs text-slate-400">검색 조건에 맞는 학생이 없습니다.</div>
                  ) : (
                    filteredStudents.map(s => (
                      <SelectItem key={s.studentId} value={s.studentId} className="text-xs">
                        <span className="font-bold text-slate-900">{s.studentName}</span>
                        <span className="text-slate-500 font-normal ml-1.5">
                          ({s.currentGrade}학년 {s.major} {s.classInfo}반 {s.studentNumber}번)
                        </span>
                        <span className="text-indigo-600 font-bold ml-1.5">[{s.rank}등급]</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 포상 구분 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">지급 구분</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={rewardType === 'prize' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTypeChange('prize')}
                className={`h-9 text-xs font-bold rounded-xl gap-1.5 justify-center ${
                  rewardType === 'prize' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-slate-700'
                }`}
              >
                <Gift className="h-3.5 w-3.5" />
                <span>등급별 상품</span>
              </Button>
              <Button
                type="button"
                variant={rewardType === 'certificate_award' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTypeChange('certificate_award')}
                className={`h-9 text-xs font-bold rounded-xl gap-1.5 justify-center ${
                  rewardType === 'certificate_award' ? 'bg-amber-500 text-white shadow-xs' : 'bg-white text-slate-700'
                }`}
              >
                <Trophy className="h-3.5 w-3.5" />
                <span>옥저인재인증상</span>
              </Button>
            </div>
          </div>

          {/* 등급 선택 (상품일 경우) */}
          {rewardType === 'prize' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">과거 지급 당시 수령 등급</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['S', 'A', 'B', 'C'] as CertificationRank[]).map(r => (
                  <Button
                    key={r}
                    type="button"
                    variant={rank === r ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleRankChange(r)}
                    className={`h-8 text-xs font-extrabold rounded-lg ${
                      rank === r ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'
                    }`}
                  >
                    {r}등급
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* 품목명 */}
          <div className="space-y-1.5">
            <Label htmlFor="item-name" className="text-xs font-bold text-slate-700">
              지급 품목명 / 상장 명칭
            </Label>
            <Input
              id="item-name"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="예: 문화상품권 1만원, 보조배터리..."
              className="h-9 text-xs rounded-xl"
            />
          </div>

          {/* 지급일자 및 비고 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="awarded-date" className="text-xs font-bold text-slate-700">
                실제 지급 일자
              </Label>
              <Input
                id="awarded-date"
                type="date"
                value={awardedDate}
                onChange={(e) => setAwardedDate(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="remarks" className="text-xs font-bold text-slate-700">
                비고
              </Label>
              <Input
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="예: 2025년 2학기 지급분"
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] leading-relaxed space-y-1">
            <div>
              💡 <strong>소급 등록 효과</strong>: 과거 {rank}등급 상품을 소급 등록하면, 현재 점수가 더 높은 상위 등급에 도달한 학생의 경우 시스템이 <em>'승급 대상자'</em>로 안전하게 자동 판별합니다.
            </div>
            <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200/60 flex items-center gap-1">
              <span>💾 <strong>DB 저장 안내</strong>:</span>
              <span>수령등급, 품목명, 지급일자, 비고 및 등록 스냅샷이 DB에 영구 보존됩니다.</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
            className="text-xs font-semibold rounded-xl"
          >
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isSubmitting || !selectedStudentId || !itemName.trim()}
            onClick={handleSubmit}
            className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs"
          >
            {isSubmitting ? '소급 등록 중...' : '소급 등록 완료'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
