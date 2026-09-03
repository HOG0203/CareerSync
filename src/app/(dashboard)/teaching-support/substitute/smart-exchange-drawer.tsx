'use client';

// ==============================================================================
// src/app/(dashboard)/teaching-support/substitute/smart-exchange-drawer.tsx
// 스마트 교체/보강 설정 패널 (듀얼 시간표 비교, 공강 추천, 충돌 검증, 원클릭 신청)
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
  getDayOfWeekFromDate,
  getUpcomingDateForDay,
  getSmartExchangeRecommendations,
  ExchangeRecommendation
} from '@/lib/substitute/validator';
import { PartnerTimetablePicker } from './partner-timetable-picker';
import { AcademicCalendarConfig } from '@/lib/substitute/event-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeftRight, 
  UserPlus, 
  Calendar, 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  Send, 
  X, 
  User, 
  Layers, 
  GraduationCap,
  ChevronRight,
  RefreshCw,
  Search
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface SmartExchangeDrawerProps {
  selectedSlotInfo: {
    day: string;
    period: number;
    slot: TimetableSlot;
  } | null;
  initialMode?: SubstituteType;
  onClose: () => void;
  onSaveApplication: (app: SubstituteApplication, submitImmediately?: boolean) => Promise<void>;
  timetableData: ParsedTimetableResult;
  existingApplications: SubstituteApplication[];
  calendarConfig?: AcademicCalendarConfig;
  currentTeacherName: string;
}

const REASON_CATEGORIES = [
  '출장',
  '연가',
  '병가',
  '지각',
  '조퇴',
  '외출',
  '연수',
  '기타입력',
] as const;

