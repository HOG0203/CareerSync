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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FullStudentEvaluation } from '@/lib/certification-calculator';
import { getStudentRecipientInfo } from '@/lib/cert-reward-excel-generator';
import { exportRewardLedgerExcelAction } from './actions';
import { useToast } from '@/hooks/use-toast';
import { FileSpreadsheet, Calendar, Users, Filter, Download, CheckCircle2, AlertCircle } from 'lucide-react';

const TARGET_MAJOR_ORDER = [
  '자동화기계과',
  '친환경자동차과',
  '건설과',
  '스마트공간건축과',
  '스마트공간과',
  '스마트전기과',
  '바이오화학과',
  '스마트융합섬유과',
  '스마트융함섬유과',
];

interface RewardLedgerExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  academicYear: number;
  semester?: number;
  grade: number;
  evaluations: FullStudentEvaluation[];
  classes?: string[];
  initialAwardedDate?: string;
}

export function RewardLedgerExportModal({
  open,
  onOpenChange,
  academicYear,
  semester,
  grade,
  evaluations,
  initialAwardedDate,
}: RewardLedgerExportModalProps) {
  const { toast } = useToast();

  // 확정일자별 인원수 및 목록 집계 (최신순 정렬)
  const dateOptions = React.useMemo(() => {
    const map = new Map<string, Set<string>>();
    evaluations.forEach(e => {
      (e.rewardsHistory || []).forEach(r => {
        if (r.status !== 'cancelled' && r.awardedDate) {
          if (!map.has(r.awardedDate)) {
            map.set(r.awardedDate, new Set());
          }
          map.get(r.awardedDate)!.add(e.studentId);
        }
      });
    });

    const list = Array.from(map.entries())
      .map(([date, students]) => ({
        date,
        count: students.size,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return list;
  }, [evaluations]);

  // 학과-학반별 고유 목록 집계 (예: "자동화기계과 1반", "친환경자동차과 1반" 등)
  const departmentClassOptions = React.useMemo(() => {
    const classMap = new Map<string, { count: number; major: string; num: number }>();

    evaluations.forEach(student => {
      const major = (student.major || '기타학과').trim();
      const rawClass = (student.classInfo || '1반').trim();
      const cleanClass = rawClass.includes('반') ? rawClass : `${rawClass}반`;
      const classKey = `${major} ${cleanClass}`;
      const num = parseInt(cleanClass.replace(/[^0-9]/g, ''), 10) || 0;

      if (!classMap.has(classKey)) {
        classMap.set(classKey, { count: 0, major, num });
      }
      classMap.get(classKey)!.count++;
    });

    return Array.from(classMap.entries())
      .map(([key, info]) => ({
        key,
        major: info.major,
        num: info.num,
        count: info.count,
      }))
      .sort((a, b) => {
        const idxA = TARGET_MAJOR_ORDER.findIndex(m => a.major.includes(m) || m.includes(a.major));
        const idxB = TARGET_MAJOR_ORDER.findIndex(m => b.major.includes(m) || m.includes(b.major));

        if (idxA !== -1 && idxB !== -1 && idxA !== idxB) {
          return idxA - idxB;
        }
        if (idxA !== -1 && idxB === -1) return -1;
        if (idxA === -1 && idxB !== -1) return 1;

        if (a.major !== b.major) {
          return a.major.localeCompare(b.major, 'ko');
        }

        return a.num - b.num;
      });
  }, [evaluations]);

  // 선택 상태
  const [selectedDate, setSelectedDate] = React.useState<string>(initialAwardedDate || 'all');
  const [onlyAwarded, setOnlyAwarded] = React.useState<boolean>(true);
  const [selectedClass, setSelectedClass] = React.useState<string>('all');
  const [isDownloading, setIsDownloading] = React.useState<boolean>(false);

  // 모달이 열리거나 initialAwardedDate가 변경될 때 기본값 세팅
  React.useEffect(() => {
    if (open) {
      if (initialAwardedDate) {
        setSelectedDate(initialAwardedDate);
      } else if (dateOptions.length > 0) {
        setSelectedDate(dateOptions[0].date);
      } else {
        setSelectedDate('all');
      }
      setOnlyAwarded(true);
      setSelectedClass('all');
    }
  }, [open, initialAwardedDate, dateOptions]);

  // 현재 필터 조건에 따른 예상 수령 대상자 수 실시간 집계
  const previewCount = React.useMemo(() => {
    let filteredStudents = evaluations;
    if (selectedClass !== 'all') {
      filteredStudents = filteredStudents.filter(s => {
        const major = (s.major || '기타학과').trim();
        const rawClass = (s.classInfo || '1반').trim();
        const cleanClass = rawClass.includes('반') ? rawClass : `${rawClass}반`;
        const classKey = `${major} ${cleanClass}`;
        return classKey === selectedClass;
      });
    }

    const count = filteredStudents.filter(s => {
      const info = getStudentRecipientInfo(s, academicYear, semester, {
        targetAwardedDate: selectedDate,
        onlyAwarded,
      });
      return info.isRecipient;
    }).length;

    return count;
  }, [evaluations, academicYear, semester, selectedDate, onlyAwarded, selectedClass]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const res = await exportRewardLedgerExcelAction({
        academicYear,
        semester,
        grade,
        selectedClass,
        targetAwardedDate: selectedDate,
        onlyAwarded,
      });

      if (!res.success || !res.data) {
        toast({
          title: '엑셀 생성 실패',
          description: res.error || '오류가 발생했습니다.',
          variant: 'destructive',
        });
        return;
      }

      // Base64 to Blob 다운로드
      const byteCharacters = atob(res.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const datePart = selectedDate !== 'all' ? `_${selectedDate}` : '';
      const classPart = selectedClass !== 'all' ? `_${selectedClass}` : '';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = res.fileName || `${academicYear}학년도_${grade}학년_옥저인재인증_수령대장${classPart}${datePart}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: '📄 공문서 수령 대장 다운로드 완료',
        description: `${selectedDate !== 'all' ? `${selectedDate} 확정 건 ` : ''}${selectedClass !== 'all' ? `[${selectedClass}] ` : ''}A4 규격 수령 대장 엑셀이 다운로드되었습니다.`,
      });

      onOpenChange(false);
    } catch (err: any) {
      console.error('Download ledger error:', err);
      toast({
        title: '다운로드 오류',
        description: err?.message || '처리 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[94vw] rounded-2xl p-5 sm:p-6 bg-white shadow-xl">
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
            <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-xl shadow-2xs">
              <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
            </div>
            <span>공문서 수령 대장 엑셀 내보내기</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 font-medium">
            행정실 제출 및 공문서 첨부 규격의 A4 수령 대장을 확정일자 및 학과·학반별로 선택하여 다운로드합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 1. 확정 일자 선택 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-indigo-600" />
              <span>확정 일자 선택</span>
            </Label>
            <Select value={selectedDate} onValueChange={setSelectedDate}>
              <SelectTrigger className="w-full text-xs font-bold h-9 rounded-xl border-slate-200">
                <SelectValue placeholder="확정 일자를 선택하세요" />
              </SelectTrigger>
              <SelectContent className="max-h-60 rounded-xl shadow-lg border-slate-200">
                <SelectItem value="all" className="text-xs font-bold py-2">
                  <span>📅 전체 확정 내역 (누적 합산)</span>
                </SelectItem>
                {dateOptions.map(opt => (
                  <SelectItem key={opt.date} value={opt.date} className="text-xs py-2">
                    <span className="font-bold text-slate-800">{opt.date}</span>
                    <span className="ml-2 text-[11px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">
                      {opt.count}명 확정
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-400">
              특정 일자에 일괄 확정된 건만 분리하여 기안할 때 해당 일자를 선택하세요.
            </p>
          </div>

          {/* 2. 대상 범위 선택 (라디오) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-indigo-600" />
              <span>수령 대상자 범위</span>
            </Label>
            <RadioGroup
              value={onlyAwarded ? 'awarded' : 'all'}
              onValueChange={(val) => setOnlyAwarded(val === 'awarded')}
              className="grid grid-cols-1 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="awarded" id="scope-awarded" />
                <Label htmlFor="scope-awarded" className="text-xs font-bold text-slate-800 cursor-pointer">
                  <span>확정 완료자만 출력 (공문서·행정실 제출용, 권장)</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="scope-all" />
                <Label htmlFor="scope-all" className="text-xs font-medium text-slate-600 cursor-pointer">
                  <span>수령 예정자(미확정 자격자) 포함 (사전 예산·품의용)</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* 3. 학과 및 학반 선택 */}
          {departmentClassOptions.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-indigo-600" />
                <span>출력 학급 구분 (학과·반)</span>
              </Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="w-full text-xs font-bold h-9 rounded-xl border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60 rounded-xl shadow-lg border-slate-200">
                  <SelectItem value="all" className="text-xs font-bold py-2">
                    <span>전체 학급 (총괄 요약 시트 + 전체 학반별 시트)</span>
                  </SelectItem>
                  {departmentClassOptions.map(c => (
                    <SelectItem key={c.key} value={c.key} className="text-xs py-2">
                      <span className="font-bold text-slate-800">{grade}학년 {c.key}</span>
                      <span className="ml-2 text-[10px] text-slate-500 font-medium">({c.count}명)</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 4. 대상 인원 미리보기 요약 카드 */}
          <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0" />
              <span className="text-xs font-bold text-indigo-950">
                선택된 조건의 실제 수령 대상자:
              </span>
            </div>
            <span className="text-sm font-black text-indigo-700">
              {previewCount}명
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 text-xs font-bold text-slate-600 rounded-xl"
            disabled={isDownloading}
          >
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleDownload}
            disabled={isDownloading || previewCount === 0}
            className="h-9 px-4 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-1.5 shadow-md shadow-indigo-600/20"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{isDownloading ? '엑셀 생성 중...' : '대장 엑셀 다운로드'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
