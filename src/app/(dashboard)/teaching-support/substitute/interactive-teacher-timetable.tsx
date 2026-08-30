'use client';

// ==============================================================================
// src/app/(dashboard)/teaching-support/substitute/interactive-teacher-timetable.tsx
// 교사 맞춤형 인터랙티브 주간 시간표 (학사일정·행사·담당교사 실시간 연동 렌더링)
// ==============================================================================

import * as React from 'react';
import { ParsedTimetableResult, TeacherTimetableSummary, TimetableSlot } from '@/lib/timetable/parser';
import { DAYS_OF_WEEK, parseClassCode, getActivityInfo } from '@/lib/timetable/constants';
import { SubstituteApplication } from '@/lib/substitute/types';
import { 
  AcademicCalendarConfig, 
  SchoolEvent, 
  DEFAULT_ACADEMIC_CALENDAR_2026_2 
} from '@/lib/substitute/event-types';
import { 
  generateSemesterWeeksFromConfig, 
  getEventsForSlot, 
  getVacationForDate,
  findCurrentWeekNum
} from '@/lib/substitute/event-helper';
import { SemesterWeek } from '@/lib/substitute/validator';
import { 
  User, 
  UserPlus,
  Calendar, 
  Sparkles, 
  ArrowLeftRight, 
  Clock, 
  CheckCircle2,
  X,
  SendHorizontal,
  ChevronLeft,
  ChevronRight,
  Palmtree
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface SelectedSlotItem {
  key: string; // `${day}_${period}`
  day: string;
  date: string; // e.g. "2026-09-01"
  period: number;
  slot: TimetableSlot;
}

interface InteractiveTeacherTimetableProps {
  timetableData: ParsedTimetableResult;
  selectedTeacherName: string;
  onSelectTeacherName: (name: string) => void;
  onOpenDrawer: (slots: SelectedSlotItem[], initialMode?: 'exchange' | 'substitute') => void;
  applications: SubstituteApplication[];
  calendarConfig: AcademicCalendarConfig;
}

export function InteractiveTeacherTimetable({
  timetableData,
  selectedTeacherName,
  onSelectTeacherName,
  onOpenDrawer,
  applications,
  calendarConfig = DEFAULT_ACADEMIC_CALENDAR_2026_2,
}: InteractiveTeacherTimetableProps) {
  const [selectedSlots, setSelectedSlots] = React.useState<SelectedSlotItem[]>([]);

  // 학기 주차 목록 생성 (설정된 학사일정 기반 동적 계산)
  const semesterWeeks = React.useMemo(() => {
    return generateSemesterWeeksFromConfig(calendarConfig);
  }, [calendarConfig]);

  // 현재 주차 자동 계산 (오늘 날짜 및 주말 완벽 대응)
  const defaultWeekNum = React.useMemo(() => {
    return findCurrentWeekNum(semesterWeeks);
  }, [semesterWeeks]);

  const [selectedWeekNum, setSelectedWeekNum] = React.useState<number>(defaultWeekNum);

  // 주차 데이터가 로드되거나 변경될 때 현재 주차로 동기화
  React.useEffect(() => {
    setSelectedWeekNum(defaultWeekNum);
  }, [defaultWeekNum]);

  const selectedWeek: SemesterWeek = React.useMemo(() => {
    return semesterWeeks.find(w => w.weekNum === selectedWeekNum) || semesterWeeks[0] || {
      weekNum: 1,
      label: '1주차 (08.18 ~ 08.21)',
      shortLabel: '1주차',
      dateRangeLabel: '08.18 ~ 08.21',
      startDate: '2026-08-18',
      endDate: '2026-08-21',
      dates: {},
      monthDayLabels: {},
    };
  }, [semesterWeeks, selectedWeekNum]);

  const selectedTeacher = React.useMemo(() => {
    return timetableData.teachers.find(t => t.teacherName === selectedTeacherName) || timetableData.teachers[0];
  }, [timetableData.teachers, selectedTeacherName]);

  // 교사나 주차 변경 시 선택 초기화
  React.useEffect(() => {
    setSelectedSlots([]);
  }, [selectedTeacherName, selectedWeekNum]);

  // 해당 주차에서 해당 교사의 승인/접수된 결보강 변경 이력 매핑 (요일_교시 기준)
  const effectiveSlotMap = React.useMemo(() => {
    const map: Record<string, {
      status: 'approved' | 'submitted';
      type: 'teaching_substitute' | 'absence_substitute' | 'exchange_in' | 'exchange_out';
      partnerTeacher: string;
      originalTeacher?: string;
      subjectName?: string;
      classCode?: string;
      deptName?: string;
      reason?: string;
      appNumber: string;
    }> = {};

    const teacherName = selectedTeacher?.teacherName;
    if (!teacherName) return map;

    applications.forEach(app => {
      if (app.status === 'rejected') return;
      const isApproved = app.status === 'approved';
      const appStatus = isApproved ? 'approved' : 'submitted';

      app.items.forEach(it => {
        // 1) 보강 (Substitute)
        if (it.type === 'substitute') {
          // (1-a) 내가 결강자 (내 수업을 보강교사가 진행)
          if (it.originalTeacher === teacherName) {
            const day = it.sourceDay;
            const targetDayDate = selectedWeek.dates[day];
            if (it.sourceDate === targetDayDate) {
              const key = `${day}_${it.sourcePeriod}`;
              map[key] = {
                status: appStatus,
                type: 'absence_substitute',
                partnerTeacher: it.substituteTeacher || '보강교사',
                originalTeacher: it.originalTeacher,
                subjectName: it.subjectName,
                classCode: it.classCode,
                deptName: it.deptName,
                reason: app.reason,
                appNumber: app.applicationNumber,
              };
            }
          }
          // (1-b) 내가 보강 담당 교사 (다른 교사의 결강을 내가 보강 진행)
          if (it.substituteTeacher === teacherName) {
            const day = it.sourceDay;
            const targetDayDate = selectedWeek.dates[day];
            if (it.sourceDate === targetDayDate) {
              const key = `${day}_${it.sourcePeriod}`;
              map[key] = {
                status: appStatus,
                type: 'teaching_substitute',
                partnerTeacher: it.originalTeacher,
                originalTeacher: it.originalTeacher,
                subjectName: it.subjectName,
                classCode: it.classCode,
                deptName: it.deptName,
                reason: app.reason,
                appNumber: app.applicationNumber,
              };
            }
          }
        }

        // 2) 교체 (Exchange)
        if (it.type === 'exchange') {
          // (2-a) 내가 신청자(applicantTeacher)인 경우
          if (app.applicantTeacher === teacherName) {
            // 내 원래 수업 시간(source) -> 상대방이 수업함 (exchange_out)
            const srcDay = it.sourceDay;
            if (it.sourceDate === selectedWeek.dates[srcDay]) {
              const key = `${srcDay}_${it.sourcePeriod}`;
              map[key] = {
                status: appStatus,
                type: 'exchange_out',
                partnerTeacher: it.targetTeacher || '교체교사',
                originalTeacher: it.originalTeacher,
                subjectName: it.subjectName,
                classCode: it.classCode,
                deptName: it.deptName,
                reason: app.reason,
                appNumber: app.applicationNumber,
              };
            }
            // 상대방 수업 시간(target) -> 내가 수업함 (exchange_in)
            const tgtDay = it.targetDay;
            if (it.targetDate && tgtDay && it.targetDate === selectedWeek.dates[tgtDay] && it.targetPeriod) {
              const key = `${tgtDay}_${it.targetPeriod}`;
              map[key] = {
                status: appStatus,
                type: 'exchange_in',
                partnerTeacher: it.targetTeacher || '교체교사',
                originalTeacher: it.targetTeacher,
                subjectName: it.targetSubject || it.subjectName,
                classCode: it.classCode,
                deptName: it.deptName,
                reason: app.reason,
                appNumber: app.applicationNumber,
              };
            }
          }

          // (2-b) 내가 교체 대상자(targetTeacher)인 경우
          if (it.targetTeacher === teacherName && app.applicantTeacher !== teacherName) {
            // 내 원래 수업 시간(target) -> 신청자가 수업함 (exchange_out)
            const tgtDay = it.targetDay;
            if (it.targetDate && tgtDay && it.targetDate === selectedWeek.dates[tgtDay] && it.targetPeriod) {
              const key = `${tgtDay}_${it.targetPeriod}`;
              map[key] = {
                status: appStatus,
                type: 'exchange_out',
                partnerTeacher: app.applicantTeacher,
                originalTeacher: it.targetTeacher,
                subjectName: it.targetSubject || it.subjectName,
                classCode: it.classCode,
                deptName: it.deptName,
                reason: app.reason,
                appNumber: app.applicationNumber,
              };
            }
            // 상대방 수업 시간(source) -> 내가 수업함 (exchange_in)
            const srcDay = it.sourceDay;
            if (it.sourceDate === selectedWeek.dates[srcDay]) {
              const key = `${srcDay}_${it.sourcePeriod}`;
              map[key] = {
                status: appStatus,
                type: 'exchange_in',
                partnerTeacher: app.applicantTeacher,
                originalTeacher: app.applicantTeacher,
                subjectName: it.subjectName,
                classCode: it.classCode,
                deptName: it.deptName,
                reason: app.reason,
                appNumber: app.applicationNumber,
              };
            }
          }
        }
      });
    });

    return map;
  }, [applications, selectedTeacher, selectedWeek]);

  // 이전/다음 주차 이동
  const handlePrevWeek = () => {
    if (selectedWeekNum > 1) setSelectedWeekNum(selectedWeekNum - 1);
  };
  const handleNextWeek = () => {
    if (selectedWeekNum < semesterWeeks.length) setSelectedWeekNum(selectedWeekNum + 1);
  };

  // 슬롯 클릭
  const handleSlotClick = (day: string, period: number, slot: TimetableSlot) => {
    const key = `${day}_${period}`;
    const date = selectedWeek.dates[day] || new Date().toISOString().split('T')[0];

    setSelectedSlots(prev => {
      const exists = prev.some(s => s.key === key);
      if (exists) {
        return prev.filter(s => s.key !== key);
      } else {
        return [...prev, { key, day, date, period, slot }].sort((a, b) => a.period - b.period);
      }
    });
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4 relative">
      {/* 1. 상단 바: 교사 선택 & 학사 주차 선택 */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
            <User className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-black text-slate-900">
                {selectedTeacher?.teacherName} 선생님 시간표
              </h2>
              {selectedTeacher?.homeroomClass && (
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                  담임: {selectedTeacher.homeroomClass}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              바꾸고 싶은 수업을 클릭하세요. (여러 개를 누르면 1장으로 묶어서 신청됩니다)
            </p>
          </div>
        </div>

        {/* 우측 컨트롤: 주차(날짜 범위) 선택 드롭다운 + 교사 전환 드롭다운 */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* 주차 선택 드롭다운 & 이전/다음 버튼 */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-2xl border border-slate-200 shadow-2xs">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={selectedWeekNum <= 1}
              onClick={handlePrevWeek}
              className="h-7 w-7 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Select
              value={String(selectedWeekNum)}
              onValueChange={val => setSelectedWeekNum(parseInt(val))}
            >
              <SelectTrigger className="h-7 border-0 bg-transparent text-xs font-black text-indigo-950 focus:ring-0 w-[195px] px-2">
                <div className="flex items-center gap-1.5 truncate">
                  <Calendar className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                  <span className="truncate">{selectedWeek.label}</span>
                </div>
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {semesterWeeks.map(w => (
                  <SelectItem key={w.weekNum} value={String(w.weekNum)} className="text-xs font-medium">
                    <span className="font-black text-indigo-950">{w.shortLabel}</span>
                    <span className="ml-1 text-slate-500 font-mono text-[11px]">({w.dateRangeLabel})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={selectedWeekNum >= semesterWeeks.length}
              onClick={handleNextWeek}
              className="h-7 w-7 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-white"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* 교사 전환 드롭다운 */}
          <Select value={selectedTeacherName} onValueChange={onSelectTeacherName}>
            <SelectTrigger className="w-[125px] h-9 text-xs font-black bg-indigo-50/60 border-indigo-200 text-indigo-950 rounded-xl shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {timetableData.teachers.map(t => (
                <SelectItem key={t.teacherName} value={t.teacherName} className="text-xs font-medium">
                  <span className="font-bold text-slate-900">{t.teacherName}</span>
                  {t.homeroomClass && <span className="ml-1 text-[10px] text-indigo-600 font-bold">({t.homeroomClass})</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 2. 주간 시간표 그리드 (table-fixed로 모든 요일 셀 균등 1:1:1:1:1 고정 폭 유지) */}
      <div className="overflow-x-auto pb-6">
        <table className="w-full table-fixed border-collapse text-center text-xs min-w-[700px]">
          <thead>
            <tr className="bg-slate-100/90 text-slate-700 border-b-2 border-slate-200">
              <th className="py-2.5 px-2 w-14 font-black border-r border-slate-200 shrink-0">교시</th>
              {DAYS_OF_WEEK.map(d => {
                const dayDate = selectedWeek.dates[d.key];
                const vacation = dayDate ? getVacationForDate(dayDate, calendarConfig) : null;

                return (
                  <th key={d.key} className="py-2 px-1 font-black border-r last:border-r-0 border-slate-200 text-slate-800 w-[19%]">
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        <span className="text-xs font-black text-slate-900">{d.name}</span>
                        {vacation && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 truncate max-w-[75px]" title={vacation.name}>
                            {vacation.name}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-indigo-600 font-bold">
                        {selectedWeek.monthDayLabels[d.key] || ''}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[1, 2, 3, 4, 5, 6, 7].map(period => (
              <tr key={period} className="h-16">
                {/* 교시 번호 */}
                <td className="p-2 border-r border-slate-200 bg-slate-50/60 font-black text-slate-500 text-xs">
                  <span className="w-6 h-6 rounded-full bg-white border border-slate-200 shadow-2xs inline-flex items-center justify-center">
                    {period}
                  </span>
                </td>

                {/* 요일별 수업 슬롯 */}
                {DAYS_OF_WEEK.map(d => {
                  if (period > d.periods) {
                    return (
                      <td key={d.key} className="p-1 border-r last:border-r-0 border-slate-200 bg-slate-50/30">
                        <span className="text-slate-300 text-[10px]">-</span>
                      </td>
                    );
                  }

                  const dayDate = selectedWeek.dates[d.key] || '';
                  const vacation = dayDate ? getVacationForDate(dayDate, calendarConfig) : null;
                  const slotKey = `${d.key}_${period}`;
                  const slot = selectedTeacher?.slots[slotKey];
                  const isSlotActive = Boolean(slot && (slot.subjectName || slot.classCode));
                  const classInfo = slot?.classCode ? parseClassCode(slot.classCode) : null;
                  const isSelected = selectedSlots.some(s => s.key === slotKey);

                  // 해당 슬롯에 등록된 행사 검색 (예: 1학년 문화공연관람)
                  const slotEvents = dayDate ? getEventsForSlot(
                    dayDate,
                    period,
                    slot?.classCode,
                    selectedTeacher?.teacherName,
                    calendarConfig
                  ) : [];

                  const hasEvent = slotEvents.length > 0;
                  const mainEvent = slotEvents[0];

                  // 휴업일/방학인 경우
                  if (vacation) {
                    return (
                      <td key={d.key} className="p-1 border-r last:border-r-0 border-slate-200 bg-emerald-50/20">
                        <div className="w-full h-full min-h-[52px] rounded-xl border border-emerald-100 flex flex-col items-center justify-center text-[10.5px] text-emerald-700 font-bold">
                          <Palmtree className="h-3.5 w-3.5 mb-0.5 opacity-60" />
                          <span>{vacation.name}</span>
                        </div>
                      </td>
                    );
                  }

                  // 행사가 있는 경우 (클릭하여 행사 수업도 교체/보강 신청 가능)
                  if (hasEvent) {
                    const eventClassCode = selectedTeacher?.homeroomClass || slot?.classCode || (mainEvent.targetScope === 'all' ? '전교생' : `${mainEvent.targetGrades?.[0] || 1}학년`);

                    const eventSlot: TimetableSlot = {
                      id: `event-${mainEvent.id}-${d.key}-${period}`,
                      teacherName: selectedTeacherName,
                      homeroomClass: selectedTeacher?.homeroomClass || '',
                      day: d.key,
                      period,
                      subjectName: `[행사] ${mainEvent.title}`,
                      classCode: eventClassCode,
                      deptName: slot?.deptName || '전체',
                      grade: selectedTeacher?.homeroomClass ? (parseInt(selectedTeacher.homeroomClass.match(/\d/)?.[0] || '1', 10)) : (mainEvent.targetGrades?.[0] || slot?.grade || 1),
                      classNum: slot?.classNum || 1,
                      weight: 1,
                      isActivity: true,
                      activityType: '행사',
                    };

                    return (
                      <td key={d.key} className="p-1 border-r last:border-r-0 border-slate-200">
                        <button
                          type="button"
                          onClick={() => handleSlotClick(d.key, period, eventSlot)}
                          className={cn(
                            "w-full h-full min-h-[52px] p-2 rounded-xl border-[1.5px] transition-all flex flex-col items-center justify-between text-center relative group shadow-2xs cursor-pointer",
                            isSelected
                              ? "border-purple-600 bg-purple-600 text-white ring-2 ring-purple-600 ring-offset-2 scale-[1.03] shadow-md z-10"
                              : "border-purple-300 bg-purple-50/90 hover:border-purple-400 hover:bg-purple-100/90 hover:scale-[1.01]"
                          )}
                        >
                          {/* 선택 체크마크 뱃지 */}
                          {isSelected && (
                            <div className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-white text-purple-600 flex items-center justify-center shadow-xs text-xs font-black ring-1 ring-purple-600">
                              ✓
                            </div>
                          )}

                          <span className={cn(
                            "font-black text-[11px] truncate max-w-full",
                            isSelected ? "text-white" : "text-purple-950"
                          )}>
                            🎭 {mainEvent.title}
                          </span>

                          <div className={cn(
                            "flex items-center gap-1 text-[9.5px] font-bold mt-0.5",
                            isSelected ? "text-purple-100" : "text-purple-700"
                          )}>
                            <span>{eventClassCode}</span>
                            {mainEvent.location && (
                              <span className={isSelected ? "text-purple-200" : "text-purple-500"}>· {mainEvent.location}</span>
                            )}
                          </div>
                        </button>
                      </td>
                    );
                  }

                  // 3. 결보강 / 교체 승인 또는 신청된 변동 슬롯이 존재하는 경우
                  const effectiveInfo = effectiveSlotMap[slotKey];

                  if (effectiveInfo) {
                    const isApproved = effectiveInfo.status === 'approved';
                    const isTeachingSub = effectiveInfo.type === 'teaching_substitute';
                    const isExchangeIn = effectiveInfo.type === 'exchange_in';
                    const isAbsenceSub = effectiveInfo.type === 'absence_substitute';
                    const isExchangeOut = effectiveInfo.type === 'exchange_out';

                    const dynamicSlot: TimetableSlot = {
                      id: `effective-${d.key}-${period}`,
                      teacherName: selectedTeacherName,
                      homeroomClass: selectedTeacher?.homeroomClass || '',
                      day: d.key,
                      period,
                      subjectName: effectiveInfo.subjectName || slot?.subjectName || '',
                      classCode: effectiveInfo.classCode || slot?.classCode || '',
                      deptName: effectiveInfo.deptName || slot?.deptName || '전체',
                      grade: 1,
                      classNum: 1,
                      weight: 1,
                      isActivity: false,
                      activityType: '수업',
                    };

                    const isPassedToOther = isAbsenceSub || isExchangeOut;

                    return (
                      <td key={d.key} className="p-1 border-r last:border-r-0 border-slate-200">
                        <button
                          type="button"
                          disabled={isPassedToOther}
                          onClick={() => {
                            if (!isPassedToOther) {
                              handleSlotClick(d.key, period, dynamicSlot);
                            }
                          }}
                          title={
                            isAbsenceSub
                              ? `이미 ${effectiveInfo.partnerTeacher} 선생님께 보강 배정된 수업입니다. (보강 배정된 교사가 변경 가능)`
                              : isExchangeOut
                              ? `이미 ${effectiveInfo.partnerTeacher} 선생님과 교체 완료된 수업입니다.`
                              : isTeachingSub
                              ? `(${effectiveInfo.originalTeacher} 결강 보강 수업) 클릭하여 필요 시 교체/보강 신청 가능`
                              : isExchangeIn
                              ? `(${effectiveInfo.partnerTeacher} 교체 수업) 클릭하여 필요 시 교체/보강 신청 가능`
                              : undefined
                          }
                          className={cn(
                            "w-full h-full min-h-[54px] p-1.5 sm:p-2 rounded-xl border-[1.5px] transition-all flex flex-col items-center justify-between text-center relative group shadow-2xs",
                            isPassedToOther ? "cursor-not-allowed opacity-80 select-none" : "cursor-pointer",
                            isSelected && "border-indigo-600 bg-indigo-600 text-white ring-2 ring-indigo-600 ring-offset-2 scale-[1.03] shadow-md z-10",
                            !isSelected && isTeachingSub && (isApproved ? "border-emerald-400 bg-emerald-50/90 text-emerald-950 ring-1 ring-emerald-400/50 hover:bg-emerald-100/90" : "border-amber-300 bg-amber-50/80"),
                            !isSelected && isExchangeIn && (isApproved ? "border-indigo-400 bg-indigo-50/90 text-indigo-950 ring-1 ring-indigo-400/50 hover:bg-indigo-100/90" : "border-indigo-300 bg-indigo-50/70"),
                            !isSelected && isAbsenceSub && (isApproved ? "border-amber-300 bg-amber-50/60 text-slate-700 hover:bg-amber-100/50" : "border-amber-200 bg-amber-50/40"),
                            !isSelected && isExchangeOut && "border-slate-300 bg-slate-100/80 text-slate-500 hover:bg-slate-200/50"
                          )}
                        >
                          {/* 선택 체크마크 */}
                          {isSelected && (
                            <div className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-white text-indigo-600 flex items-center justify-center shadow-xs text-xs font-black ring-1 ring-indigo-600">
                              ✓
                            </div>
                          )}

                          {/* 상태 뱃지 */}
                          {!isSelected && (
                            <span className={cn(
                              "absolute -top-1.5 -right-1 text-[9px] px-1.5 py-0.2 rounded-full font-black shadow-xs",
                              isTeachingSub && (isApproved ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"),
                              isExchangeIn && (isApproved ? "bg-indigo-600 text-white" : "bg-indigo-500 text-white"),
                              isAbsenceSub && (isApproved ? "bg-amber-500 text-white" : "bg-slate-500 text-white"),
                              isExchangeOut && (isApproved ? "bg-slate-600 text-white" : "bg-slate-500 text-white")
                            )}>
                              {isTeachingSub && (isApproved ? '✅ 보강수업' : '⏳ 보강신청')}
                              {isExchangeIn && (isApproved ? '🔄 교체수업' : '⏳ 교체신청')}
                              {isAbsenceSub && (isApproved ? '✅ 보강배정' : '⏳ 보강신청')}
                              {isExchangeOut && (isApproved ? '🔄 교체완료' : '⏳ 교체신청')}
                            </span>
                          )}

                          {/* 과목명 */}
                          <span className={cn(
                            "font-black text-xs tracking-tight truncate max-w-full",
                            isSelected ? "text-white" : (isAbsenceSub || isExchangeOut) ? "text-slate-600 line-through opacity-80" : "text-slate-900 font-extrabold"
                          )}>
                            {effectiveInfo.subjectName || slot?.subjectName || '수업'}
                          </span>

                          {/* 학반 및 상세 교사 정보 */}
                          <div className="flex flex-col items-center gap-0.5 mt-0.5 max-w-full">
                            {effectiveInfo.classCode && (
                              <span className={cn(
                                "text-[9.5px] px-1.5 py-0.2 rounded font-black truncate max-w-full",
                                isSelected ? "bg-white/20 text-white" : isTeachingSub ? "bg-emerald-200/80 text-emerald-900" : isExchangeIn ? "bg-indigo-200/80 text-indigo-900" : "bg-slate-200 text-slate-700"
                              )}>
                                {effectiveInfo.classCode}
                              </span>
                            )}
                            <span className={cn(
                              "text-[8.5px] font-bold truncate max-w-full",
                              isSelected ? "text-indigo-100" : isTeachingSub ? "text-emerald-700" : isExchangeIn ? "text-indigo-700" : "text-amber-800"
                            )}>
                              {isTeachingSub && `(${effectiveInfo.originalTeacher} 결강)`}
                              {isExchangeIn && `(${effectiveInfo.partnerTeacher} 교체)`}
                              {isAbsenceSub && `➔ ${effectiveInfo.partnerTeacher} 보강`}
                              {isExchangeOut && `➔ ${effectiveInfo.partnerTeacher} 교체`}
                            </span>
                          </div>
                        </button>
                      </td>
                    );
                  }

                  if (!isSlotActive) {
                    return (
                      <td key={d.key} className="p-1 border-r last:border-r-0 border-slate-200">
                        <div className="w-full h-full min-h-[52px] rounded-xl border border-dashed border-slate-100 flex items-center justify-center text-[10.5px] text-slate-300 font-medium bg-slate-50/20">
                          공강
                        </div>
                      </td>
                    );
                  }

                  return (
                    <td key={d.key} className="p-1 border-r last:border-r-0 border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleSlotClick(d.key, period, slot!)}
                        className={cn(
                          "w-full h-full min-h-[52px] p-2 rounded-xl border-[1.5px] transition-all flex flex-col items-center justify-between text-center relative group shadow-2xs cursor-pointer",
                          isSelected
                            ? "border-indigo-600 bg-indigo-600 text-white ring-2 ring-indigo-600 ring-offset-2 scale-[1.03] shadow-md z-10"
                            : "border-slate-200/90 bg-white hover:border-indigo-400 hover:bg-indigo-50/30 hover:scale-[1.01] hover:shadow-sm"
                        )}
                      >
                        {/* 선택 체크마크 뱃지 */}
                        {isSelected && (
                          <div className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-white text-indigo-600 flex items-center justify-center shadow-xs text-xs font-black ring-1 ring-indigo-600">
                            ✓
                          </div>
                        )}

                        {/* 상단: 과목명 */}
                        <span className={cn(
                          "font-black text-xs tracking-tight truncate max-w-full",
                          isSelected ? "text-white" : "text-slate-900"
                        )}>
                          {slot?.subjectName}
                        </span>

                        {/* 하단: 학반 뱃지 */}
                        {slot?.classCode && classInfo && (
                          <div className="flex items-center gap-1">
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded-md font-black shadow-2xs",
                              isSelected ? "bg-white/20 text-white border border-white/30" : classInfo.color.badge
                            )}>
                              {slot.classCode}
                            </span>
                          </div>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 3. 선택된 수업이 있을 때 뜨는 하단 신청 바 */}
      {selectedSlots.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md text-white px-6 py-3.5 rounded-3xl shadow-2xl border border-slate-700 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
              {selectedSlots.length}
            </span>
            <span className="text-xs font-bold text-slate-200">
              {selectedSlots.length === 1 ? '1개 수업 선택됨' : `${selectedSlots.length}개 수업 묶음 선택됨`}
            </span>
            <span className="text-[11px] text-indigo-300 font-mono hidden sm:inline">
              ({selectedSlots.map(s => `${s.day}${s.period}`).join(', ')})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedSlots([])}
              className="h-8 px-2.5 text-xs text-slate-400 hover:text-white hover:bg-white/10"
            >
              선택 취소
            </Button>
            {/* 1. 수업 교체 신청 버튼 */}
            <Button
              type="button"
              size="sm"
              onClick={() => onOpenDrawer(selectedSlots, 'exchange')}
              className="h-9 px-3.5 text-xs font-black gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md shadow-indigo-600/30"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              수업 교체 신청
            </Button>

            {/* 2. 보강 신청 버튼 */}
            <Button
              type="button"
              size="sm"
              onClick={() => onOpenDrawer(selectedSlots, 'substitute')}
              className="h-9 px-3.5 text-xs font-black gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md shadow-emerald-600/30"
            >
              <UserPlus className="h-3.5 w-3.5" />
              수업 보강 신청
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