export function SmartExchangeDrawer({
  selectedSlotInfo,
  initialMode = 'substitute',
  onClose,
  onSaveApplication,
  timetableData,
  existingApplications,
  calendarConfig,
  currentTeacherName,
}: SmartExchangeDrawerProps) {
  const sourcePeriod = selectedSlotInfo?.period || 1;
  const slot = selectedSlotInfo?.slot || { subjectName: '', classCode: '', teacherName: '', deptName: '' };

  // 1. 기본 상태
  const [sourceDate, setSourceDate] = React.useState<string>(() => {
    return selectedSlotInfo ? getUpcomingDateForDay(selectedSlotInfo.day) : '';
  });

  const sourceDay = React.useMemo(() => {
    return getDayOfWeekFromDate(sourceDate) || selectedSlotInfo?.day || '월';
  }, [sourceDate, selectedSlotInfo]);

  const [mode, setMode] = React.useState<SubstituteType>(initialMode); // 'substitute' = 보강 부탁, 'exchange' = 수업 교체
  const [reasonCategory, setReasonCategory] = React.useState<string>('출장');
  const [customCategory, setCustomCategory] = React.useState<string>('');
  const [reasonDetail, setReasonDetail] = React.useState<string>('');
  const [teacherSearchQuery, setTeacherSearchQuery] = React.useState<string>('');

  // 보강인 경우
  const [substituteTeacher, setSubstituteTeacher] = React.useState<string>('');

  // 교체인 경우 (동료 교사와 맞교환)
  const [partnerTeacher, setPartnerTeacher] = React.useState<string>('');
  const [targetDate, setTargetDate] = React.useState<string>(sourceDate);
  const [targetPeriod, setTargetPeriod] = React.useState<number>(sourcePeriod === 7 ? 6 : sourcePeriod + 1);

  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  // 슬롯 변경 시 상태 초기화
  React.useEffect(() => {
    if (selectedSlotInfo) {
      const initialDate = getUpcomingDateForDay(selectedSlotInfo.day);
      setSourceDate(initialDate);
      setTargetDate(initialDate);
      setMode(initialMode);
      setReasonCategory('출장');
      setCustomCategory('');
      setReasonDetail('');
      setTeacherSearchQuery('');
    }
  }, [selectedSlotInfo, initialMode]);

  // 실시간 공강 교사 목록 (선택한 날짜와 교시 기준, 🌟 동일교과 > 동일학과 순서 정렬)
  const availableTeachers = React.useMemo(() => {
    return getAvailableTeachersForSlot(
      sourceDate,
      sourcePeriod,
      timetableData,
      existingApplications,
      slot.deptName,
      currentTeacherName,
      slot.subjectName,
      slot.classCode,
      calendarConfig
    );
  }, [sourceDate, sourcePeriod, timetableData, existingApplications, slot.deptName, currentTeacherName, slot.subjectName, slot.classCode, calendarConfig]);

  // 검색어 필터링된 공강 교사 목록
  const filteredAvailableTeachers = React.useMemo(() => {
    if (!teacherSearchQuery.trim()) return availableTeachers;
    const q = teacherSearchQuery.trim().toLowerCase();
    return availableTeachers.filter(t => 
      t.teacherName.toLowerCase().includes(q) ||
      (t.homeroomClass && t.homeroomClass.toLowerCase().includes(q)) ||
      (t.deptName && t.deptName.toLowerCase().includes(q))
    );
  }, [availableTeachers, teacherSearchQuery]);

  const [partnerSearchQuery, setPartnerSearchQuery] = React.useState<string>('');

  const filteredPartnerTeachers = React.useMemo(() => {
    const list = timetableData.teachers.filter(t => t.teacherName !== currentTeacherName);
    if (!partnerSearchQuery.trim()) return list;
    const q = partnerSearchQuery.trim().toLowerCase();
    return list.filter(t => 
      t.teacherName.toLowerCase().includes(q) ||
      (t.homeroomClass && t.homeroomClass.toLowerCase().includes(q))
    );
  }, [timetableData.teachers, currentTeacherName, partnerSearchQuery]);

  // 보강 교사 자동 동기화 (공강 교사 중 첫 번째 선택)
  React.useEffect(() => {
    if (availableTeachers.length > 0) {
      const isCurrentValid = availableTeachers.some(t => t.teacherName === substituteTeacher);
      if (!isCurrentValid) {
        setSubstituteTeacher(availableTeachers[0].teacherName);
      }
    } else {
      setSubstituteTeacher('');
    }
  }, [availableTeachers, substituteTeacher]);

  // AI 스마트 맞교환 추천 목록 (전체 교사 스캔 & 학급/교과 최적화)
  const smartRecommendations = React.useMemo(() => {
    if (mode !== 'exchange') return [];
    return getSmartExchangeRecommendations(
      sourceDate,
      sourcePeriod,
      slot,
      currentTeacherName,
      timetableData,
      existingApplications
    );
  }, [mode, sourceDate, sourcePeriod, slot, currentTeacherName, timetableData, existingApplications]);

  // 첫 번째 최우선 추천이 있으면 자동 선택
  React.useEffect(() => {
    if (mode === 'exchange' && smartRecommendations.length > 0 && !partnerTeacher) {
      const top = smartRecommendations[0];
      setPartnerTeacher(top.partnerTeacher);
      setTargetDate(top.targetDate);
      setTargetPeriod(top.targetPeriod);
    }
  }, [mode, smartRecommendations, partnerTeacher]);

  // 동료 교사 시간표 요약
  const partnerTeacherSummary = React.useMemo(() => {
    return timetableData.teachers.find(t => t.teacherName === partnerTeacher);
  }, [timetableData.teachers, partnerTeacher]);

  // 동료 교사와의 최적 맞교환 가능 시간 추천 리스트
  const recommendedMatches = React.useMemo(() => {
    if (mode !== 'exchange' || !partnerTeacherSummary) return [];

    const matches: {
      day: string;
      period: number;
      partnerSubject?: string;
      partnerClass?: string;
      isRecommended: boolean;
      label: string;
    }[] = [];

    // 동료 교사의 주간 슬롯 중 교체 가능한 슬롯 탐색
    ['월', '화', '수', '목', '금'].forEach(d => {
      for (let p = 1; p <= 7; p++) {
        // 원래 슬롯과 동일하면 제외
        if (d === sourceDay && p === sourcePeriod) continue;

        const partnerSlot = partnerTeacherSummary.slots[`${d}_${p}`];
        // 동료 교사가 해당 시간에 공강이거나 수업이 있는 경우
        matches.push({
          day: d,
          period: p,
          partnerSubject: partnerSlot?.subjectName,
          partnerClass: partnerSlot?.classCode,
          isRecommended: !partnerSlot || !partnerSlot.subjectName,
          label: partnerSlot?.subjectName 
            ? `${d}요일 ${p}교시 (${partnerSlot.subjectName} [${partnerSlot.classCode}]) 맞교환`
            : `${d}요일 ${p}교시 (${partnerTeacher} 선생님 공강 시간대 활용)`
        });
      }
    });

    return matches;
  }, [mode, partnerTeacherSummary, sourceDay, sourcePeriod, partnerTeacher]);

  // 현재 입력 상태로 단일 아이템 생성 및 충돌 검증
  const currentItem: SubstituteItem = React.useMemo(() => {
    const curTargetDay = getDayOfWeekFromDate(targetDate);
    const pSummary = timetableData.teachers.find(t => t.teacherName === partnerTeacher);
    const pSlot = pSummary?.slots[`${curTargetDay}_${targetPeriod}`];

    return {
      id: `item-${Date.now()}`,
      sourceDate,
      sourceDay,
      sourcePeriod,
      deptName: slot.deptName || '전문교과',
      classCode: slot.classCode || '',
      subjectName: slot.subjectName || '',
      originalTeacher: currentTeacherName,
      type: mode,
      substituteTeacher: mode === 'substitute' ? substituteTeacher : undefined,
      targetDate: mode === 'exchange' ? targetDate : undefined,
      targetDay: mode === 'exchange' ? curTargetDay : undefined,
      targetPeriod: mode === 'exchange' ? targetPeriod : undefined,
      targetTeacher: mode === 'exchange' ? partnerTeacher : undefined,
      targetSubject: mode === 'exchange' ? (pSlot?.subjectName || '') : undefined,
      targetClass: mode === 'exchange' ? (pSlot?.classCode || '') : undefined,
    };
  }, [
    sourceDate, sourceDay, sourcePeriod, slot, currentTeacherName,
    mode, substituteTeacher, targetDate, targetPeriod, partnerTeacher, timetableData.teachers
  ]);

  const conflictCheck = React.useMemo(() => {
    return checkSubstituteItemConflict(currentItem, timetableData, existingApplications, undefined, calendarConfig);
  }, [currentItem, timetableData, existingApplications, calendarConfig]);

  // 최종 저장 & 제출 핸들러
  const handleSubmit = async (submitImmediately = true) => {
    const activeCategory = reasonCategory === '기타입력' ? customCategory.trim() : reasonCategory;
    if (!activeCategory) {
      alert('사유 구분을 선택하거나 직접 입력해 주세요.');
      return;
    }
    const finalReason = reasonDetail.trim() ? `${activeCategory} (${reasonDetail.trim()})` : activeCategory;

    if (mode === 'substitute' && !substituteTeacher) {
      alert('보강을 담당해 주실 선생님을 선택해 주세요.');
      return;
    }
    if (mode === 'exchange') {
      if (!partnerTeacher) {
        alert('맞교환할 상대 선생님을 선택해 주세요.');
        return;
      }
      if (!targetDate || !targetPeriod) {
        alert('교체 대상 일자와 교시를 지정해 주세요.');
        return;
      }
    }
    if (conflictCheck.hasConflict) {
      alert(`충돌 오류: ${conflictCheck.message}`);
      return;
    }

    try {
      setIsSubmitting(true);
      const app: SubstituteApplication = {
        id: `app-${Date.now()}`,
        applicationNumber: '',
        academicYear: timetableData.academicYear || 2026,
        semester: timetableData.semester || 2,
        applicantTeacher: currentTeacherName,
        reason: finalReason,
        periodStart: sourceDate,
        periodEnd: mode === 'exchange' && targetDate ? targetDate : sourceDate,
        applicationDate: new Date().toISOString().split('T')[0],
        status: submitImmediately ? 'submitted' : 'draft',
        items: [currentItem],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        submittedAt: submitImmediately ? new Date().toISOString() : undefined,
      };

      await onSaveApplication(app, submitImmediately);
      onClose();
    } catch (err: any) {
      alert(err.message || '신청 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!selectedSlotInfo) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] md:w-[540px] bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-300">
      {/* 1. 상단 헤더 */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
            <ArrowLeftRight className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-white">
              수업 교체 / 보강 빠른 신청
            </h3>
            <p className="text-[11px] text-slate-300">
              선택한 수업의 교체 및 수업보강을 10초 만에 설정합니다.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 2. 스크롤 본문 */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-700">
        {/* 선택된 원본 수업 카드 */}
        <div className="bg-gradient-to-br from-indigo-50/90 to-slate-50 p-4 rounded-2xl border border-indigo-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-indigo-600 text-white shadow-xs">
              {sourceDay}요일 {sourcePeriod}교시
            </span>
            <span className="font-bold text-slate-500">
              원 담당: <strong className="text-slate-900">{currentTeacherName} 선생님</strong>
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <h4 className="text-base font-black text-slate-900">
              {slot.subjectName}
            </h4>
            <span className="text-xs font-black text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-indigo-200">
              {slot.classCode} ({slot.deptName})
            </span>
          </div>

          {/* 결강 일자 선택 */}
          <div className="pt-2 border-t border-indigo-100 flex items-center justify-between gap-2">
            <label className="text-[11px] font-black text-slate-600 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-indigo-600" />
              결강 일자:
            </label>
            <Input
              type="date"
              value={sourceDate}
              onChange={e => setSourceDate(e.target.value)}
              className="w-40 h-8 text-xs font-bold bg-white border-indigo-200 rounded-lg text-slate-900"
            />
          </div>
        </div>

        {/* 2. 방식 선택 (2대 큰 토글 카드) */}
        <div>
          <label className="text-xs font-black text-slate-900 block mb-2">
            어떤 방식으로 처리할까요?
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {/* 옵션 1: 교체 */}
            <button
              type="button"
              onClick={() => setMode('exchange')}
              className={cn(
                "p-3.5 rounded-2xl border-2 text-left transition-all space-y-1 relative",
                mode === 'exchange'
                  ? "border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600/20 shadow-xs"
                  : "border-slate-200 bg-white hover:border-slate-300"
              )}
            >
              <div className="flex items-center gap-1.5 font-black text-xs text-indigo-950">
                <ArrowLeftRight className="h-4 w-4 text-indigo-600" />
                교체
              </div>
              <p className="text-[10.5px] text-slate-500 leading-tight">
                동료 교사와 수업 맞바꾸기
              </p>
            </button>

            {/* 옵션 2: 보강 */}
            <button
              type="button"
              onClick={() => setMode('substitute')}
              className={cn(
                "p-3.5 rounded-2xl border-2 text-left transition-all space-y-1 relative",
                mode === 'substitute'
                  ? "border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/20 shadow-xs"
                  : "border-slate-200 bg-white hover:border-slate-300"
              )}
            >
              <div className="flex items-center gap-1.5 font-black text-xs text-emerald-950">
                <UserPlus className="h-4 w-4 text-emerald-600" />
                보강
              </div>
              <p className="text-[10.5px] text-slate-500 leading-tight">
                출장·연가 시 공강 교사에게 부탁
              </p>
            </button>
          </div>
        </div>

        {/* 3. 모드별 세부 설정 */}
        {mode === 'substitute' ? (
          /* 보강 모드: 스마트 추천 공강 교사 목록 */
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-900 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                {sourceDay}요일 {sourcePeriod}교시 공강 선생님 ({availableTeachers.length}명)
              </label>
              <span className="text-[10.5px] text-slate-400 font-medium">
                동일교과군 우선 정렬
              </span>
            </div>

            {/* 공강 교사 빠른 검색창 */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="공강 교사명, 담임반 검색 (예: 김철수, 도31)..."
                value={teacherSearchQuery}
                onChange={e => setTeacherSearchQuery(e.target.value)}
                className="pl-8.5 pr-7 h-8.5 text-xs bg-slate-50 border-slate-200 rounded-xl"
              />
              {teacherSearchQuery && (
                <button
                  type="button"
                  onClick={() => setTeacherSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {filteredAvailableTeachers.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-slate-400">
                {teacherSearchQuery ? '검색 조건과 일치하는 공강 교사가 없습니다.' : '해당 교시에 공강인 교사가 없습니다.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">
                {filteredAvailableTeachers.map(t => {
                  const isSelected = substituteTeacher === t.teacherName;
                  return (
                    <button
                      key={t.teacherName}
                      type="button"
                      onClick={() => setSubstituteTeacher(t.teacherName)}
                      className={cn(
                        "p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 shadow-2xs",
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-600/30"
                          : "bg-white text-slate-800 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs",
                          isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                        )}>
                          <User className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <strong className="text-xs font-black block">
                            {t.teacherName} 선생님
                          </strong>
                          <span className={cn(
                            "text-[10px]",
                            isSelected ? "text-indigo-200" : "text-slate-400"
                          )}>
                            {t.homeroomClass ? `담임: ${t.homeroomClass}` : '비담임 교과'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {t.isSameSubject ? (
                          <span className={cn(
                            "text-[9.5px] px-1.5 py-0.5 rounded font-black border",
                            isSelected ? "bg-blue-200 text-blue-950 border-blue-300" : "bg-blue-100 text-blue-900 border-blue-200"
                          )}>
                            ★ 동일교과
                          </span>
                        ) : t.isSameDept ? (
                          <span className={cn(
                            "text-[9.5px] px-1.5 py-0.5 rounded font-black border",
                            isSelected ? "bg-emerald-200 text-emerald-950 border-emerald-300" : "bg-emerald-100 text-emerald-900 border-emerald-200"
                          )}>
                            동일학과
                          </span>
                        ) : null}
                        <span className={cn(
                          "text-[10px]",
                          isSelected ? "text-indigo-200" : "text-slate-400"
                        )}>
                          누적 {t.totalSubstitutesDone}회
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* 교체 모드: AI 스마트 추천 & 동료 교사 선택 */
          <div className="space-y-3">
            {/* 1. AI 스마트 맞교환 추천 카드 목록 (최우선 추천) */}
            <div className="bg-gradient-to-br from-indigo-50/90 to-purple-50/60 p-3.5 rounded-2xl border border-indigo-200/80 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  AI 최적 맞교환 추천 ({smartRecommendations.length}건)
                </span>
                <span className="text-[10.5px] text-indigo-600 font-bold">
                  충돌 없는 최적 매칭
                </span>
              </div>

              {smartRecommendations.length === 0 ? (
                <div className="p-3 rounded-xl bg-white/80 border border-indigo-100 text-center text-slate-500 text-[11px]">
                  현재 조건에서 충돌 없는 추천 교체 대상이 없습니다. (아래에서 직접 검색하실 수 있습니다)
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {smartRecommendations.slice(0, 8).map((rec, idx) => {
                    const isSelected = partnerTeacher === rec.partnerTeacher && targetDate === rec.targetDate && targetPeriod === rec.targetPeriod;
                    return (
                      <button
                        key={`${rec.partnerTeacher}_${rec.targetDate}_${rec.targetPeriod}_${idx}`}
                        type="button"
                        onClick={() => {
                          setPartnerTeacher(rec.partnerTeacher);
                          setTargetDate(rec.targetDate);
                          setTargetPeriod(rec.targetPeriod);
                        }}
                        className={cn(
                          "p-2.5 rounded-xl border text-left text-xs transition-all flex flex-col gap-1 shadow-2xs cursor-pointer",
                          isSelected
                            ? "bg-indigo-600 text-white border-indigo-600 font-bold ring-2 ring-indigo-600/30"
                            : "bg-white text-slate-800 border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50/50"
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5">
                            <strong className="text-xs">{rec.partnerTeacher} 선생님</strong>
                            {rec.homeroomClass && (
                              <span className={cn("text-[10px] font-bold", isSelected ? "text-indigo-200" : "text-indigo-600")}>
                                ({rec.homeroomClass})
                              </span>
                            )}
                          </div>
                          <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-black", rec.badgeColor)}>
                            {rec.badgeLabel}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-medium">
                          <span className={cn("truncate max-w-[280px]", isSelected ? "text-indigo-100" : "text-slate-600")}>
                            {rec.subtitle}
                          </span>
                          <span className={cn("font-bold text-[10.5px] shrink-0", isSelected ? "text-white" : "text-indigo-700")}>
                            {rec.targetDay} {rec.targetPeriod}교시
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. 상대 선생님 주간 시간표 매트릭스 그리드 (시간표 보며 원클릭 선택) */}
            <PartnerTimetablePicker
              partnerTeacherName={partnerTeacher}
              onSelectPartnerTeacher={setPartnerTeacher}
              sourceDate={sourceDate}
              sourceDay={sourceDay}
              sourcePeriod={sourcePeriod}
              sourceSlot={slot}
              currentTeacherName={currentTeacherName}
              timetableData={timetableData}
              existingApplications={existingApplications}
              calendarConfig={calendarConfig}
              selectedTargetDate={targetDate}
              selectedTargetPeriod={targetPeriod}
              onSelectSlot={(newTargetDate, newTargetDay, newTargetPeriod) => {
                setTargetDate(newTargetDate);
                setTargetPeriod(newTargetPeriod);
              }}
            />
          </div>
        )}

        {/* 4. 사유 입력 (2단 분할: 사유 구분 드롭다운 & 상세내용 직접입력) */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
          <label className="text-xs font-black text-slate-900 block">
            신청 사유
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            {/* 왼쪽: 사유 구분 (드롭다운 + 기타입력 시 직접입력) */}
            <div className={cn(
              "space-y-1",
              reasonCategory === '기타입력' ? "sm:col-span-5" : "sm:col-span-4"
            )}>
              <span className="text-[11px] font-bold text-slate-500 block">사유 구분</span>
              <Select value={reasonCategory} onValueChange={setReasonCategory}>
                <SelectTrigger className="h-9 text-xs font-bold bg-white border-slate-200 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASON_CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat} className="text-xs font-bold">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {reasonCategory === '기타입력' && (
                <Input
                  placeholder="사유 구분 직접 입력"
                  value={customCategory}
                  onChange={e => setCustomCategory(e.target.value)}
                  className="h-8.5 text-xs bg-white border-indigo-300 rounded-xl font-bold animate-in fade-in-50"
                  autoFocus
                />
              )}
            </div>

            {/* 오른쪽: 상세내용 직접 입력 */}
            <div className={cn(
              "space-y-1",
              reasonCategory === '기타입력' ? "sm:col-span-7" : "sm:col-span-8"
            )}>
              <span className="text-[11px] font-bold text-slate-500 block">상세내용 입력</span>
              <Input
                placeholder="상세내용을 입력하세요 (예: 전국기능경기대회 지도, 개인 사정 등)"
                value={reasonDetail}
                onChange={e => setReasonDetail(e.target.value)}
                className="h-9 text-xs bg-white border-slate-200 rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* 5. 실시간 충돌 검증 신호등 알림 */}
        {conflictCheck.hasConflict ? (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-rose-800 text-xs">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-black block">충돌 발생으로 신청할 수 없습니다</strong>
              <p className="text-[11px] text-rose-700 mt-0.5">{conflictCheck.message}</p>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-emerald-800 text-xs">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-bold">안전: 교사 및 학반 충돌 없이 즉시 신청 가능합니다.</span>
          </div>
        )}
      </div>

      {/* 3. 하단 액션 버튼 바 */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-10 text-xs font-bold text-slate-600 hover:bg-slate-200"
        >
          닫기
        </Button>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting || conflictCheck.hasConflict}
            className="h-10 px-5 text-xs font-black gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/30 rounded-xl"
          >
            <Send className="h-4 w-4" />
            신청서 저장 및 제출하기
          </Button>
        </div>
      </div>
    </div>
  );
}
