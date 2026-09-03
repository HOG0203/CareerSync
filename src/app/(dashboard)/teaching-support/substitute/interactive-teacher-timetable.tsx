'use client';

// ==============================================================================
// src/app/(dashboard)/teaching-support/substitute/interactive-teacher-timetable.tsx
// 교사 맞춤형 인터랙티브 주간 시간표 (학사일정·행사·담당교사 실시간 연동 렌더링)
// ==============================================================================

import * as React from 'react';
import { ParsedTimetableResult, TeacherTimetableSummary, TimetableSlot } from '@/lib/timetable/parser';
import { DAYS_OF_WEEK, parseClassCode, getActivityInfo, getClassDeptBadgeStyle } from '@/lib/timetable/constants';
import { SubstituteApplication } from '@/lib/substitute/types';
import { 
  AcademicCalendarConfig, 
  SchoolEvent, 
  DEFAULT_ACADEMIC_CALENDAR_2026_2 
} from '@/lib/substitute/event-types';
import { 
  generateSemesterWeeksFromConfig, 
  getEventsForSlot, 
  getClassEventsForSlot,
  getSpecialDaySchedule,
  getExamPeriodForDate,
  getExamSlotInfo,
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
  Check,
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
    <div className="space-y-3">
      {/* 1. 상단 캡슐형 컨트롤 바 (AdminClassSelector 패턴) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center flex-wrap gap-2 flex-1">
          {/* 교사 선택 캡슐 */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1">
            <User className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <Select value={selectedTeacherName} onValueChange={onSelectTeacherName}>
              <SelectTrigger className="w-[140px] sm:w-[160px] h-7 text-xs font-bold border-none bg-transparent shadow-none focus:ring-0 px-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60 rounded-xl shadow-lg border-slate-200">
                {timetableData.teachers.map(t => (
                  <SelectItem key={t.teacherName} value={t.teacherName} className="text-xs font-medium py-1.5">
                    <span className="font-bold text-slate-800">{t.teacherName}</span>
                    {t.homeroomClass && (
                      <span className="ml-1 text-[11px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                        {t.homeroomClass}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 주차 선택 캡슐 & 이전/다음 버튼 */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 rounded-xl px-1.5 py-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={selectedWeekNum <= 1}
              onClick={handlePrevWeek}
              className="h-6 w-6 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            <Calendar className="h-3.5 w-3.5 text-blue-600 shrink-0 ml-0.5" />

            <Select
              value={String(selectedWeekNum)}
              onValueChange={val => setSelectedWeekNum(parseInt(val))}
            >
              <SelectTrigger className="h-7 border-none bg-transparent shadow-none focus:ring-0 text-xs font-bold text-slate-800 w-[180px] sm:w-[200px] px-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64 rounded-xl shadow-lg border-slate-200">
                {semesterWeeks.map(w => (
                  <SelectItem key={w.weekNum} value={String(w.weekNum)} className="text-xs font-medium py-1.5">
                    <span className="font-bold text-slate-800">{w.shortLabel}</span>
                    <span className="ml-1 text-slate-400 font-mono text-[11px]">({w.dateRangeLabel})</span>
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
              className="h-6 w-6 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* 2. 메인 주간 인터랙티브 시간표 카드 */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden relative">
        {/* 카드 상단 인라인 교사 헤더 바 */}
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-base font-black text-slate-900">
              {selectedTeacher?.teacherName} 선생님 주간 시간표
            </span>
            {selectedTeacher?.homeroomClass && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                담임: {selectedTeacher.homeroomClass}
              </span>
            )}
          </div>

          <div className="text-xs text-slate-500">
            기준 주차: <strong className="text-slate-900 font-bold">{selectedWeek.label}</strong>
          </div>
        </div>

        {/* 주간 시간표 그리드 영역 */}
        <div className="p-3 sm:p-4 overflow-x-auto pb-6">
          <table className="w-full table-fixed border-collapse text-center text-xs min-w-[700px]">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 border-b-2 border-slate-200">
                <th className="py-2.5 px-2 w-14 font-black border-r border-slate-200 shrink-0">교시</th>
                {DAYS_OF_WEEK.map(d => {
                  const dayDate = selectedWeek.dates[d.key];
                  const vacation = dayDate ? getVacationForDate(dayDate, calendarConfig) : null;
                  const specialDay = dayDate ? getSpecialDaySchedule(dayDate, calendarConfig) : null;
                  const examPeriod = dayDate ? getExamPeriodForDate(dayDate, calendarConfig) : null;

                  return (
                    <th key={d.key} className="py-2 px-1 font-black border-r last:border-r-0 border-slate-200 text-slate-800 w-[19%]">
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          <span className="text-xs font-black text-slate-900">
                            {specialDay && specialDay.targetDayOfWeek !== d.key 
                              ? `${d.key}(${specialDay.targetDayOfWeek})요일` 
                              : d.name}
                          </span>
                          {vacation && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 truncate max-w-[75px]" title={vacation.name}>
                              {vacation.name}
                            </span>
                          )}
                          {examPeriod && !vacation && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-200 truncate max-w-[90px]" title={`${examPeriod.name} (${examPeriod.examPeriods.join('·')}교시)`}>
                              📝 {examPeriod.name}
                            </span>
                          )}
                          {specialDay && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200 truncate max-w-[95px] flex items-center gap-0.5" title={specialDay.description || `${specialDay.targetDayOfWeek}요일 시간표 운영`}>
                              <ArrowLeftRight className="h-2.5 w-2.5" />
                              {specialDay.shortenedPeriods 
                                ? `⏰ ${specialDay.shortenedPeriods}교시 단축` 
                                : specialDay.targetDayOfWeek !== d.key 
                                  ? `${specialDay.targetDayOfWeek}요일 수업` 
                                  : '교시 변형'}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-blue-600 font-bold">
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
                  const dayDate = selectedWeek.dates[d.key] || '';
                  const vacation = dayDate ? getVacationForDate(dayDate, calendarConfig) : null;
                  const specialDay = dayDate ? getSpecialDaySchedule(dayDate, calendarConfig) : null;

                  // 대체 요일 또는 교시 매핑이 지정되어 있으면 해당 슬롯 로드 (예: 금요일 6교시에 5교시 수업 로드)
                  const targetDayKey = specialDay ? specialDay.targetDayOfWeek : d.key;
                  const targetPeriod = specialDay?.periodOverrides?.[period] ?? period;
                  const isPeriodOverridden = Boolean(specialDay?.periodOverrides?.[period] && specialDay.periodOverrides[period] !== period);
                  const slotKey = `${targetDayKey}_${targetPeriod}`;
                  const slot = selectedTeacher?.slots[slotKey];
                  const isSlotActive = Boolean(slot && (slot.subjectName || slot.classCode));
                  const classInfo = slot?.classCode ? parseClassCode(slot.classCode) : null;
                  const isSelected = selectedSlots.some(s => s.key === slotKey);

                  // 지필평가/시험 기간 슬롯 검사
                  const examInfo = dayDate ? getExamSlotInfo(dayDate, period, slot?.classCode, calendarConfig) : null;

                  // 해당 날짜/교시의 유효 정규 교시 수 (월요일 시간표면 7교시 적용)
                  const effectiveMaxPeriods = specialDay 
                    ? (DAYS_OF_WEEK.find(x => x.key === specialDay.targetDayOfWeek)?.periods || d.periods)
                    : d.periods;

                  // 해당 슬롯에 등록된 행사 검색 (예: 1학년 문화공연관람, 수요일 7교시 행사 등)
                  const slotEvents = dayDate ? getEventsForSlot(
                    dayDate,
                    period,
                    slot?.classCode,
                    selectedTeacher?.teacherName,
                    calendarConfig
                  ) : [];

                  const hasEvent = slotEvents.length > 0;
                  const mainEvent = slotEvents[0];

                  // 해당 학급의 학생들이 참여 중인 행사가 있는지 검사 (비인솔 교사의 수업 슬롯)
                  const classEvents = dayDate && slot?.classCode ? getClassEventsForSlot(dayDate, period, slot.classCode, calendarConfig) : [];
                  const hasClassEvent = classEvents.length > 0;
                  const mainClassEvent = classEvents[0];

                  // 3. 결보강 / 교체 승인 또는 신청된 변동 슬롯이 존재하는 경우
                  const effectiveInfo = effectiveSlotMap[slotKey];

                  // 지필평가/시험 기간인 경우 우선 렌더링
                  if (examInfo?.isExamRunning) {
                    return (
                      <td key={d.key} className="p-1 border-r last:border-r-0 border-slate-200 h-14">
                        <div className="w-full h-full min-h-[48px] max-h-[48px] p-1 rounded-xl border border-rose-200 bg-rose-50/80 flex flex-col items-center justify-center text-center shadow-2xs">
                          <span className="font-extrabold text-[11px] text-rose-900 truncate max-w-full">
                            📝 {examInfo.exam.name}
                          </span>
                          <span className="text-[8.5px] font-black text-rose-600 bg-white/90 px-1.5 py-0.2 rounded-full border border-rose-200 mt-0.5 shadow-2xs">
                            시험 진행 ({period}교시)
                          </span>
                        </div>
                      </td>
                    );
                  }

                  if (examInfo?.isDismissed) {
                    return (
                      <td key={d.key} className="p-1 border-r last:border-r-0 border-slate-200 h-14">
                        <div className="w-full h-full min-h-[48px] max-h-[48px] rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-[10px] text-slate-400 font-bold bg-slate-50/40">
                          <span>🏠 시험 후 하교</span>
                          <span className="text-[8.5px] text-slate-400 font-medium">(수업 없음)</span>
                        </div>
                      </td>
                    );
                  }

                  // 단축수업으로 인한 수업 없음 처리 (예: 4교시 단축수업 시 5~7교시)
                  const isShortenedDismissed = Boolean(specialDay?.shortenedPeriods && period > specialDay.shortenedPeriods);
                  if (isShortenedDismissed) {
                    return (
                      <td key={d.key} className="p-1 border-r last:border-r-0 border-slate-200 h-14">
                        <div className="w-full h-full min-h-[48px] max-h-[48px] rounded-xl border border-dashed border-amber-200/90 flex flex-col items-center justify-center text-[10px] text-amber-800 font-bold bg-amber-50/50">
                          <span>⏰ 단축수업 ({specialDay?.shortenedPeriods}교시 단축)</span>
                          <span className="text-[8.5px] text-amber-600 font-medium">(수업 없음)</span>
                        </div>
                      </td>
                    );
                  }

                  // 기본 요일별 교시(예: 수요일 6교시)를 초과하지만, 행사나 변동 슬롯 또는 수업이 없는 경우만 '-' 표시
                  if (period > effectiveMaxPeriods && !hasEvent && !hasClassEvent && !effectiveInfo && !isSlotActive) {
                    return (
                      <td key={d.key} className="p-1 border-r last:border-r-0 border-slate-200 bg-slate-50/30">
                        <span className="text-slate-300 text-[10px]">-</span>
                      </td>
                    );
                  }

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

                  // 1) 교사가 직접 인솔/담당하는 행사가 있는 경우 (행사 수업 진행)
                  if (hasEvent) {
                    const teacherHomeroom = selectedTeacher?.homeroomClass?.trim();

                    // 🌟 행사 시 담당 교사의 학반 우선 결정:
                    // 1순위: 담당 교사의 담임 학반 (예: 기11, 섬31, 화12 등)
                    // 2순위: 행사에 특정 학반(targetClasses)이 지정되어 있는 경우
                    // 3순위: 해당 시간표 슬롯의 원래 학반 (slot?.classCode)
                    // 4순위: 학년별 행사 표기 (예: '1학년')
                    // 5순위: 전교생 표기 ('전교생')
                    let eventClassCode = '';
                    if (teacherHomeroom) {
                      eventClassCode = teacherHomeroom;
                    } else if (mainEvent.targetScope === 'class' && mainEvent.targetClasses && mainEvent.targetClasses.length > 0) {
                      eventClassCode = mainEvent.targetClasses.join(',');
                    } else if (slot?.classCode && slot.classCode.trim() !== '') {
                      eventClassCode = slot.classCode;
                    } else if (mainEvent.targetScope === 'grade') {
                      eventClassCode = `${mainEvent.targetGrades?.join(',') || '1'}학년`;
                    } else if (mainEvent.targetScope === 'all') {
                      eventClassCode = '전교생';
                    } else {
                      eventClassCode = '전체';
                    }

                    const eventSlot: TimetableSlot = {
                      id: `event-${mainEvent.id}-${d.key}-${period}`,
                      teacherName: selectedTeacherName,
                      homeroomClass: selectedTeacher?.homeroomClass || '',
                      day: d.key,
                      period,
                      subjectName: `[행사] ${mainEvent.title}`,
                      classCode: eventClassCode,
                      deptName: slot?.deptName || selectedTeacher?.remarks || '전체',
                      grade: teacherHomeroom
                        ? parseInt(teacherHomeroom.match(/\d/)?.[0] || '1', 10)
                        : (mainEvent.targetGrades?.[0] || slot?.grade || 1),
                      classNum: teacherHomeroom
                        ? parseInt(teacherHomeroom.match(/\d+/)?.[0]?.slice(1) || '1', 10)
                        : (slot?.classNum || 1),
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

                  // 2) 교사는 인솔자가 아니나, 해당 학급 학생들이 행사에 참여하여 수업이 없어진 경우 (수업 취소 / 공강!)
                  if (hasClassEvent) {
                    return (
                      <td key={d.key} className="p-1 border-r last:border-r-0 border-slate-200 h-14">
                        <div 
                          className="w-full h-full min-h-[48px] max-h-[48px] p-1 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 flex flex-col items-center justify-center text-center shadow-2xs select-none"
                          title={`${slot?.classCode || '학급'} 학생들이 '${mainClassEvent.title}' 행사에 참여하여 수업이 없습니다 (공강)`}
                        >
                          <span className="font-bold text-[10px] text-slate-500 truncate max-w-full line-through decoration-slate-400">
                            {slot?.subjectName} ({slot?.classCode})
                          </span>
                          <span className="text-[8.5px] font-black text-amber-700 bg-amber-100/80 px-1.5 py-0.2 rounded-full border border-amber-200 mt-0.5 shadow-2xs">
                            공강 ({mainClassEvent.title})
                          </span>
                        </div>
                      </td>
                    );
                  }

                  // 3. 결보강 / 교체 승인 또는 신청된 변동 슬롯이 존재하는 경우
                  if (effectiveInfo) {
                    const isApproved = effectiveInfo.status === 'approved';
                    const isPending = !isApproved;
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

                    // 교체 나간 수업 또는 결강 수업 (내가 수업하지 않음)
                    const isPassedToOther = isAbsenceSub || isExchangeOut;
                    // 교체 나간 수업, 결강 수업, 또는 아직 결재 대기 중(교체중/보강중)인 슬롯은 추가 선택 불가 (완전 잠금)
                    const isLocked = isPassedToOther || isPending;
                    // 선택 상태 판별
                    const isCellSelected = isSelected && !isLocked;

                    return (
                      <td key={d.key} className="p-1 border-r last:border-r-0 border-slate-200 h-14">
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => {
                            if (!isLocked) {
                              handleSlotClick(d.key, period, dynamicSlot);
                            }
                          }}
                          title={
                            isPending
                              ? `현재 결재 진행 중(${isExchangeIn || isExchangeOut ? '교체중' : isTeachingSub ? '보강중' : '결강중'})인 수업입니다. 결재 승인 전에는 추가 변경이 불가능합니다.`
                              : isAbsenceSub
                              ? `이미 ${effectiveInfo.partnerTeacher} 선생님께 보강 배정된 결강 수업입니다. (선택 불가)`
                              : isExchangeOut
                              ? `이미 ${effectiveInfo.partnerTeacher} 선생님과 교체 완료된 수업입니다. (선택 불가)`
                              : isTeachingSub
                              ? `(${effectiveInfo.originalTeacher} 결강 보강 수업) 클릭하여 필요 시 재교체/보강 신청 가능`
                              : isExchangeIn
                              ? `(${effectiveInfo.partnerTeacher} 교체 완료된 수업) 클릭하여 다른 교사와 다시 재교체 신청 가능`
                              : undefined
                          }
                          className={cn(
                            "w-full h-full min-h-[48px] max-h-[48px] p-1 sm:p-1.5 rounded-xl border-[1.5px] transition-all flex flex-col items-center justify-center text-center relative group shadow-2xs",
                            // 1) 내가 넘겨준 수업 (교체 나감 / 결강): 선택 불가(잠금) 빗살무늬 패턴
                            isPassedToOther && "cursor-not-allowed select-none border-dashed border-slate-300 bg-[repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9_6px,#e2e8f0_6px,#e2e8f0_12px)] opacity-95",
                            // 2) 내가 수업하는 보강 수업
                            !isPassedToOther && isTeachingSub && (isApproved ? "border-emerald-400 bg-emerald-50/95 text-emerald-950 ring-1 ring-emerald-400/40 hover:bg-emerald-100/90 cursor-pointer" : "border-emerald-300 bg-emerald-50/80 text-emerald-950 cursor-not-allowed"),
                            // 3) 내가 수업하는 교체 들어온 수업 (재교체 가능)
                            !isPassedToOther && isExchangeIn && (isApproved ? "border-indigo-400 bg-indigo-50/95 text-indigo-950 ring-1 ring-indigo-400/40 hover:bg-indigo-100/90 cursor-pointer" : "border-indigo-300 bg-indigo-50/80 text-indigo-950 cursor-not-allowed"),
                            // 4) 선택된 경우 (오직 유효 슬롯만)
                            isCellSelected && "border-indigo-600 bg-indigo-600 text-white ring-2 ring-indigo-600 ring-offset-2 scale-[1.03] shadow-md z-10",
                            // 5) 일반 활성 수업
                            !isCellSelected && !isPassedToOther && !isTeachingSub && !isExchangeIn && "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30"
                          )}
                        >
                          {/* 선택 체크마크 (오직 유효 선택 슬롯만) */}
                          {isCellSelected && (
                            <div className="absolute -top-2 -left-2 w-5.5 h-5.5 rounded-full bg-white flex items-center justify-center shadow-md border-2 border-indigo-600 z-20 shrink-0 aspect-square">
                              <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" strokeWidth={3.5} />
                            </div>
                          )}

                          {/* 상태 뱃지 (최상위 레이어 z-20) */}
                          {!isCellSelected && (
                            <span className={cn(
                              "absolute -top-1.5 -right-1 text-[8.5px] px-1.5 py-0.2 rounded-full font-black shadow-xs z-20 leading-tight",
                              isTeachingSub && (isApproved ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"),
                              isExchangeIn && (isApproved ? "bg-indigo-600 text-white" : "bg-amber-500 text-white"),
                              isAbsenceSub && (isApproved ? "bg-slate-700 text-white ring-1 ring-white/50" : "bg-amber-500 text-white"),
                              isExchangeOut && (isApproved ? "bg-slate-700 text-white ring-1 ring-white/50" : "bg-amber-500 text-white")
                            )}>
                              {isTeachingSub && (isApproved ? '✅ 보강' : '⏳ 보강중')}
                              {isExchangeIn && (isApproved ? '🔄 교체' : '⏳ 교체중')}
                              {isAbsenceSub && (isApproved ? '❌ 결강' : '⏳ 결강중')}
                              {isExchangeOut && (isApproved ? '🔄 교체완료' : '⏳ 교체중')}
                            </span>
                          )}

                          {/* 과목명 (선명한 대비와 텍스트 색상) */}
                          <span className={cn(
                            "font-extrabold text-[11.5px] tracking-tight truncate max-w-full leading-tight",
                            isPassedToOther 
                              ? "text-slate-700 font-bold line-through decoration-slate-400 decoration-[1.5px]" 
                              : isCellSelected 
                              ? "text-white" 
                              : isTeachingSub 
                              ? "text-emerald-950 font-black" 
                              : isExchangeIn 
                              ? "text-indigo-950 font-black" 
                              : "text-slate-900 font-extrabold"
                          )}>
                            {effectiveInfo.subjectName || slot?.subjectName || '수업'}
                          </span>

                          {/* 학반 및 교체/보강 상대 교사 정보 (한 줄 인라인 콤팩트 배치) */}
                          <div className="flex items-center justify-center gap-1 mt-0.5 max-w-full overflow-hidden">
                            {effectiveInfo.classCode && (
                              <span className={cn(
                                "text-[9px] px-1 py-0 rounded font-black truncate shrink-0",
                                isPassedToOther 
                                  ? "bg-slate-200 text-slate-700 font-bold" 
                                  : isCellSelected 
                                  ? "bg-white/20 text-white" 
                                  : isTeachingSub 
                                  ? "bg-emerald-200/90 text-emerald-900 font-black" 
                                  : isExchangeIn 
                                  ? "bg-indigo-200/90 text-indigo-900 font-black" 
                                  : getClassDeptBadgeStyle(effectiveInfo.classCode).pill
                              )}>
                                {effectiveInfo.classCode}
                              </span>
                            )}
                            <span className={cn(
                              "text-[8.5px] font-bold truncate max-w-[85px]",
                              isPassedToOther 
                                ? "text-slate-800 bg-white/95 px-1 py-0.2 rounded border border-slate-300 font-black shadow-2xs" 
                                : isCellSelected 
                                ? "text-indigo-100" 
                                : isTeachingSub 
                                ? "text-emerald-800 font-bold" 
                                : isExchangeIn 
                                ? "text-indigo-800 font-bold" 
                                : "text-amber-800"
                            )}>
                              {isTeachingSub && `(${effectiveInfo.originalTeacher} 결강)`}
                              {isExchangeIn && `(${effectiveInfo.partnerTeacher} 교체)`}
                              {isAbsenceSub && `➔ ${effectiveInfo.partnerTeacher}`}
                              {isExchangeOut && `➔ ${effectiveInfo.partnerTeacher}`}
                            </span>
                          </div>
                        </button>
                      </td>
                    );
                  }

                  if (!isSlotActive) {
                    return (
                      <td key={d.key} className="p-1 border-r last:border-r-0 border-slate-200 h-14">
                        <div className="w-full h-full min-h-[48px] max-h-[48px] rounded-xl border border-dashed border-slate-100 flex items-center justify-center text-[10.5px] text-slate-300 font-medium bg-slate-50/20">
                          공강
                        </div>
                      </td>
                    );
                  }

                  const isNormalSelected = isSelected && !hasClassEvent;

                  return (
                    <td key={d.key} className="p-1 border-r last:border-r-0 border-slate-200 h-14">
                      <button
                        type="button"
                        onClick={() => handleSlotClick(d.key, period, slot!)}
                        className={cn(
                          "w-full h-full min-h-[48px] max-h-[48px] p-1 sm:p-1.5 rounded-xl border-[1.5px] transition-all flex flex-col items-center justify-center text-center relative group shadow-2xs",
                          isNormalSelected
                            ? "border-indigo-600 bg-indigo-600 text-white ring-2 ring-indigo-600 ring-offset-2 scale-[1.03] shadow-md z-10 cursor-pointer"
                            : "border-slate-200/90 bg-white hover:border-indigo-400 hover:bg-indigo-50/30 hover:scale-[1.01] hover:shadow-sm cursor-pointer"
                        )}
                      >
                        {/* 선택 체크마크 뱃지 */}
                        {isNormalSelected && (
                          <div className="absolute -top-2 -left-2 w-5.5 h-5.5 rounded-full bg-white flex items-center justify-center shadow-md border-2 border-indigo-600 z-20 shrink-0 aspect-square">
                            <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" strokeWidth={3.5} />
                          </div>
                        )}

                        {/* 교시 복제/변형 운영 뱃지 */}
                        {!isNormalSelected && isPeriodOverridden && (
                          <span className="absolute -top-1.5 -left-1 text-[8px] px-1 py-0.1 rounded-full font-black bg-indigo-600 text-white shadow-xs z-20 leading-tight ring-1 ring-white/50">
                            🔄 {targetPeriod}교시
                          </span>
                        )}

                        {/* 상단: 과목명 */}
                        <span className={cn(
                          "font-bold text-[11.5px] tracking-tight truncate max-w-full leading-tight",
                          isNormalSelected 
                            ? "text-white" 
                            : "text-slate-900 font-extrabold"
                        )}>
                          {slot?.subjectName}
                        </span>

                        {/* 하단: 학반 뱃지 (학과별 고유 테마 컬러 적용) */}
                        {slot?.classCode && classInfo && (
                          <div className="flex items-center justify-center gap-1 mt-0.5 max-w-full overflow-hidden">
                            <span className={cn(
                              "text-[9px] px-1.5 py-0.2 rounded font-black truncate shrink-0 transition-colors shadow-2xs",
                              isNormalSelected 
                                ? "bg-white/20 text-white" 
                                : getClassDeptBadgeStyle(slot.classCode).pill
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
