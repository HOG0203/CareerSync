'use client';

// ==============================================================================
// src/app/(dashboard)/teaching-support/substitute/partner-timetable-picker.tsx
// 상대 교사 인터랙티브 주간 시간표 매트릭스 뷰어 (상대 시간표 보며 원클릭 맞교환)
// ==============================================================================

import * as React from 'react';
import { ParsedTimetableResult, TeacherTimetableSummary, TimetableSlot } from '@/lib/timetable/parser';
import { SubstituteApplication } from '@/lib/substitute/types';
import { 
  getDateForDayInSameWeek, 
  getDayOfWeekFromDate, 
  getUpcomingDateForDay,
  checkIsSameSubject,
  checkIsSameDept
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
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  User, 
  Sparkles, 
  CheckCircle2, 
  Lock, 
  ArrowLeftRight, 
  Check, 
  Info,
  Calendar,
  FileEdit,
  Palmtree
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DAYS = ['월', '화', '수', '목', '금'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

export interface PartnerTimetablePickerProps {
  partnerTeacherName: string;
  onSelectPartnerTeacher: (name: string) => void;
  sourceDate: string;
  sourceDay: string;
  sourcePeriod: number;
  sourceSlot: { classCode?: string; subjectName?: string; deptName?: string };
  currentTeacherName: string;
  timetableData: ParsedTimetableResult;
  existingApplications: SubstituteApplication[];
  calendarConfig?: AcademicCalendarConfig;
  selectedTargetDate?: string;
  selectedTargetPeriod?: number;
  onSelectSlot: (targetDate: string, targetDay: string, targetPeriod: number, partnerSubject?: string, partnerClass?: string) => void;
  compact?: boolean;
}

// 특정 교사의 특정 날짜/교시 실시간 유효 수업 정보 (교체/보강 변동사항 100% 반영)
function getEffectiveTeacherSlot(
  teacher: TeacherTimetableSummary | undefined,
  dateStr: string,
  period: number,
  dayOfWeek: string,
  existingApplications: SubstituteApplication[],
  calendarConfig?: AcademicCalendarConfig
): {
  hasClass: boolean;
  subjectName?: string;
  classCode?: string;
  deptName?: string;
  isExchangeIn?: boolean;
  isExchangeOut?: boolean;
  isTeachingSub?: boolean;
  isAbsenceSub?: boolean;
  partnerTeacher?: string;
  status?: 'approved' | 'submitted';
} {
  if (!teacher) return { hasClass: false };

  const specialDay = calendarConfig ? getSpecialDaySchedule(dateStr, calendarConfig) : null;
  const effectiveDayKey = specialDay ? specialDay.targetDayOfWeek : dayOfWeek;
  const effectivePeriod = specialDay?.periodOverrides?.[period] ?? period;

  const regularSlot = teacher.slots[`${effectiveDayKey}_${effectivePeriod}`];
  const hasRegularClass = Boolean(
    regularSlot && regularSlot.subjectName && regularSlot.subjectName.trim() !== '' && regularSlot.subjectName !== '-' && regularSlot.subjectName !== '공강'
  );

  const teacherName = teacher.teacherName;
  const activeApps = existingApplications.filter(app => app.status !== 'rejected');

  let modification: {
    type: 'exchange_out' | 'exchange_in' | 'absence_substitute' | 'teaching_substitute';
    partnerTeacher: string;
    subjectName?: string;
    classCode?: string;
    deptName?: string;
    status: 'approved' | 'submitted';
  } | null = null;

  for (const app of activeApps) {
    const appStatus = app.status === 'approved' ? 'approved' : 'submitted';
    for (const it of app.items) {
      if (it.type === 'substitute') {
        if (it.originalTeacher === teacherName && it.sourceDate === dateStr && it.sourcePeriod === period) {
          modification = {
            type: 'absence_substitute',
            partnerTeacher: it.substituteTeacher || '보강교사',
            status: appStatus,
          };
        }
        if (it.substituteTeacher === teacherName && it.sourceDate === dateStr && it.sourcePeriod === period) {
          modification = {
            type: 'teaching_substitute',
            partnerTeacher: it.originalTeacher,
            subjectName: it.subjectName,
            classCode: it.classCode,
            deptName: it.deptName,
            status: appStatus,
          };
        }
      }
      if (it.type === 'exchange') {
        if (app.applicantTeacher === teacherName) {
          if (it.sourceDate === dateStr && it.sourcePeriod === period) {
            modification = {
              type: 'exchange_out',
              partnerTeacher: it.targetTeacher || '교체교사',
              status: appStatus,
            };
          }
          if (it.targetDate === dateStr && it.targetPeriod === period) {
            modification = {
              type: 'exchange_in',
              partnerTeacher: it.targetTeacher || '교체교사',
              subjectName: it.targetSubject || it.subjectName,
              classCode: it.classCode,
              deptName: it.deptName,
              status: appStatus,
            };
          }
        }
        if (it.targetTeacher === teacherName && app.applicantTeacher !== teacherName) {
          if (it.targetDate === dateStr && it.targetPeriod === period) {
            modification = {
              type: 'exchange_out',
              partnerTeacher: app.applicantTeacher,
              status: appStatus,
            };
          }
          if (it.sourceDate === dateStr && it.sourcePeriod === period) {
            modification = {
              type: 'exchange_in',
              partnerTeacher: app.applicantTeacher,
              subjectName: it.subjectName,
              classCode: it.classCode,
              deptName: it.deptName,
              status: appStatus,
            };
          }
        }
      }
    }
  }

  // 1) 교체받아 들어온 수업이거나 보강 수업 -> 수업 있음!
  if (modification && (modification.type === 'exchange_in' || modification.type === 'teaching_substitute')) {
    return {
      hasClass: true,
      subjectName: modification.subjectName || regularSlot?.subjectName || '교체수업',
      classCode: modification.classCode || regularSlot?.classCode || '',
      deptName: modification.deptName || regularSlot?.deptName || '',
      isExchangeIn: modification.type === 'exchange_in',
      isTeachingSub: modification.type === 'teaching_substitute',
      partnerTeacher: modification.partnerTeacher,
      status: modification.status,
    };
  }

  // 2) 교체 나간 수업 또는 결강 수업 -> 실제로 수업 없음(공강)!
  if (modification && (modification.type === 'exchange_out' || modification.type === 'absence_substitute')) {
    return {
      hasClass: false,
      subjectName: regularSlot?.subjectName,
      classCode: regularSlot?.classCode,
      deptName: regularSlot?.deptName,
      isExchangeOut: modification.type === 'exchange_out',
      isAbsenceSub: modification.type === 'absence_substitute',
      partnerTeacher: modification.partnerTeacher,
      status: modification.status,
    };
  }

  // 3) 일반 정규 수업
  return {
    hasClass: hasRegularClass,
    subjectName: regularSlot?.subjectName,
    classCode: regularSlot?.classCode,
    deptName: regularSlot?.deptName,
  };
}

export function PartnerTimetablePicker({
  partnerTeacherName,
  onSelectPartnerTeacher,
  sourceDate,
  sourceDay,
  sourcePeriod,
  sourceSlot,
  currentTeacherName,
  timetableData,
  existingApplications,
  calendarConfig = DEFAULT_ACADEMIC_CALENDAR_2026_2,
  selectedTargetDate,
  selectedTargetPeriod,
  onSelectSlot,
  compact = false,
}: PartnerTimetablePickerProps) {
  const currentTeacher = React.useMemo(() => {
    return timetableData.teachers.find(t => t.teacherName === currentTeacherName);
  }, [timetableData.teachers, currentTeacherName]);

  const partnerTeacher = React.useMemo(() => {
    return timetableData.teachers.find(t => t.teacherName === partnerTeacherName);
  }, [timetableData.teachers, partnerTeacherName]);

  const validSourceDate = sourceDate || getUpcomingDateForDay(sourceDay || '월');
  const actualSourceDay = sourceDay || getDayOfWeekFromDate(validSourceDate) || '월';

  // 파트너 추천 교사 목록 정렬: 동일교과(1순위) -> 동일학과(2순위) -> 신청시간 공강 교사 -> 가나다순
  const sortedTeachers = React.useMemo(() => {
    const list = timetableData.teachers
      .filter(t => t.teacherName !== currentTeacherName)
      .map(t => {
        const isSameSubject = checkIsSameSubject(sourceSlot.subjectName, currentTeacher, t);
        const isSameDept = checkIsSameDept(sourceSlot.deptName, sourceSlot.classCode, currentTeacher, t);
        
        // 실시간 공강 판별
        const effective = getEffectiveTeacherSlot(t, validSourceDate, sourcePeriod, actualSourceDay, existingApplications, calendarConfig);
        const isFreeAtSource = !effective.hasClass;

        return {
          ...t,
          isSameSubject,
          isSameDept,
          isFreeAtSource,
        };
      });

    return list.sort((a, b) => {
      if (a.isSameSubject && !b.isSameSubject) return -1;
      if (!a.isSameSubject && b.isSameSubject) return 1;
      if (a.isSameDept && !b.isSameDept) return -1;
      if (!a.isSameDept && b.isSameDept) return 1;
      if (a.isFreeAtSource && !b.isFreeAtSource) return -1;
      if (!a.isFreeAtSource && b.isFreeAtSource) return 1;
      return a.teacherName.localeCompare(b.teacherName, 'ko');
    });
  }, [timetableData.teachers, currentTeacherName, currentTeacher, sourceSlot, actualSourceDay, sourcePeriod, validSourceDate, existingApplications, calendarConfig]);

  // 상대 교사가 신청 시간(sourceDay, sourcePeriod)에 실제로 공강인지 여부
  const isPartnerFreeAtSource = React.useMemo(() => {
    if (!partnerTeacher) return false;
    const effective = getEffectiveTeacherSlot(partnerTeacher, validSourceDate, sourcePeriod, actualSourceDay, existingApplications, calendarConfig);
    return !effective.hasClass;
  }, [partnerTeacher, validSourceDate, sourcePeriod, actualSourceDay, existingApplications, calendarConfig]);

  // 슬롯 상태 판별 함수 (학사일정 및 실시간 교체/보강 100% 반영)
  const getSlotState = React.useCallback((day: string, period: number) => {
    if (!partnerTeacher || !currentTeacher) {
      return { type: 'DISABLED', label: '교사 미선택', reason: '교사를 선택해 주세요' };
    }

    const targetDate = getDateForDayInSameWeek(validSourceDate, day);

    // [학사일정 1] 방학 / 휴업일 검사
    const vacation = getVacationForDate(targetDate, calendarConfig);
    if (vacation) {
      return {
        type: 'DISABLED',
        label: `🌴 ${vacation.name}`,
        reason: `${vacation.name} (수업 없음)`,
      };
    }

    // [학사일정 2] 지필평가 / 시험 기간 검사
    const examInfo = getExamSlotInfo(targetDate, period, sourceSlot.classCode, calendarConfig);
    if (examInfo?.isExamRunning) {
      return {
        type: 'DISABLED',
        label: `📝 ${examInfo.exam.name}`,
        reason: `${examInfo.exam.name} 시험 진행 중 (정규 수업 없음)`,
      };
    }
    if (examInfo?.isDismissed) {
      return {
        type: 'DISABLED',
        label: '🏠 시험 후 하교',
        reason: '시험 후 하교 (수업 없음)',
      };
    }

    // [학사일정 3] 단축수업 검사
    const specialDay = getSpecialDaySchedule(targetDate, calendarConfig);
    if (specialDay?.shortenedPeriods && period > specialDay.shortenedPeriods) {
      return {
        type: 'DISABLED',
        label: `⏰ ${specialDay.shortenedPeriods}교시 단축`,
        reason: `단축수업(${specialDay.shortenedPeriods}교시 단축)으로 인해 수업이 없습니다`,
      };
    }

    // 1) 신청 슬롯과 동일한 요일/교시면 선택 불가
    if (day === actualSourceDay && period === sourcePeriod) {
      return { type: 'SOURCE_SAME', label: '원래 수업 시간', reason: '맞바꿀 내 수업 시간입니다' };
    }

    // 2) 상대 교사가 원래 수업 시간에 수업이 있다면 전체 불가
    if (!isPartnerFreeAtSource) {
      return { 
        type: 'DISABLED', 
        label: '상대 교사 수업 중', 
        reason: `${partnerTeacherName} 선생님이 ${actualSourceDay}요일 ${sourcePeriod}교시에 이미 수업이 있습니다` 
      };
    }

    // 3) 내가 해당 요일/교시에 실시간 수업 또는 행사가 있는지 확인
    const myEffective = getEffectiveTeacherSlot(currentTeacher, targetDate, period, day, existingApplications, calendarConfig);

    // 내 행사 검사
    const myEvents = getEventsForSlot(targetDate, period, myEffective.classCode || sourceSlot.classCode, currentTeacherName, calendarConfig);
    if (myEvents.length > 0) {
      return {
        type: 'MY_BUSY',
        label: `본인 행사 (${myEvents[0].title})`,
        reason: `내가 '${myEvents[0].title}' 행사를 인솔/진행 중입니다`,
      };
    }

    if (myEffective.hasClass) {
      return { 
        type: 'MY_BUSY', 
        label: '본인 수업 있음', 
        reason: `내가 ${day}요일 ${period}교시에 '${myEffective.subjectName || '수업'}'(${myEffective.classCode || ''}) 수업이 있습니다`,
        mySubject: myEffective.subjectName,
        myClass: myEffective.classCode
      };
    }

    // 4) 상대 교사의 해당 요일/교시 실시간 슬롯 정보 및 행사 검사
    const partnerEffective = getEffectiveTeacherSlot(partnerTeacher, targetDate, period, day, existingApplications, calendarConfig);

    // 상대 교사 행사 검사
    const partnerEvents = getEventsForSlot(targetDate, period, partnerEffective.classCode, partnerTeacherName, calendarConfig);
    if (partnerEvents.length > 0) {
      return {
        type: 'DISABLED',
        label: `상대 행사 (${partnerEvents[0].title})`,
        reason: `${partnerTeacherName} 선생님이 '${partnerEvents[0].title}' 행사 인솔/진행 중입니다`,
      };
    }

    // 상대 학급 행사 검사
    const partnerClassEvents = partnerEffective.classCode ? getClassEventsForSlot(targetDate, period, partnerEffective.classCode, calendarConfig) : [];
    if (partnerClassEvents.length > 0) {
      return {
        type: 'DISABLED',
        label: `학급 행사 (${partnerClassEvents[0].title})`,
        reason: `${partnerEffective.classCode} 학급이 '${partnerClassEvents[0].title}' 행사 진행 중입니다`,
        partnerSubject: `🎭 ${partnerClassEvents[0].title}`,
        partnerClass: partnerEffective.classCode,
      };
    }

    // Case 1: 동일 학반 수업 (최우선 추천 ★★★★★)
    if (partnerEffective.hasClass && sourceSlot.classCode && partnerEffective.classCode === sourceSlot.classCode) {
      return {
        type: 'RECOMMENDED_SAME_CLASS',
        label: partnerEffective.isExchangeIn ? '★ 동일학반 재교체 추천' : '★ 동일학반 최우선 맞교환',
        partnerSubject: partnerEffective.subjectName,
        partnerClass: partnerEffective.classCode,
        isExchangeIn: partnerEffective.isExchangeIn,
        targetDate,
      };
    }

    // Case 2: 상대 교사의 다른 수업 (학반 불일치 ➔ 학생 시간표 충돌로 맞교환 불가)
    if (partnerEffective.hasClass) {
      return {
        type: 'DISABLED',
        label: '학반 불일치 (교체 불가)',
        reason: `${partnerTeacherName} 선생님이 '${partnerEffective.subjectName}'(${partnerEffective.classCode}) 수업 중이나, 내 학반(${sourceSlot.classCode || '원래 학반'})과 달라 맞교환이 불가능합니다`,
        partnerSubject: partnerEffective.subjectName,
        partnerClass: partnerEffective.classCode,
      };
    }

    // Case 3: 공강 (수업 교체는 공강과 교체 불가 - 동일 학반 정규 수업만 맞교환 가능)
    return {
      type: 'DISABLED',
      label: '공강 (교체 불가)',
      reason: '수업 교체는 공강과 교체할 수 없습니다 (동일 학반 수업만 맞교환 가능)',
      partnerSubject: '공강',
      targetDate,
    };
  }, [partnerTeacher, currentTeacher, validSourceDate, actualSourceDay, sourcePeriod, isPartnerFreeAtSource, partnerTeacherName, currentTeacherName, existingApplications, sourceSlot, calendarConfig]);

  return (
    <div className="space-y-2.5 bg-gradient-to-b from-slate-50 to-indigo-50/30 p-3.5 rounded-2xl border border-indigo-200/70 shadow-2xs">
      {/* 1. 상단 상대 교사 선택 & 요약 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
            <User className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-slate-900">상대 선생님 시간표</span>
              <span className="text-[10.5px] text-indigo-600 font-bold">
                (원하는 시간대 슬롯을 직접 클릭하세요)
              </span>
            </div>
          </div>
        </div>

        {/* 상대 교사 변경 셀렉트 */}
        <div className="flex items-center gap-1.5">
          <Select value={partnerTeacherName} onValueChange={onSelectPartnerTeacher}>
            <SelectTrigger className="h-8 text-xs font-black bg-white border-indigo-200 rounded-xl text-slate-900 min-w-[140px]">
              <SelectValue placeholder="선생님 선택..." />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {sortedTeachers.map(t => (
                <SelectItem key={t.teacherName} value={t.teacherName} className="text-xs font-bold">
                  <span>{t.teacherName} 선생님</span>
                  {t.isSameSubject ? (
                    <span className="ml-1.5 text-[9.5px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-900 font-black border border-blue-200">
                      ★ 동일교과
                    </span>
                  ) : t.isSameDept ? (
                    <span className="ml-1.5 text-[9.5px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 font-black border border-emerald-200">
                      동일학과
                    </span>
                  ) : null}
                  {t.homeroomClass && <span className="ml-1 text-[10px] text-indigo-600">({t.homeroomClass})</span>}
                  {!t.isFreeAtSource && <span className="ml-1 text-[9.5px] text-rose-500 font-medium">(수업중)</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 2. 상대 교사 공강 경고 안내 (만약 상대가 내 시간에 수업 중인 경우) */}
      {!isPartnerFreeAtSource && partnerTeacher && (
        <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          <span>
            {partnerTeacherName} 선생님은 {actualSourceDay}요일 {sourcePeriod}교시에 이미 정규 수업이 있어 맞교환이 불가능합니다. (다른 선생님을 선택해 주세요)
          </span>
        </div>
      )}

      {/* 3. 범례 안내 (Legend) */}
      <div className="flex items-center gap-2 flex-wrap text-[10px] font-bold pt-0.5">
        <span className="flex items-center gap-1 text-indigo-900">
          <span className="w-2.5 h-2.5 rounded bg-indigo-600 border border-indigo-700" />
          선택됨
        </span>
        <span className="flex items-center gap-1 text-indigo-700">
          <span className="w-2.5 h-2.5 rounded bg-indigo-100 border border-indigo-400" />
          ★ 동일학반 최우선
        </span>
        <span className="flex items-center gap-1 text-emerald-800">
          <span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-400" />
          상호 공강
        </span>
        <span className="flex items-center gap-1 text-amber-900">
          <span className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-400" />
          수업 맞교환
        </span>
        <span className="flex items-center gap-1 text-slate-400">
          <span className="w-2.5 h-2.5 rounded bg-slate-200 border border-slate-300" />
          교체 불가(충돌)
        </span>
      </div>

      {/* 4. 상대 교사 주간 시간표 매트릭스 그리드 (5일 x 7교시) */}
      <div className="overflow-x-auto rounded-xl border border-indigo-200/80 bg-white shadow-2xs">
        <table className="w-full text-center border-collapse text-xs">
          <thead>
            <tr className="bg-indigo-50/70 border-b border-indigo-100 text-[11px] font-black text-indigo-950">
              <th className="py-1.5 px-1 w-10 border-r border-indigo-100 text-slate-500 font-bold">교시</th>
              {DAYS.map(day => {
                const dayDate = getDateForDayInSameWeek(validSourceDate, day);
                const isSourceDay = day === actualSourceDay;
                const vacation = getVacationForDate(dayDate, calendarConfig);
                const exam = getExamPeriodForDate(dayDate, calendarConfig);
                const specialDay = getSpecialDaySchedule(dayDate, calendarConfig);

                return (
                  <th 
                    key={day} 
                    className={cn(
                      "py-1.5 px-1 border-r border-indigo-100 last:border-r-0 min-w-[70px]",
                      isSourceDay && "bg-indigo-100/60 font-black text-indigo-900"
                    )}
                  >
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        <span>{specialDay && specialDay.targetDayOfWeek !== day ? `${day}(${specialDay.targetDayOfWeek})` : `${day}요일`}</span>
                        {vacation && (
                          <span className="px-1 py-0 rounded text-[8px] font-black bg-emerald-100 text-emerald-800" title={vacation.name}>
                            🌴 {vacation.name}
                          </span>
                        )}
                        {exam && !vacation && (
                          <span className="px-1 py-0 rounded text-[8px] font-black bg-rose-100 text-rose-800" title={exam.name}>
                            📝 시험
                          </span>
                        )}
                        {specialDay && (
                          <span className="px-1 py-0 rounded text-[8px] font-black bg-indigo-100 text-indigo-800" title={specialDay.description}>
                            🔄 {specialDay.targetDayOfWeek !== day ? `${specialDay.targetDayOfWeek}수업` : '교시변형'}
                          </span>
                        )}
                      </div>
                      {dayDate && (
                        <span className="text-[9px] font-mono text-indigo-600 font-bold">
                          {dayDate.slice(5)}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map(period => {
              return (
                <tr key={period} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">
                  <td className="py-1 px-1 text-[11px] font-black text-slate-600 bg-slate-50/80 border-r border-slate-100">
                    {period}
                  </td>
                  {DAYS.map(day => {
                    const targetDate = getDateForDayInSameWeek(validSourceDate, day);
                    const state = getSlotState(day, period);
                    const isSelected = selectedTargetDate === targetDate && selectedTargetPeriod === period;
                    const isClickable = state.type.startsWith('RECOMMENDED');

                    return (
                      <td
                        key={`${day}_${period}`}
                        className="p-0.5 border-r border-slate-100 last:border-r-0 align-middle"
                      >
                        <button
                          type="button"
                          disabled={!isClickable}
                          onClick={() => {
                            if (isClickable) {
                              onSelectSlot(
                                targetDate,
                                day,
                                period,
                                state.partnerSubject,
                                state.partnerClass
                              );
                            }
                          }}
                          className={cn(
                            "w-full h-11 p-1 rounded-lg border text-left transition-all flex flex-col justify-between select-none relative",
                            isSelected
                              ? "bg-indigo-600 text-white border-indigo-600 font-bold ring-2 ring-indigo-600/40 shadow-xs z-10"
                              : state.type === 'RECOMMENDED_SAME_CLASS'
                              ? "bg-indigo-50 text-indigo-950 border-indigo-300 hover:border-indigo-500 hover:bg-indigo-100 cursor-pointer shadow-2xs"
                              : state.type === 'RECOMMENDED_MUTUAL_FREE'
                              ? "bg-emerald-50 text-emerald-950 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100 cursor-pointer"
                              : state.type === 'RECOMMENDED_SAME_DEPT' || state.type === 'RECOMMENDED_CROSS_CLASS'
                              ? "bg-amber-50/60 text-amber-950 border-amber-200 hover:border-amber-400 hover:bg-amber-100 cursor-pointer"
                              : state.type === 'SOURCE_SAME'
                              ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60"
                              : "bg-slate-50/80 text-slate-400 border-slate-200/60 cursor-not-allowed opacity-50"
                          )}
                          title={state.label + (state.reason ? ` (${state.reason})` : '')}
                        >
                          {/* 상단: 과목/상태 레이블 */}
                          <div className="flex items-center justify-between w-full">
                            <span className={cn(
                              "text-[10px] font-black truncate max-w-[65px] leading-tight",
                              isSelected ? "text-white" : ""
                            )}>
                              {state.partnerSubject || '공강'}
                            </span>
                            {isSelected && <Check className="h-3 w-3 text-white shrink-0" />}
                          </div>

                          {/* 하단: 학반 뱃지 또는 추천 태그 */}
                          <div className="flex items-center justify-between w-full text-[9px] leading-tight">
                            {state.partnerClass ? (
                              <span className={cn(
                                "px-1.5 py-0.2 rounded font-black truncate max-w-[44px]",
                                isSelected ? "bg-white/20 text-white" : getClassDeptBadgeStyle(state.partnerClass).pill
                              )}>
                                {state.partnerClass}
                              </span>
                            ) : (
                              <span className={cn(
                                "text-[8.5px]",
                                isSelected ? "text-indigo-200" : "text-slate-400"
                              )}>
                                {state.type === 'RECOMMENDED_MUTUAL_FREE' ? '공강' : '-'}
                              </span>
                            )}

                            {state.type === 'RECOMMENDED_SAME_CLASS' && !isSelected && (
                              <span className="text-[8.5px] font-black text-indigo-700">★추천</span>
                            )}
                          </div>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
