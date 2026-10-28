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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FullStudentEvaluation, CertificationPrizeConfig } from '@/lib/certification-calculator';
import { bulkAwardItemsAction, exportRewardLedgerExcelAction } from './actions';
import { useToast } from '@/hooks/use-toast';
import { Zap, Gift, Trophy, CheckCircle2, AlertCircle, ShieldCheck, Download, FileSpreadsheet, Sparkles } from 'lucide-react';

interface GradeBulkAwardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grade: number;
  academicYear: number;
  semester?: number;
  evaluations: FullStudentEvaluation[];
  prizeConfig?: CertificationPrizeConfig;
  onSuccess: () => Promise<void>;
}

export function GradeBulkAwardModal({
  open,
  onOpenChange,
  grade,
  academicYear,
  semester,
  evaluations,
  prizeConfig,
  onSuccess,
}: GradeBulkAwardModalProps) {
  const { toast } = useToast();
  const [awardPrize, setAwardPrize] = React.useState(true);
  const [awardCert, setAwardCert] = React.useState(true);
  const [remarks, setRemarks] = React.useState('');
  const [isProcessing, setIsProcessing] = React.useState(false);

  // 확정 완료 후 다운로드 뷰 상태
  const [isSuccessView, setIsSuccessView] = React.useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = React.useState(false);
  const [successInfo, setSuccessInfo] = React.useState<{
    prizeSuccessCount: number;
    certSuccessCount: number;
    totalStudentsCount: number;
    awardedDate: string;
    studentIds: string[];
  } | null>(null);

  // 모달 오픈 시 상태 초기화
  React.useEffect(() => {
    if (open) {
      setIsSuccessView(false);
      setSuccessInfo(null);
      setIsProcessing(false);
      setIsDownloadingExcel(false);
    }
  }, [open]);

  // 신규 상품 지급 대상자 목록 및 인원 집계
  const prizeEligibleStudents = React.useMemo(() => {
    return evaluations.filter(e => Boolean(e.rewardEligibility?.prize?.eligible));
  }, [evaluations]);

  // 신규 인증상(70점↑) 대상자 목록 및 인원 집계
  const certAwardEligibleStudents = React.useMemo(() => {
    return evaluations.filter(e => Boolean(e.rewardEligibility?.certificateAward?.eligible));
  }, [evaluations]);

  // 등급별 상품 요약
  const prizeRankSummary = React.useMemo(() => {
    const summary = { S: 0, A: 0, B: 0, C: 0, upgrade: 0 };
    prizeEligibleStudents.forEach(s => {
      if (s.rank in summary) summary[s.rank as 'S' | 'A' | 'B' | 'C']++;
      if (s.rewardEligibility?.prize?.isUpgrade) summary.upgrade++;
    });
    return summary;
  }, [prizeEligibleStudents]);

  const handleBulkConfirm = async () => {
    if (!awardPrize && !awardCert) {
      toast({ title: '선택 오류', description: '확정할 포상 항목을 최소 1개 이상 선택해주세요.', variant: 'destructive' });
      return;
    }

    const totalTargets = (awardPrize ? prizeEligibleStudents.length : 0) + (awardCert ? certAwardEligibleStudents.length : 0);
    if (totalTargets === 0) {
      toast({ title: '대상자 없음', description: '현재 신규 확정 대상자가 없습니다.', variant: 'default' });
      return;
    }

    setIsProcessing(true);
    try {
      let prizeSuccessCount = 0;
      let certSuccessCount = 0;
      const todayStr = new Date().toISOString().split('T')[0];

      // 1. 등급별 상품 일괄 확정
      if (awardPrize && prizeEligibleStudents.length > 0) {
        const prizeRes = await bulkAwardItemsAction({
          studentIds: prizeEligibleStudents.map(s => s.studentId),
          rewardType: 'prize',
          academicYear,
          semester,
          gradeNum: grade,
        });
        if (prizeRes.success) {
          prizeSuccessCount = prizeRes.count;
        } else {
          console.error('Prize bulk award failed:', prizeRes.error);
        }
      }

      // 2. 옥저인재인증상 일괄 확정
      if (awardCert && certAwardEligibleStudents.length > 0) {
        const certRes = await bulkAwardItemsAction({
          studentIds: certAwardEligibleStudents.map(s => s.studentId),
          rewardType: 'certificate_award',
          academicYear,
          semester,
          gradeNum: grade,
        });
        if (certRes.success) {
          certSuccessCount = certRes.count;
        } else {
          console.error('Cert award bulk failed:', certRes.error);
        }
      }

      const allTargetStudentIds = Array.from(new Set([
        ...(awardPrize ? prizeEligibleStudents.map(s => s.studentId) : []),
        ...(awardCert ? certAwardEligibleStudents.map(s => s.studentId) : []),
      ]));

      toast({
        title: '⚡ 일괄 수령 확정 완료',
        description: `${grade}학년 등급별 상품 ${prizeSuccessCount}건, 인증상 ${certSuccessCount}건이 즉시 스냅샷으로 영구 보존 확정되었습니다.`,
      });

      // 백그라운드 데이터 갱신
      await onSuccess();

      // 성공 화면 표시
      setSuccessInfo({
        prizeSuccessCount,
        certSuccessCount,
        totalStudentsCount: allTargetStudentIds.length,
        awardedDate: todayStr,
        studentIds: allTargetStudentIds,
      });
      setIsSuccessView(true);
    } catch (err: any) {
      console.error('Bulk confirm error:', err);
      toast({
        title: '일괄 확정 오류',
        description: err?.message || '처리 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 방금 확정된 건에 대해서만 공문서 수령 대장 엑셀 다운로드
  const handleDownloadCurrentBatchLedger = async () => {
    if (!successInfo) return;
    setIsDownloadingExcel(true);
    try {
      const res = await exportRewardLedgerExcelAction({
        academicYear,
        semester,
        grade,
        selectedClass: 'all',
        targetAwardedDate: successInfo.awardedDate,
        onlyAwarded: true,
        targetStudentIds: successInfo.studentIds,
      });

      if (!res.success || !res.data) {
        toast({
          title: '엑셀 생성 실패',
          description: res.error || '오류가 발생했습니다.',
          variant: 'destructive',
        });
        return;
      }

      const byteCharacters = atob(res.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = res.fileName || `${academicYear}학년도_${grade}학년_일괄확정_수령대장_${successInfo.awardedDate}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: '📄 공문서 수령 대장 다운로드 완료',
        description: `방금 확정된 ${successInfo.totalStudentsCount}명에 대한 공문서 수령 대장 엑셀이 다운로드되었습니다.`,
      });
    } catch (err: any) {
      console.error('Download batch ledger error:', err);
      toast({
        title: '다운로드 오류',
        description: err?.message || '엑셀 다운로드 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[94vw] rounded-2xl p-5 sm:p-6 bg-white shadow-xl">
        {!isSuccessView ? (
          <>
            <DialogHeader className="space-y-1.5">
              <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                <div className="p-1.5 bg-amber-100 text-amber-700 rounded-xl shadow-2xs">
                  <Zap className="h-5 w-5 fill-amber-500 text-amber-600" />
                </div>
                <span>{academicYear}학년도 {grade}학년 대상자 일괄 확정</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-medium">
                현재 점수 기준 신규 자격 대상자를 자동 계산하여 원클릭으로 공식 수령 확정 및 영구 스냅샷을 생성합니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3 text-xs">
              {/* 현황 카드 */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* 상품 지급 대상 */}
                <div className={`p-3 rounded-xl border transition-all ${awardPrize ? 'bg-blue-50/70 border-blue-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-blue-900">
                      <Gift className="h-4 w-4 text-blue-600" />
                      <span>등급별 상품 대상</span>
                    </div>
                    <Checkbox
                      id="chk-prize"
                      checked={awardPrize}
                      onCheckedChange={(c) => setAwardPrize(Boolean(c))}
                    />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-black text-blue-700">{prizeEligibleStudents.length}</span>
                    <span className="text-xs font-semibold text-blue-600">명</span>
                  </div>
                  <div className="mt-1.5 text-[10px] text-blue-700 flex flex-wrap gap-1 font-medium">
                    <span>S:{prizeRankSummary.S}</span>
                    <span>•</span>
                    <span>A:{prizeRankSummary.A}</span>
                    <span>•</span>
                    <span>B:{prizeRankSummary.B}</span>
                    <span>•</span>
                    <span>C:{prizeRankSummary.C}</span>
                    {prizeRankSummary.upgrade > 0 && (
                      <span className="text-indigo-700 font-bold ml-1">(승급 {prizeRankSummary.upgrade}명)</span>
                    )}
                  </div>
                </div>

                {/* 인증상 대상 */}
                <div className={`p-3 rounded-xl border transition-all ${awardCert ? 'bg-amber-50/70 border-amber-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                      <Trophy className="h-4 w-4 text-amber-600" />
                      <span>{prizeConfig?.certificateAward || '옥저인재인증상'} 대상</span>
                    </div>
                    <Checkbox
                      id="chk-cert"
                      checked={awardCert}
                      onCheckedChange={(c) => setAwardCert(Boolean(c))}
                    />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-black text-amber-700">{certAwardEligibleStudents.length}</span>
                    <span className="text-xs font-semibold text-amber-600">명</span>
                    <span className="text-[10px] text-slate-500 ml-1">(70점 이상)</span>
                  </div>
                  <div className="mt-1.5 text-[10px] text-amber-700 font-medium">
                    재학 중 1회 수여 기준
                  </div>
                </div>
              </div>

              {/* 비고 입력 */}
              <div className="space-y-1.5">
                <Label htmlFor="bulk-remarks" className="text-xs font-bold text-slate-700">
                  확정 비고 (선택 사항)
                </Label>
                <Input
                  id="bulk-remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="예: 정기 인증 평가 일괄 지급, 산학협력부 주관"
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              {/* 안전 안내 박스 */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 text-[11px] leading-relaxed space-y-1">
                <div className="flex items-center gap-1 font-bold text-slate-800">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>스냅샷 불변성 및 중복 방지 보장</span>
                </div>
                <p>
                  • 확정 시점의 종합점수 및 4대 영역별 점수가 <strong>영구 스냅샷으로 락(Lock)</strong>되어 대장 출력 및 공문서 첨부 원본으로 보장됩니다.
                </p>
                <p>
                  • 이미 해당 등급 상품을 수령한 학생은 <strong>자동 제외</strong>되며, 점수가 올라 상위 등급으로 승급한 학생만 정상 확정됩니다.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isProcessing}
                onClick={() => onOpenChange(false)}
                className="text-xs font-semibold rounded-xl"
              >
                취소
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isProcessing || (!awardPrize && !awardCert) || (prizeEligibleStudents.length === 0 && certAwardEligibleStudents.length === 0)}
                onClick={handleBulkConfirm}
                className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs gap-1.5"
              >
                <Zap className="h-3.5 w-3.5 fill-white" />
                <span>
                  {isProcessing
                    ? '일괄 확정 처리 중...'
                    : `총 ${(awardPrize ? prizeEligibleStudents.length : 0) + (awardCert ? certAwardEligibleStudents.length : 0)}명 일괄 확정 실행`}
                </span>
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* ✨ 확정 완료 후 공문서 즉시 다운로드 화면 (사용자 핵심 요구사항) */
          <>
            <DialogHeader className="space-y-1.5 text-center sm:text-left">
              <DialogTitle className="text-lg font-black text-slate-900 flex items-center justify-center sm:justify-start gap-2">
                <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-xl shadow-2xs">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <span>포상 대상자 일괄 확정 완료</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-medium">
                {academicYear}학년도 {grade}학년 포상 대상자가 오늘 일자로 안전하게 확정 등록되었습니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              {/* 확정 결과 요약 카드 */}
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 pb-2 border-b border-slate-200">
                  <span>📅 공식 확정 일자</span>
                  <span className="font-extrabold text-indigo-700">{successInfo?.awardedDate}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/60 shadow-2xs">
                    <span className="text-[11px] text-slate-500 font-semibold block">🎁 등급별 상품 확정</span>
                    <span className="text-lg font-black text-blue-700">{successInfo?.prizeSuccessCount}명</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/60 shadow-2xs">
                    <span className="text-[11px] text-slate-500 font-semibold block">🏆 인증상 확정</span>
                    <span className="text-lg font-black text-amber-700">{successInfo?.certSuccessCount}명</span>
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-500 font-bold pt-1">
                  총 대상 학생: <span className="text-slate-900 font-black">{successInfo?.totalStudentsCount}명</span>
                </div>
              </div>

              {/* 공문서 다운로드 강조 배너 */}
              <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shrink-0 shadow-xs">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div className="space-y-0.5 text-xs">
                  <div className="font-extrabold text-indigo-950 flex items-center gap-1.5">
                    <span>행정실 제출용 공문서 수령 대장</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-white text-indigo-700 border-indigo-200 font-bold">
                      A4 인쇄 규격
                    </Badge>
                  </div>
                  <p className="text-[11px] text-indigo-800 font-medium leading-relaxed">
                    이번에 방금 확정된 <strong>{successInfo?.totalStudentsCount}명에 대해서만</strong> 정제된 공문서 수령 대장을 즉시 받아보실 수 있습니다.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100 flex-col sm:flex-row">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-9 px-4 text-xs font-bold text-slate-600 rounded-xl"
              >
                닫기
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleDownloadCurrentBatchLedger}
                disabled={isDownloadingExcel}
                className="h-9 px-4 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-1.5 shadow-md shadow-indigo-600/30"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{isDownloadingExcel ? '엑셀 생성 중...' : '📄 이번 확정 건 공문서 수령 대장 다운로드'}</span>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
