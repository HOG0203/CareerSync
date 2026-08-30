'use client';

// ==============================================================================
// src/app/(dashboard)/teaching-support/timetable/weight-settings-modal.tsx
// 활동별 수업시수 가중치 설정 모달
// ==============================================================================

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
import { Label } from '@/components/ui/label';
import { Scale, RotateCcw, Check, Sparkles, AlertCircle } from 'lucide-react';
import { 
  ActivityWeightConfig, 
  DEFAULT_ACTIVITY_WEIGHTS 
} from '@/lib/timetable/constants';
import { saveWeightSettings } from './actions';
import { toast } from '@/hooks/use-toast';

interface WeightSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWeights: ActivityWeightConfig;
  onWeightsUpdated: (newWeights: ActivityWeightConfig) => void;
}

export function WeightSettingsModal({
  isOpen,
  onClose,
  currentWeights,
  onWeightsUpdated,
}: WeightSettingsModalProps) {
  const [weights, setWeights] = React.useState<ActivityWeightConfig>({ ...DEFAULT_ACTIVITY_WEIGHTS });
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setWeights({ ...DEFAULT_ACTIVITY_WEIGHTS, ...currentWeights });
    }
  }, [isOpen, currentWeights]);

  const handleChange = (key: string, valStr: string) => {
    const val = parseFloat(valStr);
    setWeights(prev => ({
      ...prev,
      [key]: isNaN(val) ? 0 : val
    }));
  };

  const handleReset = () => {
    setWeights({ ...DEFAULT_ACTIVITY_WEIGHTS });
    toast({
      title: "기본값 복원",
      description: "가중치가 표준 기본값(자율 1.5, 동아리 0.5 등)으로 복원되었습니다.",
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await saveWeightSettings(weights);
      if (res.success) {
        onWeightsUpdated(weights);
        toast({
          title: "가중치 저장 완료",
          description: "수업시수 가중치 설정이 데이터베이스에 저장되었습니다.",
        });
        onClose();
      } else {
        toast({
          title: "저장 실패",
          description: res.error || "가중치 저장 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "오류 발생",
        description: err.message || "가중치 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[95vw] rounded-2xl p-0 overflow-hidden shadow-2xl border-0">
        <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl text-indigo-300">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                수업시수 가중치 설정
              </DialogTitle>
              <DialogDescription className="text-indigo-200/80 text-xs mt-0.5">
                활동별 1교시당 인정되는 시수 배율을 설정합니다.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4 bg-slate-50/50">
          <div className="p-3 bg-indigo-50/80 rounded-xl border border-indigo-100 text-xs text-indigo-900 flex items-start gap-2.5">
            <Sparkles className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">시수 가중치 계산 원리</p>
              <p className="text-slate-600 leading-relaxed text-[11.5px]">
                각 활동의 시간표 1교시당 아래 설정된 가중치를 곱하여 교사의 주당 <strong>[인정 시수]</strong>를 자동으로 계산합니다.
              </p>
            </div>
          </div>

          <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            {/* 자율활동 */}
            <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-slate-100">
              <div>
                <Label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
                  자율활동 (자율)
                </Label>
                <p className="text-[10.5px] text-slate-400">기본값: 1.5 (1교시 = 1.5시간 인정)</p>
              </div>
              <div className="flex items-center gap-1.5 w-24">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={weights['자율'] ?? 1.5}
                  onChange={e => handleChange('자율', e.target.value)}
                  className="h-8 text-xs text-right font-black text-purple-700 bg-purple-50/50 border-purple-200"
                />
                <span className="text-xs font-bold text-slate-500">배</span>
              </div>
            </div>

            {/* 동아리 */}
            <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-slate-100">
              <div>
                <Label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  동아리 활동 (동아)
                </Label>
                <p className="text-[10.5px] text-slate-400">기본값: 0.5 (1교시 = 0.5시간 인정)</p>
              </div>
              <div className="flex items-center gap-1.5 w-24">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={weights['동아'] ?? 0.5}
                  onChange={e => handleChange('동아', e.target.value)}
                  className="h-8 text-xs text-right font-black text-amber-700 bg-amber-50/50 border-amber-200"
                />
                <span className="text-xs font-bold text-slate-500">배</span>
              </div>
            </div>

            {/* 진로활동 */}
            <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-slate-100">
              <div>
                <Label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  진로활동 (진로)
                </Label>
                <p className="text-[10.5px] text-slate-400">기본값: 1.0 (1교시 = 1.0시간)</p>
              </div>
              <div className="flex items-center gap-1.5 w-24">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={weights['진로'] ?? 1.0}
                  onChange={e => handleChange('진로', e.target.value)}
                  className="h-8 text-xs text-right font-black text-emerald-700 bg-emerald-50/50 border-emerald-200"
                />
                <span className="text-xs font-bold text-slate-500">배</span>
              </div>
            </div>

            {/* 성직/기타 */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block" />
                  성직 / 기타 특별활동
                </Label>
                <p className="text-[10.5px] text-slate-400">기본값: 1.0</p>
              </div>
              <div className="flex items-center gap-1.5 w-24">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={weights['성직'] ?? 1.0}
                  onChange={e => handleChange('성직', e.target.value)}
                  className="h-8 text-xs text-right font-black text-cyan-700 bg-cyan-50/50 border-cyan-200"
                />
                <span className="text-xs font-bold text-slate-500">배</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 bg-slate-100/80 border-t flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs text-slate-500 hover:text-slate-900 gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            기본값 복원
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs font-bold"
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm"
            >
              <Check className="h-4 w-4" />
              {isSaving ? '저장 중...' : '설정 저장'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
