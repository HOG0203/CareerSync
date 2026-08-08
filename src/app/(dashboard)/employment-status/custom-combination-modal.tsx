'use client';

import * as React from 'react';
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Plus, 
  Trash2, 
  SlidersHorizontal, 
  BookmarkPlus, 
  Check, 
  RotateCcw, 
  Sparkles, 
  Award, 
  CalendarCheck, 
  Briefcase, 
  GraduationCap 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type MainCategory = 'cert' | 'attendance' | 'status' | 'rank';

export interface ConditionItem {
  id: string;
  mainCategory: MainCategory;
  subType: string; // cert: 'name' | 'count'; attendance: 'perfect' | 'unexcused' | 'disease'; status: 'main'; rank: 'main'
  value: string;
}

export interface CustomRule {
  operator: 'AND' | 'OR';
  conditions: ConditionItem[];
  presetName?: string;
}

export interface PresetItem {
  id: string;
  name: string;
  rule: CustomRule;
}

const PRESET_STORAGE_KEY = 'careersync_combination_presets';

const DEFAULT_PRESETS: PresetItem[] = [
  {
    id: 'preset_1',
    name: '선반기능사 + 완벽 개근 (미인정/질병 0건)',
    rule: {
      operator: 'AND',
      conditions: [
        { id: 'c1', mainCategory: 'cert', subType: 'name', value: '컴퓨터응용선반기능사' },
        { id: 'c2', mainCategory: 'attendance', subType: 'perfect', value: '0' }
      ]
    }
  },
  {
    id: 'preset_2',
    name: '미취업 + 자격증 0개 (상담 대상)',
    rule: {
      operator: 'AND',
      conditions: [
        { id: 'c1', mainCategory: 'status', subType: 'main', value: '미취업' },
        { id: 'c2', mainCategory: 'cert', subType: 'count', value: '0' }
      ]
    }
  },
  {
    id: 'preset_3',
    name: '자격증 2개+ & 미인정 0건 & 질병 3건 이하',
    rule: {
      operator: 'AND',
      conditions: [
        { id: 'c1', mainCategory: 'cert', subType: 'count', value: '2+' },
        { id: 'c2', mainCategory: 'attendance', subType: 'unexcused', value: '0' },
        { id: 'c3', mainCategory: 'attendance', subType: 'disease', value: 'le_3' }
      ]
    }
  }
];

interface CustomCombinationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (rule: CustomRule | null) => void;
  currentRule: CustomRule | null;
  allCertificates?: string[];
}

