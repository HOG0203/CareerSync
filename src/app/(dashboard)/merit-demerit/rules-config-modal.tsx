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
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Sparkles,
  ShieldAlert,
  Settings,
  Plus,
  Trash2,
  Save,
  Loader2,
  CheckCircle2,
  Scale
} from 'lucide-react';
import { 
  MeritDemeritRule, 
  updateMeritDemeritRules 
} from '@/app/(dashboard)/admin/settings/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface RulesConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRules: MeritDemeritRule[];
  onSaved: (updatedRules: MeritDemeritRule[]) => void;
}

export function RulesConfigModal({
  isOpen,
  onClose,
  initialRules,
  onSaved,
}: RulesConfigModalProps) {
  const [rules, setRules] = React.useState<MeritDemeritRule[]>([]);
  const [filterType, setFilterType] = React.useState<'all' | 'merit' | 'demerit'>('all');
  const [isSaving, setIsSaving] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (isOpen) {
      setRules(JSON.parse(JSON.stringify(initialRules || [])));
      setFilterType('all');
    }
  }, [isOpen, initialRules]);

  // 새 규칙 추가
  const handleAddRule = (type: 'merit' | 'demerit') => {
    const newRule: MeritDemeritRule = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type,
      category: '',
      name: '',
      points: type === 'merit' ? 3 : 1,
      isActive: true,
      order: rules.length + 1
    };
    setRules(prev => [newRule, ...prev]);
    setFilterType(type);
    toast({
      title: '새 항목 추가됨',
      description: `새로운 ${type === 'merit' ? '상점' : '벌점'} 항목이 상단에 추가되었습니다. 항목명과 점수를 입력해주세요.`
    });
  };

  // 규칙 필드 변경
  const handleFieldChange = (id: string, field: keyof MeritDemeritRule, value: any) => {
    setRules(prev => prev.map(r => {
      if (r.id !== id) return r;
      return { ...r, [field]: value };
    }));
  };

  // 규칙 삭제
  const handleDeleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  // 저장 실행
  const handleSave = async () => {
    // 유효성 검사
    const emptyNames = rules.filter(r => !r.name.trim());
    if (emptyNames.length > 0) {
      toast({ variant: 'destructive', title: '항목명을 입력해주세요.', description: '항목명이 비어있는 규칙이 있습니다.' });
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateMeritDemeritRules(rules);
      if (res.success) {
        toast({ title: '기준 설정 저장 완료', description: '학생 상벌점 기준 항목이 성공적으로 저장되었습니다.' });
        onSaved(rules);
        onClose();
      } else {
        toast({ variant: 'destructive', title: '저장 실패', description: res.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: '오류 발생', description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredRules = rules.filter(r => {
    if (filterType === 'merit') return r.type === 'merit';
    if (filterType === 'demerit') return r.type === 'demerit';
    return true;
  });

  const meritCount = rules.filter(r => r.type === 'merit').length;
  const demeritCount = rules.filter(r => r.type === 'demerit').length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSaving && !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-[780px] max-h-[92vh] p-0 flex flex-col overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl">
        {/* 상단 헤더 */}
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b bg-gradient-to-r from-slate-50 via-white to-slate-50 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md shrink-0">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  학생 상벌점 기준 설정
                  <Badge variant="outline" className="text-[11px] font-bold text-slate-600 bg-slate-100 border-slate-200">
                    총 {rules.length}개 항목
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-medium">
                  상점(+) 및 벌점(-) 부여 항목과 기준 배점을 자유롭게 추가·수정·관리합니다.
                </DialogDescription>
              </div>
            </div>

            {/* 항목 추가 버튼 그룹 */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                onClick={() => handleAddRule('merit')}
                className="h-10 sm:h-11 px-3.5 sm:px-5 text-xs sm:text-sm font-black bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl shadow-md shadow-emerald-200/50 gap-1.5 transition-all"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.5]" />
                <span>상점 항목 추가</span>
              </Button>
              <Button
                type="button"
                onClick={() => handleAddRule('demerit')}
                className="h-10 sm:h-11 px-3.5 sm:px-5 text-xs sm:text-sm font-black bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl shadow-md shadow-rose-200/50 gap-1.5 transition-all"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.5]" />
                <span>벌점 항목 추가</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* 필터 탭 툴바 */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-50/80 border-b flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-lg transition-all",
                filterType === 'all' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              전체 ({rules.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('merit')}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1",
                filterType === 'merit' ? "bg-emerald-600 text-white shadow-2xs" : "text-emerald-700 hover:text-emerald-800"
              )}
            >
              <Sparkles className="h-3 w-3" />
              상점 ({meritCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('demerit')}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1",
                filterType === 'demerit' ? "bg-rose-600 text-white shadow-2xs" : "text-rose-700 hover:text-rose-800"
              )}
            >
              <ShieldAlert className="h-3 w-3" />
              벌점 ({demeritCount})
            </button>
          </div>
        </div>

        {/* 본문: 기준 항목 리스트 (스크롤) */}
        <div className="p-3 sm:p-5 flex-1 overflow-y-auto space-y-2">
          {filteredRules.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 italic">
              등록된 기준 항목이 없습니다. 상단의 추가 버튼을 눌러 항목을 등록하세요.
            </div>
          ) : (
            filteredRules.map((rule) => {
              const isMerit = rule.type === 'merit';
              return (
                <div
                  key={rule.id}
                  className={cn(
                    "p-2.5 sm:p-3 rounded-xl border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 transition-all",
                    isMerit ? "bg-emerald-50/30 border-emerald-100" : "bg-rose-50/30 border-rose-100",
                    !rule.isActive && "opacity-50 grayscale"
                  )}
                >
                  {/* 유형 뱃지 + 구분/카테고리 + 항목명 */}
                  <div className="flex flex-1 items-center gap-2 min-w-0">
                    <Badge
                      className={cn(
                        "text-[10px] font-black px-2 py-0.5 rounded-lg shrink-0",
                        isMerit ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                      )}
                    >
                      {isMerit ? '상점(+)' : '벌점(-)'}
                    </Badge>

                    {/* 구분 / 카테고리 텍스트 입력창 (직접 작성) */}
                    <div className="w-24 sm:w-28 shrink-0">
                      <Input
                        placeholder="구분/분류"
                        value={rule.category || ''}
                        onChange={(e) => handleFieldChange(rule.id, 'category', e.target.value)}
                        className="h-8 text-xs bg-white border-slate-200 rounded-lg font-bold"
                      />
                    </div>

                    {/* 항목명 텍스트 입력창 */}
                    <div className="flex-1 min-w-0">
                      <Input
                        placeholder="상벌점 항목명 입력..."
                        value={rule.name}
                        onChange={(e) => handleFieldChange(rule.id, 'name', e.target.value)}
                        className="h-8 text-xs bg-white border-slate-200 rounded-lg font-extrabold text-slate-900"
                      />
                    </div>
                  </div>

                  {/* 점수 + 활성화 스위치 + 삭제 버튼 */}
                  <div className="flex items-center justify-end gap-2 shrink-0">
                    <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200">
                      <span className={cn("text-xs font-black", isMerit ? "text-emerald-700" : "text-rose-700")}>
                        {isMerit ? '+' : '-'}
                      </span>
                      <Input
                        type="number"
                        min={1}
                        max={1000}
                        value={rule.points}
                        onChange={(e) => handleFieldChange(rule.id, 'points', parseInt(e.target.value) || 1)}
                        className="h-6 w-14 text-xs font-black text-center border-0 p-0 focus-visible:ring-0"
                      />
                      <span className="text-[11px] font-bold text-slate-500">점</span>
                    </div>

                    <div className="flex items-center gap-1.5 pl-1 border-l">
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={(checked) => handleFieldChange(rule.id, 'isActive', checked)}
                        className="scale-90"
                        title="사용 여부 활성화"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRule(rule.id)}
                        className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        title="항목 삭제"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 하단 푸터 액션 */}
        <DialogFooter className="p-3 sm:p-4 bg-slate-50 border-t flex flex-row items-center justify-between gap-2 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            항목 수정 후 <strong className="text-slate-800">[설정 저장하기]</strong>를 눌러야 반영됩니다.
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="h-9 px-4 rounded-xl text-xs font-bold text-slate-600 border-slate-200"
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="h-9 px-5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100 gap-1.5"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              기준 설정 저장하기
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}