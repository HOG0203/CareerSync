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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  CertificationPrizeConfig,
  DEFAULT_CERTIFICATION_PRIZE_CONFIG,
} from '@/lib/certification-calculator';
import { updateCertificationPrizeConfigAction } from './actions';
import { Gift, RotateCcw, Save, ShieldCheck } from 'lucide-react';

interface PrizeSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialConfig?: CertificationPrizeConfig;
  onSuccess?: (newConfig: CertificationPrizeConfig) => Promise<void> | void;
}

export function PrizeSettingsModal({
  open,
  onOpenChange,
  initialConfig = DEFAULT_CERTIFICATION_PRIZE_CONFIG,
  onSuccess,
}: PrizeSettingsModalProps) {
  const { toast } = useToast();
  const [config, setConfig] = React.useState<CertificationPrizeConfig>(initialConfig);
  const [isSaving, setIsSaving] = React.useState(false);

  // 모달 열릴 때 최신 initialConfig 동기화
  React.useEffect(() => {
    if (open) {
      setConfig({
        ...DEFAULT_CERTIFICATION_PRIZE_CONFIG,
        ...initialConfig,
      });
    }
  }, [open, initialConfig]);

  const handleResetToDefault = () => {
    setConfig({ ...DEFAULT_CERTIFICATION_PRIZE_CONFIG });
    toast({
      title: '기본값 복원',
      description: '상품명이 시스템 기본값으로 초기화되었습니다. [설정 저장]을 누르면 반영됩니다.',
    });
  };

  const handleSave = async () => {
    if (!config.rankS.trim() || !config.rankA.trim() || !config.rankB.trim() || !config.rankC.trim() || !config.certificateAward.trim()) {
      toast({
        title: '입력 오류',
        description: '모든 등급의 상품명 및 인증상 명칭을 공백 없이 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateCertificationPrizeConfigAction(config);
      if (!res.success) {
        toast({
          title: '저장 실패',
          description: res.error || '상품 설정을 저장하지 못했습니다.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: '🎁 상품 설정 저장 완료',
        description: '등급별 상품 및 인증상 명칭이 성공적으로 업데이트되었습니다.',
      });

      if (onSuccess) {
        await onSuccess(config);
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: '오류 발생',
        description: err?.message || '저장 중 예기치 않은 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[94vw] rounded-2xl p-5 sm:p-6 bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
            <div className="p-1.5 bg-pink-100 text-pink-700 rounded-xl shadow-2xs">
              <Gift className="h-5 w-5 text-pink-600" />
            </div>
            <span>인증제 등급별 상품 및 포상 명칭 설정</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            [⚡ 대상자 일괄 확정] 및 포상 대장 출력 시 자동 적용될 등급별 상품 명칭을 설정합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* S등급 상품 */}
          <div className="space-y-1.5 bg-amber-50/50 p-3 rounded-xl border border-amber-200/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Badge className="bg-amber-600 text-white font-extrabold hover:bg-amber-700 text-[10px] px-2 py-0.5">
                  🏆 S등급
                </Badge>
                <span className="font-bold text-slate-800 text-xs">80점 이상 상품명</span>
              </div>
              <span className="text-[11px] text-amber-700 font-semibold">최고 영예</span>
            </div>
            <Input
              value={config.rankS}
              onChange={(e) => setConfig({ ...config, rankS: e.target.value })}
              placeholder="예: S등급 상품 (문화상품권 5만원권)"
              className="h-9 text-xs bg-white rounded-lg border-slate-300 font-medium"
            />
          </div>

          {/* A등급 상품 */}
          <div className="space-y-1.5 bg-blue-50/50 p-3 rounded-xl border border-blue-200/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Badge className="bg-blue-600 text-white font-extrabold hover:bg-blue-700 text-[10px] px-2 py-0.5">
                  🥇 A등급
                </Badge>
                <span className="font-bold text-slate-800 text-xs">60점 ~ 79점 상품명</span>
              </div>
              <span className="text-[11px] text-blue-700 font-semibold">우수</span>
            </div>
            <Input
              value={config.rankA}
              onChange={(e) => setConfig({ ...config, rankA: e.target.value })}
              placeholder="예: A등급 상품 (문화상품권 3만원권)"
              className="h-9 text-xs bg-white rounded-lg border-slate-300 font-medium"
            />
          </div>

          {/* B등급 상품 */}
          <div className="space-y-1.5 bg-emerald-50/50 p-3 rounded-xl border border-emerald-200/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Badge className="bg-emerald-600 text-white font-extrabold hover:bg-emerald-700 text-[10px] px-2 py-0.5">
                  🥈 B등급
                </Badge>
                <span className="font-bold text-slate-800 text-xs">40점 ~ 59점 상품명</span>
              </div>
              <span className="text-[11px] text-emerald-700 font-semibold">장려</span>
            </div>
            <Input
              value={config.rankB}
              onChange={(e) => setConfig({ ...config, rankB: e.target.value })}
              placeholder="예: B등급 상품 (문화상품권 1만원권)"
              className="h-9 text-xs bg-white rounded-lg border-slate-300 font-medium"
            />
          </div>

          {/* C등급 상품 */}
          <div className="space-y-1.5 bg-slate-100/70 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Badge className="bg-slate-600 text-white font-extrabold hover:bg-slate-700 text-[10px] px-2 py-0.5">
                  🥉 C등급
                </Badge>
                <span className="font-bold text-slate-800 text-xs">20점 ~ 39점 상품명</span>
              </div>
              <span className="text-[11px] text-slate-600 font-semibold">노력</span>
            </div>
            <Input
              value={config.rankC}
              onChange={(e) => setConfig({ ...config, rankC: e.target.value })}
              placeholder="예: C등급 상품 (문화상품권 5천원권/기념품)"
              className="h-9 text-xs bg-white rounded-lg border-slate-300 font-medium"
            />
          </div>

          {/* 옥저인재인증상 명칭 */}
          <div className="space-y-1.5 bg-indigo-50/60 p-3 rounded-xl border border-indigo-200/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Badge className="bg-indigo-600 text-white font-extrabold hover:bg-indigo-700 text-[10px] px-2 py-0.5">
                  🎖️ 인증상
                </Badge>
                <span className="font-bold text-slate-800 text-xs">종합 70점 이상 표창 명칭</span>
              </div>
              <span className="text-[11px] text-indigo-700 font-semibold">재학 중 1회 수여</span>
            </div>
            <Input
              value={config.certificateAward}
              onChange={(e) => setConfig({ ...config, certificateAward: e.target.value })}
              placeholder="예: 옥저인재인증상"
              className="h-9 text-xs bg-white rounded-lg border-slate-300 font-medium"
            />
          </div>

          {/* 안내 배너 */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 text-[11px] leading-relaxed space-y-1">
            <div className="flex items-center gap-1 font-bold text-slate-800">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>안내 및 불변 스냅샷 보장</span>
            </div>
            <p>
              • 여기서 저장된 상품명은 데이터베이스 <code className="text-indigo-600 font-bold">system_settings</code>에 안전하게 영구 저장됩니다.
            </p>
            <p>
              • 향후 실행되는 <strong>[⚡ 대상자 일괄 확정]</strong> 및 <strong>[공문서 수령 대장 엑셀]</strong>에 실시간 적용됩니다.
            </p>
            <p>
              • <strong>이미 수령 확정된 과거 학생들의 기록은 당시 스냅샷으로 영구 보존</strong>되므로 변경되지 않습니다.
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetToDefault}
            disabled={isSaving}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 rounded-xl gap-1 w-full sm:w-auto"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>기본값 복원</span>
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
              className="text-xs font-semibold rounded-xl w-full sm:w-auto"
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSaving}
              onClick={handleSave}
              className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs gap-1.5 w-full sm:w-auto"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? '저장 중...' : '설정 저장'}</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
