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
import { 
  DAYS_OF_WEEK, 
  parseClassCode, 
  getActivityInfo, 
  ActivityWeightConfig, 
  DEFAULT_ACTIVITY_WEIGHTS,
  DEPARTMENT_CODE_MAP,
  getClassDeptBadgeStyle
} from '@/lib/timetable/constants';
import { 
  AcademicCalendarConfig, 
  DEFAULT_ACADEMIC_CALENDAR_2026_2 
} from '@/lib/substitute/event-types';
import { 
  getVacationForDate,
  getSpecialDaySchedule,
  getExamPeriodForDate,
  getExamSlotInfo,
  getEventsForSlot,
  getClassEventsForSlot
} from '@/lib/substitute/event-helper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  Search,
  Palmtree,
  FileEdit,
  X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SubstituteWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (app: SubstituteApplication, submitImmediately?: boolean) => Promise<void>;
  timetableData: ParsedTimetableResult;
  existingApplications: SubstituteApplication[];
  calendarConfig?: AcademicCalendarConfig;
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
  calendarConfig = DEFAULT_ACADEMIC_CALENDAR_2026_2,
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

  const rawSourceDay = React.useMemo(() => getDayOfWeekFromDate(sourceDate), [sourceDate]);
  
  // 대체 요일 스케줄 검사
  const specialDay = React.useMemo(() => {
    return getSpecialDaySchedule(sourceDate, calendarConfig);
  }, [sourceDate, calendarConfig]);

  // 실제 적용되는 요일 (대체 요일이 있으면 대체 요일 시간표 적용)
  const sourceDay = specialDay ? specialDay.targetDayOfWeek : rawSourceDay;

  // 방학 및 시험 기간 검사
  const vacation = React.useMemo(() => getVacationForDate(sourceDate, calendarConfig), [sourceDate, calendarConfig]);
  const examPeriod = React.useMemo(() => getExamPeriodForDate(sourceDate, calendarConfig), [sourceDate, calendarConfig]);

  // 해당 일자/요일의 교사 수업 슬롯 목록 (학사일정 및 기존 교체/보강 변동사항 100% 반영)
  const daySlots = React.useMemo(() => {
    if (!currentTeacher || !sourceDay || vacation) return [];

    const effectivePeriodOverride = specialDay?.periodOverrides || {};
    const shortenedPeriods = specialDay?.shortenedPeriods;

    // 해당 날짜(sourceDate)에 선택된 교사(selectedTeacherName)의 실시간 결보강 변경 내역 매핑
    const activeApps = existingApplications.filter(app => app.status !== 'rejected');
    const dayModifications: Record<number, {
      type: 'exchange_out' | 'exchange_in' | 'absence_substitute' | 'teaching_substitute';
      partnerTeacher: string;
      originalTeacher?: string;
      subjectName?: string;
      classCode?: string;
      deptName?: string;
      status: 'approved' | 'submitted';
      appNumber: string;
    }> = {};

    activeApps.forEach(app => {
      const appStatus = app.status === 'approved' ? 'approved' : 'submitted';
      app.items.forEach(it => {
        // 1) 보강
        if (it.type === 'substitute') {
          if (it.originalTeacher === selectedTeacherName && it.sourceDate === sourceDate) {
            dayModifications[it.sourcePeriod] = {
              type: 'absence_substitute',
              partnerTeacher: it.substituteTeacher || '보강교사',
              originalTeacher: it.originalTeacher,
              status: appStatus,
              appNumber: app.applicationNumber,
            };
          }
          if (it.substituteTeacher === selectedTeacherName && it.sourceDate === sourceDate) {
            dayModifications[it.sourcePeriod] = {
              type: 'teaching_substitute',
              partnerTeacher: it.originalTeacher,
              originalTeacher: it.originalTeacher,
              subjectName: it.subjectName,
              classCode: it.classCode,
              deptName: it.deptName,
              status: appStatus,
              appNumber: app.applicationNumber,
            };
          }
        }
        // 2) 맞교환
        if (it.type === 'exchange') {
          // (a) 내가 신청자
          if (app.applicantTeacher === selectedTeacherName) {
            if (it.sourceDate === sourceDate) {
              dayModifications[it.sourcePeriod] = {
                type: 'exchange_out',
                partnerTeacher: it.targetTeacher || '교체교사',
                originalTeacher: it.originalTeacher,
                status: appStatus,
                appNumber: app.applicationNumber,
              };
            }
            if (it.targetDate === sourceDate && it.targetPeriod) {
              dayModifications[it.targetPeriod] = {
                type: 'exchange_in',
                partnerTeacher: it.targetTeacher || '교체교사',
                originalTeacher: it.targetTeacher,
                subjectName: it.targetSubject || it.subjectName,
                classCode: it.classCode,
                deptName: it.deptName,
                status: appStatus,
                appNumber: app.applicationNumber,
              };
            }
          }
          // (b) 내가 교체 대상자
          if (it.targetTeacher === selectedTeacherName && app.applicantTeacher !== selectedTeacherName) {
            if (it.targetDate === sourceDate && it.targetPeriod) {
              dayModifications[it.targetPeriod] = {
                type: 'exchange_out',
                partnerTeacher: app.applicantTeacher,
                originalTeacher: it.targetTeacher,
                status: appStatus,
                appNumber: app.applicationNumber,
              };
            }
            if (it.sourceDate === sourceDate) {
              dayModifications[it.sourcePeriod] = {
                type: 'exchange_in',
                partnerTeacher: app.applicantTeacher,
                originalTeacher: app.applicantTeacher,
                subjectName: it.subjectName,
                classCode: it.classCode,
                deptName: it.deptName,
                status: appStatus,
                appNumber: app.applicationNumber,
              };
            }
          }
        }
      });
    });

    const list: {
      period: number;
      slot: TimetableSlot;
      isExchangeIn?: boolean;
      isExchangeOut?: boolean;
      isTeachingSub?: boolean;
      isAbsenceSub?: boolean;
      partnerTeacher?: string;
      isPending?: boolean;
      effectiveStatus?: 'approved' | 'submitted';
    }[] = [];

    for (let p = 1; p <= 7; p++) {
      if (shortenedPeriods && p > shortenedPeriods) continue;

      const targetPeriod = effectivePeriodOverride[p] ?? p;
      const key = `${sourceDay}_${targetPeriod}`;
      const regularSlot = currentTeacher.slots[key];
      const mod = dayModifications[p];

      // 1) 교체받아 들어온 수업이거나 내가 맡은 보강 수업 (새로운 유효 수업!)
      if (mod && (mod.type === 'exchange_in' || mod.type === 'teaching_substitute')) {
        const slot: TimetableSlot = {
          id: `mod-${p}`,
          teacherName: selectedTeacherName,
          homeroomClass: currentTeacher.homeroomClass || '',
          day: sourceDay,
          period: p,
          subjectName: mod.subjectName || regularSlot?.subjectName || '교체수업',
          classCode: mod.classCode || regularSlot?.classCode || '',
          deptName: mod.deptName || regularSlot?.deptName || '전체',
          grade: 1,
          classNum: 1,
          weight: 1,
          isActivity: false,
          activityType: '수업',
        };
        list.push({
          period: p,
          slot,
          isExchangeIn: mod.type === 'exchange_in',
          isTeachingSub: mod.type === 'teaching_substitute',
          partnerTeacher: mod.partnerTeacher,
          effectiveStatus: mod.status,
          isPending: mod.status === 'submitted',
        });
        continue;
      }

      // 2) 내가 다른 사람에게 넘겨준 수업 (교체 나감 또는 결강 처리됨)
      if (mod && (mod.type === 'exchange_out' || mod.type === 'absence_substitute')) {
        if (regularSlot && regularSlot.subjectName) {
          list.push({
            period: p,
            slot: regularSlot,
            isExchangeOut: mod.type === 'exchange_out',
            isAbsenceSub: mod.type === 'absence_substitute',
            partnerTeacher: mod.partnerTeacher,
            effectiveStatus: mod.status,
            isPending: mod.status === 'submitted',
          });
        }
        continue;
      }

      // 3) 교사 인솔 행사 검사
      const teacherEvents = getEventsForSlot(sourceDate, p, undefined, selectedTeacherName, calendarConfig);
      if (teacherEvents.length > 0) {
        list.push({
          period: p,
          slot: {
            id: `event-${p}`,
            teacherName: selectedTeacherName,
            homeroomClass: currentTeacher.homeroomClass || '',
            day: sourceDay,
            period: p,
            subjectName: `[행사] ${teacherEvents[0].title}`,
            classCode: '전체',
            deptName: '전체',
            grade: 1,
            classNum: 1,
            weight: 1,
            isActivity: true,
            activityType: '행사',
          }
        });
        continue;
      }

      // 4) 비인솔 교사의 수업 학급 학생들이 행사에 참여하여 수업이 없어진 경우 -> 수업 없음(공강!)
      if (regularSlot?.classCode) {
        const classEvents = getClassEventsForSlot(sourceDate, p, regularSlot.classCode, calendarConfig);
        if (classEvents.length > 0) {
          continue; // 학생들이 행사에 가서 수업이 취소되었으므로 신청 목록에서 제외(공강)
        }
      }

      // 5) 일반 정규 수업
      if (regularSlot && regularSlot.subjectName && regularSlot.subjectName.trim() !== '' && regularSlot.subjectName !== '-' && regularSlot.subjectName !== '공강') {
        list.push({
          period: p,
          slot: regularSlot,
        });
      }
    }

    return list;
  }, [currentTeacher, sourceDay, vacation, specialDay, sourceDate, existingApplications, selectedTeacherName]);

  // 슬롯 선택/해제 토글
  const toggleSlot = (period: number, slot: TimetableSlot, isLocked?: boolean) => {
    if (isLocked) return;
    const exists = items.some(it => it.sourcePeriod === period);
    if (exists) {
      setItems(prev => prev.filter(it => it.sourcePeriod !== period));
    } else {
      const newItem: SubstituteItem = {
        id: `item-${Date.now()}-${period}`,
        sourceDate,
        sourceDay,
        sourcePeriod: period,
        deptName: slot.deptName || '',
        classCode: slot.classCode || '',
        subjectName: slot.subjectName || '',
        originalTeacher: selectedTeacherName,
        type: 'exchange', // 교체 편의를 위해 기본 exchange 모드
        substituteTeacher: '',
      };
      setItems(prev => [...prev, newItem].sort((a, b) => a.sourcePeriod - b.sourcePeriod));
    }
  };

  // 특정 항목 업데이트
  const updateItem = (id: string, updates: Partial<SubstituteItem>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...updates } : it));
  };

  // 특정 항목 삭제
  const removeItem = (id: string) => {
    setItems(prev => prev.filter(it => it.id !== id));
  };

  // 전체 항목에 대한 충돌 검증
  const conflicts = React.useMemo(() => {
    return items.map(item => {
      const result = checkSubstituteItemConflict(
        item,
        timetableData,
        existingApplications,
        undefined,
        calendarConfig
      );
      return { id: item.id, ...result };
    });
  }, [items, timetableData, existingApplications, calendarConfig]);

  const hasAnyConflict = conflicts.some(c => c.hasConflict);

  // 저장 / 제출 핸들러
  const handleSave = async (submitImmediately: boolean) => {
    if (!selectedTeacherName) {
      alert('신청 교사를 선택해 주세요.');
      return;
    }
    if (!reason.trim()) {
      alert('신청 사유를 입력해 주세요.');
      return;
    }
    if (items.length === 0) {
      alert('교체 또는 보강할 수업 슬롯을 최소 1개 이상 선택해 주세요.');
      return;
    }

    // 미입력 항목 검사
    for (const it of items) {
      if (it.type === 'substitute' && !it.substituteTeacher) {
        alert(`${it.sourcePeriod}교시 보강 교사를 선택해 주세요.`);
        return;
      }
      if (it.type === 'exchange') {
        if (!it.targetDate || !it.targetPeriod || !it.targetTeacher) {
          alert(`${it.sourcePeriod}교시 교체 대상 날짜, 교시, 교사를 모두 입력해 주세요.`);
          return;
        }
      }
    }

    if (hasAnyConflict) {
      alert('시간표 충돌이 있는 교시가 있습니다. 충돌 내용을 확인하고 다시 시도해 주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const app: SubstituteApplication = {
        id: `app-${Date.now()}`,
        applicationNumber: `SUB-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
        academicYear: calendarConfig?.academicYear || 2026,
        semester: calendarConfig?.semester || 2,
        applicantTeacher: selectedTeacherName,
        reason: reason.trim(),
        periodStart: sourceDate,
        periodEnd: sourceDate,
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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 border-none shadow-2xl rounded-2xl overflow-hidden bg-white">
        {/* 1. 표준 모달 상단 헤더 */}
        <DialogHeader className="p-4 sm:p-6 bg-white border-b border-slate-100 shrink-0 flex flex-row items-center justify-start text-left w-full">
          <div className="flex items-center gap-3.5 text-left justify-start">
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0 shadow-sm">
              <ArrowLeftRight className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div className="flex flex-col items-start text-left">
              <div className="flex items-center gap-2 text-left">
                <DialogTitle className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight text-left">
                  수업 결보강 & 교체 신청
                </DialogTitle>
                <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200/60 text-xs px-2.5 py-0.5 rounded-md font-bold">
                  스마트 추천 시스템
                </Badge>
              </div>
              <DialogDescription className="text-slate-500 text-xs sm:text-sm font-medium mt-1 text-left">
                수업 결강 사유와 시간표 슬롯을 선택하면 동교과/동일학과 공강 교사가 자동 추천되며 실시간 충돌을 완벽 방지합니다.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* 2. 모달 본체 (스크롤 가능 영역) */}
        <div className="p-5 sm:p-6 space-y-5 bg-white flex-1 overflow-y-auto custom-scrollbar">
          {/* 통일된 가이드 안내 카드 (attendance-import-modal 테마) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-xs text-slate-700">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0 mt-0.5 border border-indigo-100">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h5 className="text-sm font-extrabold text-slate-900">수업 결보강 & 교체 스마트 신청 가이드</h5>
              <div className="text-xs leading-relaxed text-slate-600 space-y-0.5 font-medium">
                <p>• 신청 교사와 결강 일자를 선택하면 해당 날짜의 <strong className="text-slate-900 font-bold">정규 수업 시간표</strong>가 자동 로드됩니다.</p>
                <p>• 수업 슬롯 클릭 시 <strong className="text-slate-900 font-bold">[★ 동일교과 &gt; 동일학과]</strong> 순으로 해당 교시 공강 교사를 자동 추천합니다.</p>
                <p>• 실시간 3중 충돌 검증을 통과한 후 <strong className="text-slate-900 font-bold">[수업계 결재 상신]</strong>을 진행하시면 전자결재 신청서가 생성됩니다.</p>
              </div>
            </div>
          </div>

          {/* 섹션 1: 신청 교사, 일자 & 사유 */}
          <div className="bg-slate-50/50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
              <User className="h-3.5 w-3.5 text-indigo-600" />
              1. 기본 신청 정보
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-[11px] font-black text-slate-700 block mb-1">
                  신청 교사
                </label>
                <Select value={selectedTeacherName} onValueChange={setSelectedTeacherName}>
                  <SelectTrigger className="h-9.5 text-xs font-bold bg-white border-slate-200 rounded-xl">
                    <SelectValue placeholder="교사 선택" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 rounded-xl shadow-lg border-slate-200">
                    {timetableData.teachers.map(t => (
                      <SelectItem key={t.teacherName} value={t.teacherName} className="text-xs font-bold">
                        <span>{t.teacherName} 선생님</span>
                        {t.subjectGroup && <span className="text-slate-500 text-[10px] ml-1.5">[{t.subjectGroup}]</span>}
                        {t.homeroomClass && <span className="text-indigo-600 text-[10px] ml-1">({t.homeroomClass})</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-700 block mb-1">
                  결강 / 변경 일자
                </label>
                <Input
                  type="date"
                  value={sourceDate}
                  onChange={e => {
                    setSourceDate(e.target.value);
                    setItems([]);
                  }}
                  className="h-9.5 text-xs font-bold bg-white border-slate-200 rounded-xl"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 block">
                  신청 사유
                </label>
                <Input
                  placeholder="신청 사유를 입력하거나 아래 빠른 사유를 선택하세요..."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="h-9.5 text-xs bg-white border-slate-200 rounded-xl"
                />
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {COMMON_REASONS.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className="text-[10.5px] px-2 py-0.5 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 text-slate-600 hover:text-indigo-700 hover:border-indigo-200 transition-all font-medium cursor-pointer"
                    >
                      + {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 섹션 2: 해당 일자의 시간표 수업 슬롯 선택 */}
          <div className="bg-slate-50/50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                <Clock className="h-3.5 w-3.5 text-indigo-600" />
                2. 대상 수업 선택 ({sourceDate} · {sourceDay}요일)
              </h4>
              <span className="text-[11px] text-slate-500 font-medium">
                교체 또는 보강할 수업 슬롯을 클릭하여 선택하세요
              </span>
            </div>

            {daySlots.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-white">
                선택하신 {sourceDate} ({sourceDay}요일)에는 {selectedTeacherName} 선생님의 정규 수업이 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {daySlots.map(({ period, slot, isExchangeIn, isExchangeOut, isTeachingSub, isAbsenceSub, partnerTeacher, isPending, effectiveStatus }) => {
                  const isSelected = items.some(it => it.sourcePeriod === period);
                  const isPassedToOther = isExchangeOut || isAbsenceSub;
                  const isLocked = isPassedToOther || isPending;

                  return (
                    <button
                      key={period}
                      type="button"
                      disabled={isLocked}
                      onClick={() => toggleSlot(period, slot, isLocked)}
                      title={
                        isPending
                          ? `현재 결재 진행 중인 수업으로 결재 승인 전에는 변경이 불가합니다.`
                          : isExchangeOut
                          ? `이미 ${partnerTeacher} 선생님과 교체 완료된 수업입니다. (선택 불가)`
                          : isAbsenceSub
                          ? `이미 ${partnerTeacher} 선생님께 보강 배정된 수업입니다. (선택 불가)`
                          : isExchangeIn
                          ? `(${partnerTeacher} 교체 수업) 클릭하여 다른 교사와 다시 재교체 신청 가능`
                          : undefined
                      }
                      className={cn(
                        "p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-between gap-1 shadow-2xs relative",
                        isLocked && "cursor-not-allowed select-none border-dashed border-slate-300 bg-[repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9_6px,#e2e8f0_6px,#e2e8f0_12px)] opacity-90",
                        !isLocked && isExchangeIn && (isSelected ? "bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-500/30 shadow-md scale-[1.02]" : "bg-indigo-50/80 text-indigo-950 border-indigo-300 hover:bg-indigo-100/80 cursor-pointer"),
                        !isLocked && isTeachingSub && (isSelected ? "bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-500/30 shadow-md scale-[1.02]" : "bg-emerald-50/80 text-emerald-950 border-emerald-300 hover:bg-emerald-100/80 cursor-pointer"),
                        !isLocked && !isPassedToOther && !isExchangeIn && !isTeachingSub && (
                          isSelected
                            ? "bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-500/30 shadow-md scale-[1.02]"
                            : "bg-white text-slate-800 border-slate-200 hover:bg-indigo-50/50 hover:border-indigo-300 cursor-pointer"
                        )
                      )}
                    >
                      {/* 상태 뱃지 */}
                      {(isExchangeIn || isExchangeOut || isTeachingSub || isAbsenceSub) && (
                        <span className={cn(
                          "absolute -top-1.5 -right-1 text-[8px] px-1 py-0.1 rounded-full font-black shadow-xs z-10 leading-tight ring-1 ring-white/60",
                          isPending ? "bg-amber-500 text-white" : isExchangeIn ? "bg-indigo-600 text-white" : isTeachingSub ? "bg-emerald-600 text-white" : "bg-slate-700 text-white"
                        )}>
                          {isPending ? '⏳ 결재중' : isExchangeIn ? '🔄 교체수업' : isTeachingSub ? '✅ 보강' : '🔄 교체완료'}
                        </span>
                      )}

                      <span className={cn(
                        "text-[10px] font-black px-1.5 py-0.5 rounded-md",
                        isSelected ? "bg-indigo-700/80 text-white" : "bg-slate-100 text-slate-600"
                      )}>
                        {period}교시
                      </span>

                      <strong className={cn(
                        "text-xs font-extrabold tracking-tight mt-0.5 truncate max-w-full",
                        isPassedToOther ? "text-slate-700 line-through decoration-slate-400" : isSelected ? "text-white" : "text-slate-900"
                      )}>
                        {slot.subjectName}
                      </strong>

                      <div className="flex items-center gap-1">
                        <span className={cn(
                          "text-[9.5px] px-1.5 py-0.2 rounded font-black",
                          isSelected ? "bg-white/20 text-white" : isPassedToOther ? "text-slate-600 bg-slate-200" : getClassDeptBadgeStyle(slot.classCode).pill
                        )}>
                          {slot.classCode}
                        </span>
                        {partnerTeacher && (
                          <span className={cn(
                            "text-[8px] font-bold truncate max-w-[50px]",
                            isSelected ? "text-white/80" : isPassedToOther ? "text-slate-600" : "text-indigo-700"
                          )}>
                            ({partnerTeacher})
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 섹션 3: 선택된 수업의 교체 / 보강 세부 설정 카드 목록 */}
          {items.length > 0 && (
            <div className="bg-slate-50/50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5">
              <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                <Layers className="h-3.5 w-3.5 text-indigo-600" />
                3. 선택된 수업 교체 및 보강 배정 ({items.length}건)
              </h4>

              <div className="space-y-3">
                {items.map((item) => {
                  const itemConflict = conflicts.find(c => c.id === item.id);
                  // 실시간 추천 공강 교사 목록 추출 (🌟 동일교과 > 동일학과 순서 정렬)
                  const availableTeachers = getAvailableTeachersForSlot(
                    item.sourceDate,
                    item.sourcePeriod,
                    timetableData,
                    existingApplications,
                    item.deptName,
                    selectedTeacherName,
                    item.subjectName,
                    item.classCode,
                    calendarConfig
                  );

                  return (
                    <div 
                      key={item.id} 
                      className={cn(
                        "p-4 rounded-2xl border transition-all space-y-3 bg-white shadow-2xs",
                        itemConflict?.hasConflict 
                          ? "border-rose-300 bg-rose-50/20" 
                          : "border-slate-200/90 hover:border-slate-300"
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
                          {/* 유형 선택 (수업보강 vs 수업교체) */}
                          <div className="bg-slate-100 p-0.5 rounded-xl flex items-center text-xs font-bold">
                            <button
                              type="button"
                              onClick={() => updateItem(item.id, { type: 'substitute' })}
                              className={cn(
                                "px-3 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer",
                                item.type === 'substitute' 
                                  ? "bg-white text-indigo-900 shadow-2xs font-black" 
                                  : "text-slate-500 hover:text-slate-800"
                              )}
                            >
                              <UserPlus className="h-3 w-3" />
                              보강
                            </button>
                            <button
                              type="button"
                              onClick={() => updateItem(item.id, { type: 'exchange' })}
                              className={cn(
                                "px-3 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer",
                                item.type === 'exchange' 
                                  ? "bg-white text-rose-900 shadow-2xs font-black" 
                                  : "text-slate-500 hover:text-slate-800"
                              )}
                            >
                              <ArrowLeftRight className="h-3 w-3" />
                              교체
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 transition-colors cursor-pointer rounded-lg hover:bg-rose-50"
                            title="삭제"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* 세부 입력: 보강 vs 교체 */}
                      {item.type === 'substitute' ? (
                        <div className="bg-indigo-50/40 p-3.5 rounded-xl border border-indigo-100 space-y-2">
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
                            <SelectContent className="max-h-60 rounded-xl shadow-lg border-slate-200">
                              {availableTeachers.map(t => (
                                <SelectItem key={t.teacherName} value={t.teacherName} className="text-xs font-medium">
                                  <span className="font-bold text-slate-900">{t.teacherName} 선생님</span>
                                  {t.homeroomClass && <span className="ml-1 text-indigo-600 font-bold">({t.homeroomClass} 담임)</span>}
                                  {t.isSameSubject ? (
                                    <span className="ml-1.5 text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-black border border-blue-200">★ 동일교과</span>
                                  ) : t.isSameDept ? (
                                    <span className="ml-1.5 text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-black border border-emerald-200">동일학과</span>
                                  ) : null}
                                  <span className="ml-auto text-[10px] text-slate-400"> (누적 보강 {t.totalSubstitutesDone}회)</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="bg-rose-50/40 p-3.5 rounded-xl border border-rose-100 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
                              className="h-8.5 text-xs bg-white border-rose-200 rounded-xl font-bold"
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
                              <SelectTrigger className="h-8.5 text-xs bg-white border-rose-200 rounded-xl font-bold">
                                <SelectValue placeholder="교시 선택" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl shadow-lg border-slate-200">
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
                              <SelectTrigger className="h-8.5 text-xs bg-white border-rose-200 rounded-xl font-bold">
                                <SelectValue placeholder="교사 선택" />
                              </SelectTrigger>
                              <SelectContent className="max-h-60 rounded-xl shadow-lg border-slate-200">
                                <SelectItem value={selectedTeacherName} className="text-xs font-bold text-indigo-700">
                                  🔄 본인 수업 자체 이동 ({selectedTeacherName})
                                </SelectItem>
                                {timetableData.teachers.filter(t => t.teacherName !== selectedTeacherName).map(t => (
                                  <SelectItem key={t.teacherName} value={t.teacherName} className="text-xs font-medium">
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
                        <div className="flex items-center gap-1.5 text-rose-600 text-xs font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>{itemConflict.message}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          <span>안전: 시간표 겹침이나 교사 중복 없이 정상 배정 가능합니다.</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 3. 하단 모달 액션 바 (attendance-import-modal 테마) */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="text-xs font-bold text-slate-500">
            {items.length > 0 ? (
              <span>선택된 수업 <strong className="text-indigo-600 font-black">{items.length}건</strong></span>
            ) : (
              <span>수업 슬롯을 선택해 주세요</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 px-4 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl cursor-pointer"
            >
              취소
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={isSaving || hasAnyConflict || items.length === 0}
              className="h-9 px-4 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl cursor-pointer"
            >
              임시 저장
            </Button>
            <Button
              type="button"
              onClick={() => handleSave(true)}
              disabled={isSaving || hasAnyConflict || items.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 px-5 rounded-xl text-xs gap-1.5 shadow-md shadow-indigo-100 cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5" />
              수업계 결재 상신 (신청 완료)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