export function CustomCombinationModal({
  isOpen,
  onClose,
  onApply,
  currentRule,
  allCertificates = []
}: CustomCombinationModalProps) {
  const [operator, setOperator] = React.useState<'AND' | 'OR'>('AND');
  const [conditions, setConditions] = React.useState<ConditionItem[]>([]);
  const [presets, setPresets] = React.useState<PresetItem[]>([]);
  const [newPresetName, setNewPresetName] = React.useState('');
  const [isSavingPreset, setIsSavingPreset] = React.useState(false);

  // 모달 열릴 때 기존 상태 또는 기본 상태 로드
  React.useEffect(() => {
    if (isOpen) {
      if (currentRule && currentRule.conditions.length > 0) {
        setOperator(currentRule.operator);
        setConditions(currentRule.conditions);
      } else {
        // 기본 2개 조건 폼 생성 (선반기능사 + 완벽 개근)
        setOperator('AND');
        setConditions([
          { id: `c_${Date.now()}_1`, mainCategory: 'cert', subType: 'name', value: '컴퓨터응용선반기능사' },
          { id: `c_${Date.now()}_2`, mainCategory: 'attendance', subType: 'perfect', value: '0' }
        ]);
      }

      // 로컬 스토리지에서 프리셋 가져오기
      try {
        const stored = localStorage.getItem(PRESET_STORAGE_KEY);
        if (stored) {
          setPresets(JSON.parse(stored));
        } else {
          setPresets(DEFAULT_PRESETS);
          localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(DEFAULT_PRESETS));
        }
      } catch (e) {
        setPresets(DEFAULT_PRESETS);
      }
    }
  }, [isOpen, currentRule]);

  // 조건 행 추가
  const handleAddCondition = () => {
    const newCond: ConditionItem = {
      id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      mainCategory: 'cert',
      subType: 'name',
      value: allCertificates[0] || '컴퓨터응용선반기능사'
    };
    setConditions([...conditions, newCond]);
  };

  // 조건 행 삭제
  const handleRemoveCondition = (id: string) => {
    setConditions(conditions.filter(c => c.id !== id));
  };

  // 대분류 변경 시
  const handleMainCategoryChange = (id: string, mainCat: MainCategory) => {
    setConditions(conditions.map(c => {
      if (c.id === id) {
        if (mainCat === 'cert') {
          return { ...c, mainCategory: mainCat, subType: 'name', value: allCertificates[0] || '컴퓨터응용선반기능사' };
        } else if (mainCat === 'attendance') {
          return { ...c, mainCategory: mainCat, subType: 'perfect', value: '0' };
        } else if (mainCat === 'status') {
          return { ...c, mainCategory: mainCat, subType: 'main', value: '미취업' };
        } else if (mainCat === 'rank') {
          return { ...c, mainCategory: mainCat, subType: 'main', value: 'top30' };
        }
      }
      return c;
    }));
  };

  // 소분류 변경 시
  const handleSubTypeChange = (id: string, subType: string) => {
    setConditions(conditions.map(c => {
      if (c.id === id) {
        let defaultValue = '0';
        if (c.mainCategory === 'cert') {
          defaultValue = subType === 'name' ? (allCertificates[0] || '컴퓨터응용선반기능사') : '1+';
        } else if (c.mainCategory === 'attendance') {
          defaultValue = '0';
        }
        return { ...c, subType, value: defaultValue };
      }
      return c;
    }));
  };

  // 조건 값 변경 시
  const handleValueChange = (id: string, value: string) => {
    setConditions(conditions.map(c => c.id === id ? { ...c, value } : c));
  };

  // 프리셋 로드
  const handleLoadPreset = (preset: PresetItem) => {
    setOperator(preset.rule.operator);
    setConditions(preset.rule.conditions.map((c, i) => ({ ...c, id: `c_preset_${i}_${Date.now()}` })));
  };

  // 프리셋 저장
  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: PresetItem = {
      id: `preset_${Date.now()}`,
      name: newPresetName.trim(),
      rule: { operator, conditions }
    };
    const updated = [newPreset, ...presets];
    setPresets(updated);
    try {
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
    setNewPresetName('');
    setIsSavingPreset(false);
  };

  // 프리셋 삭제
  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    try {
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
  };

  // 최종 하이라이트 적용
  const handleApply = () => {
    const validConditions = conditions.filter(c => c.value && c.value.trim() !== '');
    if (validConditions.length === 0) {
      onApply(null);
    } else {
      onApply({ operator, conditions: validConditions });
    }
    onClose();
  };

  // 초기화
  const handleReset = () => {
    onApply(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl rounded-2xl p-0 border-none shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="p-5 bg-slate-900 text-white shrink-0">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-blue-400" />
            자유 커스텀 조건 조합 하이라이트 빌더
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs mt-1">
            대분류(자격증, 출결, 취업, 성적) 선택 후 세부 항목을 자유롭게 조립하여 학생을 강조합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 overflow-y-auto space-y-5 bg-white flex-1">
          {/* 마이 프리셋 (나만의 조합) 불러오기 영역 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <BookmarkPlus className="h-4 w-4 text-indigo-600" />
                마이 프리셋 (자주 쓰는 조합)
              </span>
              <button 
                type="button"
                onClick={() => setIsSavingPreset(!isSavingPreset)}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
              >
                {isSavingPreset ? '취소' : '+ 현재 조합 프리셋으로 저장'}
              </button>
            </div>

            {/* 프리셋 저장 입력창 */}
            {isSavingPreset && (
              <div className="flex gap-2 p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100">
                <Input
                  placeholder="프리셋 이름 (예: 선반기능사 + 개근)"
                  value={newPresetName}
                  onChange={e => setNewPresetName(e.target.value)}
                  className="h-8 text-xs bg-white border-indigo-200"
                />
                <Button size="sm" onClick={handleSavePreset} className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 shrink-0">
                  저장
                </Button>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {presets.map(p => (
                <div
                  key={p.id}
                  onClick={() => handleLoadPreset(p)}
                  className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer transition-all text-xs font-medium text-slate-700 hover:text-indigo-900"
                >
                  <Sparkles className="h-3 w-3 text-indigo-500 shrink-0" />
                  <span>{p.name}</span>
                  <button
                    onClick={e => handleDeletePreset(p.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition-opacity ml-1"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* 조합 연산자 선택 (AND / OR) */}
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-700">조건 간 결합 방식</span>
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setOperator('AND')}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-md transition-all",
                  operator === 'AND' ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
                )}
              >
                AND (모두 만족)
              </button>
              <button
                type="button"
                onClick={() => setOperator('OR')}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-md transition-all",
                  operator === 'OR' ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
                )}
              >
                OR (하나라도 만족)
              </button>
            </div>
          </div>

          {/* 동적 조건 목록 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">설정된 조건 목록 ({conditions.length}개)</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddCondition}
                className="h-7 text-xs font-bold border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> 조건 추가
              </Button>
            </div>

            {conditions.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                조건이 없습니다. [조건 추가] 버튼을 눌러 나만의 조합을 만드세요.
              </div>
            ) : (
              <div className="space-y-2.5">
                {conditions.map((cond, index) => (
                  <div key={cond.id} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 bg-slate-50/90 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-400 w-5 shrink-0 text-left sm:text-center self-center">#{index + 1}</span>

                    {/* 1차 대분류 선택 */}
                    <Select
                      value={cond.mainCategory}
                      onValueChange={val => handleMainCategoryChange(cond.id, val as MainCategory)}
                    >
                      <SelectTrigger className="w-full sm:w-[125px] h-9 text-xs font-bold bg-white border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cert" className="text-xs font-bold">📜 자격증</SelectItem>
                        <SelectItem value="attendance" className="text-xs font-bold">🏫 출결</SelectItem>
                        <SelectItem value="status" className="text-xs font-bold">💼 취업/진로</SelectItem>
                        <SelectItem value="rank" className="text-xs font-bold">📊 성적/석차</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* 2차 세부유형 선택 */}
                    {cond.mainCategory === 'cert' && (
                      <Select
                        value={cond.subType}
                        onValueChange={val => handleSubTypeChange(cond.id, val)}
                      >
                        <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs font-bold bg-white border-slate-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="name" className="text-xs">특정 자격증 명칭</SelectItem>
                          <SelectItem value="count" className="text-xs">자격증 총 개수</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    {cond.mainCategory === 'attendance' && (
                      <Select
                        value={cond.subType}
                        onValueChange={val => handleSubTypeChange(cond.id, val)}
                      >
                        <SelectTrigger className="w-full sm:w-[155px] h-9 text-xs font-bold bg-white border-slate-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="perfect" className="text-xs">✨ 완벽 개근 (0건)</SelectItem>
                          <SelectItem value="unexcused" className="text-xs">🚨 미인정(무단) 건수</SelectItem>
                          <SelectItem value="disease" className="text-xs">🤒 질병 건수</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    {/* 3차 세부 값 선택/입력 */}
                    <div className="flex-1 min-w-0">
                      {/* 자격증 명칭 (등록된 자격증 드롭다운 선택 + 직접 텍스트 입력 겸용) */}
                      {cond.mainCategory === 'cert' && cond.subType === 'name' && (
                        <div className="flex flex-col sm:flex-row items-center gap-1.5 w-full">
                          {allCertificates.length > 0 && (
                            <Select
                              value={allCertificates.includes(cond.value) ? cond.value : '__custom__'}
                              onValueChange={val => {
                                if (val !== '__custom__') {
                                  handleValueChange(cond.id, val);
                                }
                              }}
                            >
                              <SelectTrigger className="w-full sm:w-[170px] h-9 text-xs font-bold bg-white border-slate-200 shrink-0">
                                <SelectValue placeholder="등록 자격증 선택..." />
                              </SelectTrigger>
                              <SelectContent className="max-h-[220px]">
                                <SelectItem value="__custom__" className="text-xs text-indigo-600 font-bold">
                                  ✏️ 직접 입력
                                </SelectItem>
                                {allCertificates.map(cert => (
                                  <SelectItem key={cert} value={cert} className="text-xs font-medium">
                                    {cert}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}

                          <Input
                            placeholder="자격증 명칭 직접 입력..."
                            value={cond.value}
                            onChange={e => handleValueChange(cond.id, e.target.value)}
                            className="h-9 text-xs font-bold bg-white border-slate-200 flex-1 min-w-0"
                          />
                        </div>
                      )}

                      {/* 자격증 개수 */}
                      {cond.mainCategory === 'cert' && cond.subType === 'count' && (
                        <Select
                          value={cond.value}
                          onValueChange={val => handleValueChange(cond.id, val)}
                        >
                          <SelectTrigger className="h-9 text-xs font-bold bg-white border-slate-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1+" className="text-xs">1개 이상</SelectItem>
                            <SelectItem value="2+" className="text-xs">2개 이상</SelectItem>
                            <SelectItem value="3+" className="text-xs">3개 이상</SelectItem>
                            <SelectItem value="0" className="text-xs">0개 (없음)</SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      {/* 출결: 완벽 개근 */}
                      {cond.mainCategory === 'attendance' && cond.subType === 'perfect' && (
                        <Select
                          value={cond.value || '0'}
                          onValueChange={val => handleValueChange(cond.id, val)}
                        >
                          <SelectTrigger className="h-9 text-xs font-bold bg-white border-slate-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0" className="text-xs">완벽 개근 (미인정+질병 0건)</SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      {/* 출결: 미인정 건수 */}
                      {cond.mainCategory === 'attendance' && cond.subType === 'unexcused' && (
                        <Select
                          value={cond.value || '0'}
                          onValueChange={val => handleValueChange(cond.id, val)}
                        >
                          <SelectTrigger className="h-9 text-xs font-bold bg-white border-slate-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0" className="text-xs">미인정 0건 (무단 지각/결석 없음)</SelectItem>
                            <SelectItem value="le_1" className="text-xs">미인정 1건 이하</SelectItem>
                            <SelectItem value="le_2" className="text-xs">미인정 2건 이하</SelectItem>
                            <SelectItem value="le_3" className="text-xs">미인정 3건 이하</SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      {/* 출결: 질병 건수 */}
                      {cond.mainCategory === 'attendance' && cond.subType === 'disease' && (
                        <Select
                          value={cond.value || '0'}
                          onValueChange={val => handleValueChange(cond.id, val)}
                        >
                          <SelectTrigger className="h-9 text-xs font-bold bg-white border-slate-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0" className="text-xs">질병 0건 (질병 지각/결석 없음)</SelectItem>
                            <SelectItem value="le_1" className="text-xs">질병 1건 이하</SelectItem>
                            <SelectItem value="le_2" className="text-xs">질병 2건 이하</SelectItem>
                            <SelectItem value="le_3" className="text-xs">질병 3건 이하</SelectItem>
                            <SelectItem value="le_5" className="text-xs">질병 5건 이하</SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      {/* 취업/진로 상태 */}
                      {cond.mainCategory === 'status' && (
                        <Select
                          value={cond.value}
                          onValueChange={val => handleValueChange(cond.id, val)}
                        >
                          <SelectTrigger className="h-9 text-xs font-bold bg-white border-slate-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="미취업" className="text-xs">미취업</SelectItem>
                            <SelectItem value="취업" className="text-xs">취업 (취업완료/재직)</SelectItem>
                            <SelectItem value="현장실습/도제OJT" className="text-xs">현장실습 / 도제OJT</SelectItem>
                            <SelectItem value="채용진행중" className="text-xs">채용진행중</SelectItem>
                            <SelectItem value="진학" className="text-xs">진학</SelectItem>
                            <SelectItem value="제외인정자" className="text-xs">제외인정자</SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      {/* 성적/석차 범위 */}
                      {cond.mainCategory === 'rank' && (
                        <Select
                          value={cond.value}
                          onValueChange={val => handleValueChange(cond.id, val)}
                        >
                          <SelectTrigger className="h-9 text-xs font-bold bg-white border-slate-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="top30" className="text-xs">성적 상위 30% 이내</SelectItem>
                            <SelectItem value="top50" className="text-xs">성적 상위 50% 이내</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveCondition(cond.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 transition-colors self-end sm:self-center"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-4 bg-slate-50 border-t flex flex-row items-center justify-between gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={handleReset}
            className="text-xs font-bold text-slate-500 hover:text-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> 필터 초기화
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="text-xs font-bold">
              취소
            </Button>
            <Button
              type="button"
              onClick={handleApply}
              className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-6"
            >
              <Check className="h-4 w-4 mr-1" /> 하이라이트 적용
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
