'use client';

// ==============================================================================
// src/app/(dashboard)/teaching-support/substitute/substitute-wizard-modal.tsx
// 결보강 & 수업 교체 스마트 등록 위자드 모달 (시간표 슬롯 연동, 공강 추천, 충돌 검증)
// ==============================================================================

import * as React from 'react';
import { 
  SubstituteApplication, 
  SubstituteItem, 
  SubstituteType, 
  AvailableTeacher 
} from '@/lib/substitute/types';
import { ParsedTimetableResult, TimetableSlot } from '@/lib/timetable/parser';
import { 
  checkSubstituteItemConflict, 
  getAvailableTeachersForSlot, 
  getDayOfWeekFromDate 
} from '@/lib/substitute/validator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Calendar, 
  Clock, 
  User, 
  ArrowLeftRight, 
  UserPlus, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  FileText,
  Trash2,
  Layers,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubstituteWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (app: SubstituteApplication, submitImmediately?: boolean) => Promise<void>;
  timetableData: ParsedTimetableResult;
  existingApplications: SubstituteApplication[];
  currentTeacherName?: string;
}

const COMMON_REASONS = [
  '전국기능경기대회 지도 출장',
  '지방기능경기대회 지도 출장',
  '교외 연수 및 직무 교육',
  '출장 (현장실습 점검 및 협의)',
  '연가 (개인 사정)',
  '병가 (치료 및 입원)',
  '특별휴가 (경조사)',
  '교내외 공식 행사 지원',
];

