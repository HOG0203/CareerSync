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
  getUpcomingDateForDay 
} from '@/lib/substitute/validator';
import { cn } from '@/lib/utils';
import { 
  User, 
  Sparkles, 
  CheckCircle2, 
  Lock, 
  ArrowLeftRight, 
  Check, 
  Info,
  Calendar
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
  selectedTargetDate?: string;
  selectedTargetPeriod?: number;
  onSelectSlot: (targetDate: string, targetDay: string, targetPeriod: number, partnerSubject?: string, partnerClass?: string) => void;
  compact?: boolean;
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

  // 날짜별 바쁜 교사 목록 수집
  const busyTeachersOnDate = React.useMemo(() => {
    const map = new Map<string, Set<string>>();
    existingApplications.forEach(app => {
      if (app.status !== 'rejected') {
        app.items.forEach(it => {
          if (it.type === 'substitute' && it.substituteTeacher) {
            const key = `${it.sourceDate}_${it.sourcePeriod}`;
            if (!map.has(key)) map.set(key, new Set());
            map.get(key)!.add(it.substituteTeacher);
          }
          if (it.type === 'exchange' && it.targetTeacher && it.targetDate && it.targetPeriod) {
            const key = `${it.targetDate}_${it.targetPeriod}`;
            if (!map.has(key)) map.set(key, new Set());
            map.get(key)!.add(it.targetTeacher);
          }
        });
      }
    });
    return map;
  }, [existingApplications]);

  // 상대 교사가 신청 시간(sourceDay, sourcePeriod)에 공강인지 여부
  const isPartnerFreeAtSource = React.useMemo(() => {
    if (!partnerTeacher) return false;
    const slot = partnerTeacher.slots[`${actualSourceDay}_${sourcePeriod}`];
    const hasClass = Boolean(slot && slot.subjectName && slot.subjectName.trim() !== '' && slot.subjectName !== '-' && slot.subjectName !== '공강');
    const isBusy = busyTeachersOnDate.get(`${validSourceDate}_${sourcePeriod}`)?.has(partnerTeacherName);
    return !hasClass && !isBusy;
  }, [partnerTeacher, actualSourceDay, sourcePeriod, partnerTeacherName, validSourceDate, busyTeachersOnDate]);

  // 슬롯 상태 판별 함수
  const getSlotState = React.useCallback((day: string, period: number) => {
    if (!partnerTeacher || !currentTeacher) {
      return { type: 'DISABLED', label: '교사 미선택', reason: '교사를 선택해 주세요' };
    }

    const targetDate = getDateForDayInSameWeek(validSourceDate, day);

    // 1) 신청 슬롯과 동일한 요일/교시면 선택 불가
    if (day === actualSourceDay && period === sourcePeriod) {
      return { type: 'SOURCE_SAME', label: '원래 수업 시간', reason: '맞바꿀 내 수업 시간입니다' };
    }

    // 2) 상대 교사가 원래 수업 시간에 수업이 있다면 전체 불가
    if (!isPartnerFreeAtSource) {
      return { 
        type: 'DISABLED', 
        label: '상대 교사 수업 중', 
        reason: `${partnerTeacherName} 선생님이 ${actualSourceDay}요일 ${sourcePeriod}교시에 이미 정규 수업이 있습니다` 
      };
    }

    // 3) 내가 해당 요일/교시에 정규 수업이 있는지 확인
    const mySlot = currentTeacher.slots[`${day}_${period}`];
    const myHasClass = Boolean(mySlot && mySlot.subjectName && mySlot.subjectName.trim() !== '' && mySlot.subjectName !== '-' && mySlot.subjectName !== '공강');
    const myIsBusy = busyTeachersOnDate.get(`${targetDate}_${period}`)?.has(currentTeacherName);

    if (myHasClass || myIsBusy) {
      return { 
        type: 'MY_BUSY', 
        label: '본인 수업 있음', 
        reason: `내가 ${day}요일 ${period}교시에 '${mySlot?.subjectName || '수업'}'(${mySlot?.classCode || ''}) 수업이 있습니다`,
        mySubject: mySlot?.subjectName,
        myClass: mySlot?.classCode
      };
    }

    // 4) 상대 교사의 해당 요일/교시 슬롯 정보
    const partnerSlot = partnerTeacher.slots[`${day}_${period}`];
    const partnerHasClass = Boolean(partnerSlot && partnerSlot.subjectName && partnerSlot.subjectName.trim() !== '' && partnerSlot.subjectName !== '-' && partnerSlot.subjectName !== '공강');

    // Case 1: 동일 학반 수업 (최우선 추천 ★★★★★)
    if (partnerHasClass && sourceSlot.classCode && partnerSlot?.classCode === sourceSlot.classCode) {
      return {
        type: 'RECOMMENDED_SAME_CLASS',
        label: '★ 동일학반 최우선 맞교환',
        partnerSubject: partnerSlot.subjectName,
        partnerClass: partnerSlot.classCode,
        targetDate,
      };
    }

    // Case 2: 상대 교사의 다른 수업 (학반 불일치 ➔ 학생 시간표 충돌로 맞교환 불가)
    if (partnerHasClass) {
      return {
        type: 'DISABLED',
        label: '학반 불일치 (교체 불가)',
        reason: `${partnerTeacherName} 선생님이 '${partnerSlot?.subjectName}'(${partnerSlot?.classCode}) 수업 중이나, 내 학반(${sourceSlot.classCode || '원래 학반'})과 달라 맞교환이 불가능합니다`,
        partnerSubject: partnerSlot?.subjectName,
        partnerClass: partnerSlot?.classCode,
      };
    }

    // Case 3: 공강 (수업 교체는 공강과 교체 불가 - 동일 학반 수업만 교체 가능)
    return {
      type: 'DISABLED',
      label: '공강 (교체 불가)',
      reason: '수업 교체는 공강과 교체할 수 없습니다 (동일 학반 정규 수업만 맞교환 가능)',
      partnerSubject: '공강',
      targetDate,
    };
  }, [partnerTeacher, currentTeacher, validSourceDate, actualSourceDay, sourcePeriod, isPartnerFreeAtSource, partnerTeacherName, currentTeacherName, busyTeachersOnDate, sourceSlot]);

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
            <SelectContent className="max-h-60">
              {timetableData.teachers.filter(t => t.teacherName !== currentTeacherName).map(t => (
                <SelectItem key={t.teacherName} value={t.teacherName} className="text-xs font-bold">
                  <span>{t.teacherName} 선생님</span>
                  {t.homeroomClass && <span className="ml-1 text-[10px] text-indigo-600">({t.homeroomClass})</span>}
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
                return (
                  <th 
                    key={day} 
                    className={cn(
                      "py-1.5 px-1 border-r border-indigo-100 last:border-r-0 min-w-[70px]",
                      isSourceDay && "bg-indigo-100/60 font-black text-indigo-900"
                    )}
                  >
                    <div className="leading-tight">
                      <span>{day}요일</span>
                      {dayDate && (
                        <span className="block text-[9px] font-normal text-slate-400">
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
                                "px-1 py-0.2 rounded font-black",
                                isSelected ? "bg-white/20 text-white" : state.type === 'RECOMMENDED_SAME_CLASS' ? "bg-indigo-200 text-indigo-900" : "bg-slate-200 text-slate-800"
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