export function SubstituteWizardModal({
  isOpen,
  onClose,
  onSave,
  timetableData,
  existingApplications,
  currentTeacherName,
}: SubstituteWizardModalProps) {
  // 신청 교사
  const [selectedTeacherName, setSelectedTeacherName] = React.useState<string>(
    currentTeacherName || timetableData.teachers[0]?.teacherName || ''
  );

  // 사유
  const [reason, setReason] = React.useState<string>('');

  // 신청 일자
  const todayStr = React.useMemo(() => new Date().toISOString().split('T')[0], []);
  const [sourceDate, setSourceDate] = React.useState<string>(todayStr);

  // 선택된 신청 항목들
  const [items, setItems] = React.useState<SubstituteItem[]>([]);

  // 로딩 상태
  const [isSaving, setIsSaving] = React.useState<boolean>(false);

  // 모달 열릴 때 초기화
  React.useEffect(() => {
    if (isOpen) {
      if (currentTeacherName && timetableData.teachers.some(t => t.teacherName === currentTeacherName)) {
        setSelectedTeacherName(currentTeacherName);
      } else if (!selectedTeacherName && timetableData.teachers.length > 0) {
        setSelectedTeacherName(timetableData.teachers[0].teacherName);
      }
      setReason('');
      setSourceDate(new Date().toISOString().split('T')[0]);
      setItems([]);
    }
  }, [isOpen, currentTeacherName, timetableData]);

  const currentTeacher = React.useMemo(() => {
    return timetableData.teachers.find(t => t.teacherName === selectedTeacherName) || timetableData.teachers[0];
  }, [timetableData, selectedTeacherName]);

  const sourceDay = React.useMemo(() => getDayOfWeekFromDate(sourceDate), [sourceDate]);

  // 해당 일자/요일의 교사 수업 슬롯 목록
  const daySlots = React.useMemo(() => {
    if (!currentTeacher || !sourceDay) return [];
    const list: { period: number; slot: TimetableSlot }[] = [];
    for (let p = 1; p <= 7; p++) {
      const slot = currentTeacher.slots[`${sourceDay}_${p}`];
      if (slot && (slot.subjectName || slot.classCode)) {
        list.push({ period: p, slot });
      }
    }
    return list;
  }, [currentTeacher, sourceDay]);

  // 수업 슬롯 토글 (선택/해제)
  const toggleSlot = (period: number, slot: TimetableSlot) => {
    const existingIndex = items.findIndex(it => it.sourcePeriod === period);
    if (existingIndex >= 0) {
      setItems(prev => prev.filter((_, idx) => idx !== existingIndex));
    } else {
      const newItem: SubstituteItem = {
        id: `item-${Date.now()}-${period}`,
        sourceDate,
        sourceDay,
        sourcePeriod: period,
        deptName: slot.deptName || currentTeacher?.remarks || '전문교과',
        classCode: slot.classCode || '',
        subjectName: slot.subjectName || '',
        originalTeacher: selectedTeacherName,
        type: 'substitute', // 기본값: 보강
        substituteTeacher: '',
      };
      setItems(prev => [...prev, newItem].sort((a, b) => a.sourcePeriod - b.sourcePeriod));
    }
  };

  // 개별 아이템 필드 변경 핸들러
  const updateItem = (id: string, updates: Partial<SubstituteItem>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...updates } : it));
  };

  // 아이템 삭제
  const removeItem = (id: string) => {
    setItems(prev => prev.filter(it => it.id !== id));
  };

  // 전체 충돌 검사
  const conflicts = React.useMemo(() => {
    return items.map(it => {
      const res = checkSubstituteItemConflict(it, timetableData, existingApplications);
      return { id: it.id, ...res };
    });
  }, [items, timetableData, existingApplications]);

  const hasAnyConflict = conflicts.some(c => c.hasConflict);

  // 저장 및 제출 핸들러
  const handleSave = async (submitImmediately = false) => {
    if (!reason.trim()) {
      alert('신청 사유를 입력해 주세요.');
      return;
    }
    if (items.length === 0) {
      alert('교체 또는 보강할 수업 슬롯을 최소 1개 이상 선택해 주세요.');
      return;
    }
    if (hasAnyConflict) {
      alert('충돌이 발생하는 수업이 포함되어 있습니다. 내용을 확인해 주세요.');
      return;
    }

    // 미입력 필드 검사
    for (const it of items) {
      if (it.type === 'substitute' && !it.substituteTeacher) {
        alert(`${it.sourcePeriod}교시 보강 교사를 지정해 주세요.`);
        return;
      }
      if (it.type === 'exchange' && (!it.targetDate || !it.targetPeriod || !it.targetTeacher)) {
        alert(`${it.sourcePeriod}교시 교체할 일자, 교시 및 교사를 모두 지정해 주세요.`);
        return;
      }
    }

    try {
      setIsSaving(true);
      const app: SubstituteApplication = {
        id: `app-${Date.now()}`,
        applicationNumber: '',
        academicYear: timetableData.academicYear || 2026,
        semester: timetableData.semester || 2,
        applicantTeacher: selectedTeacherName,
        reason: reason.trim(),
        periodStart: items[0]?.sourceDate || sourceDate,
        periodEnd: items[items.length - 1]?.sourceDate || sourceDate,
        applicationDate: todayStr,
        status: submitImmediately ? 'submitted' : 'draft',
        items,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        submittedAt: submitImmediately ? new Date().toISOString() : undefined,
      };

      await onSave(app, submitImmediately);
      onClose();
    } catch (err: any) {
      alert(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6 rounded-3xl border-slate-200">
        <DialogHeader className="border-b border-slate-100 pb-4">
          <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-indigo-600" />
            수업 교체 및 보강 신청
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-1">
            수업 결강 사유와 대상 슬롯을 선택하면 공강 교사가 자동 추천되며 실시간 충돌을 완벽 방지합니다.
          </p>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* 1. 신청 교사 & 사유 입력 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
            <div>
              <label className="text-xs font-black text-slate-700 block mb-1.5 flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-indigo-600" />
                신청 교사
              </label>
              <Select value={selectedTeacherName} onValueChange={setSelectedTeacherName}>
                <SelectTrigger className="h-10 text-xs font-bold bg-white border-slate-200 rounded-xl">
                  <SelectValue placeholder="교사 선택" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {timetableData.teachers.map(t => (
                    <SelectItem key={t.teacherName} value={t.teacherName} className="text-xs">
                      <span className="font-bold">{t.teacherName}</span>
                      {t.homeroomClass && <span className="text-indigo-600 font-bold ml-1">({t.homeroomClass})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-black text-slate-700 block mb-1.5 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                결강 / 변경 일자
              </label>
              <Input
                type="date"
                value={sourceDate}
                onChange={e => {
                  setSourceDate(e.target.value);
                  setItems([]);
                }}
                className="h-10 text-xs font-bold bg-white border-slate-200 rounded-xl"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-black text-slate-700 block mb-1.5 flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 text-indigo-600" />
                신청 사유
              </label>
              <Input
                placeholder="신청 사유를 입력하거나 아래 빠른 사유를 선택하세요..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="h-10 text-xs bg-white border-slate-200 rounded-xl mb-2"
              />
              <div className="flex flex-wrap gap-1.5">
                {COMMON_REASONS.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 text-slate-600 hover:text-indigo-700 hover:border-indigo-200 transition-all font-medium"
                  >
                    + {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. 해당 일자의 시간표 수업 슬롯 선택 */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-indigo-600" />
                {sourceDate} ({sourceDay}요일) 수업 슬롯 선택
              </h4>
              <span className="text-[11px] text-slate-500 font-medium">
                클릭하여 교체/보강할 수업을 선택하세요.
              </span>
            </div>

            {daySlots.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 text-center text-xs text-slate-400 border border-dashed border-slate-200">
                선택하신 {sourceDate}({sourceDay}요일)에는 {selectedTeacherName} 선생님의 정규 수업이 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {daySlots.map(({ period, slot }) => {
                  const isSelected = items.some(it => it.sourcePeriod === period);
                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => toggleSlot(period, slot)}
                      className={cn(
                        "p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-between gap-1 shadow-2xs",
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-600 ring-offset-1 scale-[1.02]"
                          : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50 hover:border-indigo-300"
                      )}
                    >
                      <span className={cn(
                        "text-[10.5px] font-black px-1.5 py-0.5 rounded-md",
                        isSelected ? "bg-indigo-700 text-white" : "bg-slate-100 text-slate-600"
                      )}>
                        {period}교시
                      </span>
                      <strong className="text-xs font-black tracking-tight mt-0.5">
                        {slot.subjectName}
                      </strong>
                      <span className={cn(
                        "text-[11px] font-bold",
                        isSelected ? "text-indigo-200" : "text-indigo-600"
                      )}>
                        {slot.classCode}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. 선택된 수업의 교체 / 보강 세부 설정 카드 목록 */}
          {items.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-indigo-600" />
                선택된 수업 상세 처리 ({items.length}건)
              </h4>

              {items.map((item, idx) => {
                const itemConflict = conflicts.find(c => c.id === item.id);
                // 실시간 추천 공강 교사 목록 추출
                const availableTeachers = getAvailableTeachersForSlot(
                  item.sourceDate,
                  item.sourcePeriod,
                  timetableData,
                  existingApplications,
                  item.deptName
                );

                return (
                  <div 
                    key={item.id} 
                    className={cn(
                      "p-4 rounded-2xl border transition-all space-y-3 bg-white",
                      itemConflict?.hasConflict 
                        ? "border-rose-300 bg-rose-50/30" 
                        : "border-slate-200 shadow-2xs"
                    )}
                  >
                    {/* 상단 헤더: 교시 정보 + 유형 탭 */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-lg font-black text-xs bg-slate-900 text-white">
                          {item.sourcePeriod}교시
                        </span>
                        <strong className="text-xs font-black text-slate-900">
                          {item.subjectName} ({item.classCode})
                        </strong>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {item.deptName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* 유형 선택 (수업교체 vs 보강) */}
                        <div className="bg-slate-100 p-0.5 rounded-xl flex items-center text-xs font-bold">
                          <button
                            type="button"
                            onClick={() => updateItem(item.id, { type: 'substitute' })}
                            className={cn(
                              "px-3 py-1 rounded-lg transition-all flex items-center gap-1",
                              item.type === 'substitute' 
                                ? "bg-white text-indigo-900 shadow-xs font-black" 
                                : "text-slate-500 hover:text-slate-800"
                            )}
                          >
                            <UserPlus className="h-3 w-3" />
                            보강 / 대강
                          </button>
                          <button
                            type="button"
                            onClick={() => updateItem(item.id, { type: 'exchange' })}
                            className={cn(
                              "px-3 py-1 rounded-lg transition-all flex items-center gap-1",
                              item.type === 'exchange' 
                                ? "bg-white text-indigo-900 shadow-xs font-black" 
                                : "text-slate-500 hover:text-slate-800"
                            )}
                          >
                            <ArrowLeftRight className="h-3 w-3" />
                            수업 교체
                          </button>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(item.id)}
                          className="h-8 w-8 text-slate-400 hover:text-rose-600 rounded-lg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* 세부 입력: 보강 vs 교체 */}
                    {item.type === 'substitute' ? (
                      <div className="bg-indigo-50/40 p-3 rounded-xl border border-indigo-100/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-black text-indigo-950 flex items-center gap-1">
                            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                            추천 공강 교사 선택 ({availableTeachers.length}명 공강)
                          </label>
                        </div>
                        <Select 
                          value={item.substituteTeacher} 
                          onValueChange={val => updateItem(item.id, { substituteTeacher: val })}
                        >
                          <SelectTrigger className="h-9 text-xs font-bold bg-white border-indigo-200 rounded-xl text-slate-800">
                            <SelectValue placeholder="보강 교사를 선택하세요..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {availableTeachers.map(t => (
                              <SelectItem key={t.teacherName} value={t.teacherName} className="text-xs">
                                <span className="font-bold text-slate-900">{t.teacherName} 선생님</span>
                                {t.homeroomClass && <span className="ml-1 text-indigo-600 font-bold">({t.homeroomClass} 담임)</span>}
                                {t.isSameDept && <span className="ml-1.5 text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">동일교과군</span>}
                                <span className="ml-auto text-[10px] text-slate-400"> (누적 보강 {t.totalSubstitutesDone}회)</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="bg-rose-50/40 p-3 rounded-xl border border-rose-100/80 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="text-[11px] font-black text-rose-950 block mb-1">
                            교체 대상 날짜
                          </label>
                          <Input
                            type="date"
                            value={item.targetDate || ''}
                            onChange={e => {
                              const tDate = e.target.value;
                              const tDay = getDayOfWeekFromDate(tDate);
                              updateItem(item.id, { targetDate: tDate, targetDay: tDay });
                            }}
                            className="h-8 text-xs bg-white border-rose-200 rounded-lg"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-black text-rose-950 block mb-1">
                            교체 대상 교시
                          </label>
                          <Select
                            value={item.targetPeriod ? String(item.targetPeriod) : ''}
                            onValueChange={val => updateItem(item.id, { targetPeriod: parseInt(val) })}
                          >
                            <SelectTrigger className="h-8 text-xs bg-white border-rose-200 rounded-lg">
                              <SelectValue placeholder="교시 선택" />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 5, 6, 7].map(p => (
                                <SelectItem key={p} value={String(p)} className="text-xs font-bold">
                                  {p}교시
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="text-[11px] font-black text-rose-950 block mb-1">
                            교체 대상 교사
                          </label>
                          <Select
                            value={item.targetTeacher || ''}
                            onValueChange={val => updateItem(item.id, { targetTeacher: val })}
                          >
                            <SelectTrigger className="h-8 text-xs bg-white border-rose-200 rounded-lg">
                              <SelectValue placeholder="교사 선택" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              <SelectItem value={selectedTeacherName} className="text-xs font-bold text-indigo-700">
                                🔄 본인 수업 자체 이동 ({selectedTeacherName})
                              </SelectItem>
                              {timetableData.teachers.filter(t => t.teacherName !== selectedTeacherName).map(t => (
                                <SelectItem key={t.teacherName} value={t.teacherName} className="text-xs">
                                  {t.teacherName} 선생님 {t.homeroomClass && `(${t.homeroomClass})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* 충돌 상태 신호등 표시 */}
                    {itemConflict?.hasConflict ? (
                      <div className="flex items-center gap-1.5 text-rose-600 text-xs font-bold bg-rose-50 p-2 rounded-xl border border-rose-200">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>{itemConflict.message}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold bg-emerald-50/70 p-2 rounded-xl border border-emerald-200">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>안전: 수업 겹침이나 교사 중복 없이 정상 배정 가능합니다.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-10 text-xs font-bold text-slate-600"
          >
            취소
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={isSaving || hasAnyConflict || items.length === 0}
              className="h-10 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              임시 저장
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={isSaving || hasAnyConflict || items.length === 0}
              className="h-10 text-xs font-bold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20"
            >
              <FileText className="h-4 w-4" />
              수업계 공식 제출 & 신청서 생성
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
