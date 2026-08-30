// ==============================================================================
// src/lib/substitute/validator.ts
// 결보강 및 수업 교체 3중 충돌 검증 및 스마트 공강 교사 추천 엔진
// ==============================================================================

import { ParsedTimetableResult, TeacherTimetableSummary } from '@/lib/timetable/parser';
import { SubstituteApplication, SubstituteItem, ConflictCheckResult, AvailableTeacher } from './types';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * YYYY-MM-DD 날짜 문자열에서 요일("월" ~ "금") 정확히 추출 (타임존 오차 방지)
 */
export function getDayOfWeekFromDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return DAY_NAMES[d.getDay()] || '';
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return DAY_NAMES[d.getDay()] || '';
}

/**
 * 지정된 요일(예: "화")에 해당하는 가장 가까운 일자(YYYY-MM-DD) 계산
 */
export function getUpcomingDateForDay(targetDay: string): string {
  const dayIndexMap: Record<string, number> = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
  const targetDayIdx = dayIndexMap[targetDay] ?? 1;
  const now = new Date();
  const currentDayIdx = now.getDay();
  
  let diff = targetDayIdx - currentDayIdx;
  if (diff < 0) {
    diff += 7;
  }
  const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface SemesterWeek {
  weekNum: number;
  label: string; // "1주차 (08.31 ~ 09.04)"
  shortLabel: string; // "1주차"
  dateRangeLabel: string; // "08.31 ~ 09.04"
  startDate: string; // "2026-08-31"
  endDate: string; // "2026-09-04"
  dates: Record<string, string>; // { '월': '2026-08-31', '화': '2026-09-01', ... }
  monthDayLabels: Record<string, string>; // { '월': '08/31', '화': '09/01', ... }
}

/**
 * 학기 전체 주차 목록 생성 (예: 1주차 08.31 ~ 09.04)
 */
export function generateSemesterWeeks(
  academicYear = 2026,
  semester = 2,
  totalWeeks = 20
): SemesterWeek[] {
  // 2026학년도 2학기 개학일 기준: 2026-08-31 (월)
  const baseStart = semester === 2 ? new Date(academicYear, 7, 31) : new Date(academicYear, 2, 2);
  
  const dayOfWeek = baseStart.getDay();
  const mondayDiff = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : 8 - dayOfWeek);
  baseStart.setDate(baseStart.getDate() + mondayDiff);

  const weeks: SemesterWeek[] = [];
  const DAY_KEYS = ['월', '화', '수', '목', '금'];

  const formatYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const formatMD = (d: Date) => {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${m}.${day}`;
  };

  const formatSlashMD = (d: Date) => {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${m}/${day}`;
  };

  for (let w = 1; w <= totalWeeks; w++) {
    const monday = new Date(baseStart.getFullYear(), baseStart.getMonth(), baseStart.getDate() + (w - 1) * 7);
    const friday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 4);

    const dates: Record<string, string> = {};
    const monthDayLabels: Record<string, string> = {};

    DAY_KEYS.forEach((k, idx) => {
      const dayDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx);
      dates[k] = formatYMD(dayDate);
      monthDayLabels[k] = formatSlashMD(dayDate);
    });

    const startDate = formatYMD(monday);
    const endDate = formatYMD(friday);
    const dateRangeLabel = `${formatMD(monday)} ~ ${formatMD(friday)}`;

    weeks.push({
      weekNum: w,
      label: `${w}주차 (${dateRangeLabel})`,
      shortLabel: `${w}주차`,
      dateRangeLabel,
      startDate,
      endDate,
      dates,
      monthDayLabels,
    });
  }

  return weeks;
}

/**
 * 특정 일자·교시의 결보강 충돌 여부 정밀 검증
 */
export function checkSubstituteItemConflict(
  item: SubstituteItem,
  timetableData: ParsedTimetableResult,
  existingApplications: SubstituteApplication[],
  currentApplicationId?: string
): ConflictCheckResult {
  const otherApps = existingApplications.filter(
    app => app.id !== currentApplicationId && app.status !== 'rejected'
  );

  // 1. 신청 수업 슬롯의 중복 처리 여부 검사
  for (const app of otherApps) {
    for (const it of app.items) {
      if (
        it.sourceDate === item.sourceDate &&
        it.sourcePeriod === item.sourcePeriod &&
        it.originalTeacher === item.originalTeacher
      ) {
        return {
          hasConflict: true,
          conflictType: 'ALREADY_MODIFIED',
          message: `[중복 신청] ${item.originalTeacher} 선생님의 ${item.sourceDate} ${item.sourcePeriod}교시 수업은 이미 다른 신청서(${app.applicationNumber})에 등록되어 있습니다.`,
          details: {
            date: item.sourceDate,
            period: item.sourcePeriod,
            teacherName: item.originalTeacher,
            classCode: item.classCode
          }
        };
      }
    }
  }

  // 2. 수업 교체(exchange)인 경우의 충돌 검증 (1:1 맞교환 및 공강 교체 완벽 검증)
  if (item.type === 'exchange') {
    if (!item.targetDate || !item.targetPeriod || !item.targetTeacher) {
      return { hasConflict: true, message: '교체할 일자, 교시 및 교사를 모두 지정해야 합니다.' };
    }

    const sourceDay = item.sourceDay || getDayOfWeekFromDate(item.sourceDate);
    const targetDay = item.targetDay || getDayOfWeekFromDate(item.targetDate);
    const originalTeacherSummary = timetableData.teachers.find(t => t.teacherName === item.originalTeacher);
    const targetTeacherSummary = timetableData.teachers.find(t => t.teacherName === item.targetTeacher);

    // 2-1) 상대 교사(targetTeacher)가 원래 신청 시간(sourceDate, sourcePeriod)에 공강인지 검사
    if (targetTeacherSummary) {
      const sourceSlotOfTarget = targetTeacherSummary.slots[`${sourceDay}_${item.sourcePeriod}`];
      if (sourceSlotOfTarget && (sourceSlotOfTarget.subjectName || sourceSlotOfTarget.classCode)) {
        return {
          hasConflict: true,
          conflictType: 'TEACHER_BUSY',
          message: `[교사 충돌] ${item.targetTeacher} 선생님은 원래 수업 시간(${item.sourceDate}(${sourceDay}) ${item.sourcePeriod}교시)에 이미 '${sourceSlotOfTarget.subjectName}(${sourceSlotOfTarget.classCode})' 정규 수업이 있어 수업을 맡을 수 없습니다.`,
          details: {
            date: item.sourceDate,
            period: item.sourcePeriod,
            teacherName: item.targetTeacher,
            existingSubject: sourceSlotOfTarget.subjectName,
            classCode: sourceSlotOfTarget.classCode
          }
        };
      }
    }

    // 상대 교사가 sourceDate, sourcePeriod에 이미 다른 결보강 배정이 있는지 검사
    for (const app of otherApps) {
      for (const it of app.items) {
        const isTargetBusyAtSource = 
          (it.type === 'substitute' && it.substituteTeacher === item.targetTeacher && it.sourceDate === item.sourceDate && it.sourcePeriod === item.sourcePeriod) ||
          (it.type === 'exchange' && it.targetTeacher === item.targetTeacher && it.targetDate === item.sourceDate && it.targetPeriod === item.sourcePeriod);

        if (isTargetBusyAtSource) {
          return {
            hasConflict: true,
            conflictType: 'TEACHER_BUSY',
            message: `[교사 충돌] ${item.targetTeacher} 선생님은 ${item.sourceDate} ${item.sourcePeriod}교시에 이미 다른 보강/교체 배정이 있습니다.`,
            details: {
              date: item.sourceDate,
              period: item.sourcePeriod,
              teacherName: item.targetTeacher
            }
          };
        }
      }
    }

    // 2-2) 본인(originalTeacher)이 교체 대상 시간(targetDate, targetPeriod)에 공강인지 검사
    if (originalTeacherSummary) {
      const targetSlotOfOriginal = originalTeacherSummary.slots[`${targetDay}_${item.targetPeriod}`];
      if (targetSlotOfOriginal && (targetSlotOfOriginal.subjectName || targetSlotOfOriginal.classCode)) {
        return {
          hasConflict: true,
          conflictType: 'TEACHER_BUSY',
          message: `[본인 교사 충돌] ${item.originalTeacher} 선생님은 맞교환 대상 시간(${item.targetDate}(${targetDay}) ${item.targetPeriod}교시)에 이미 본인의 '${targetSlotOfOriginal.subjectName}(${targetSlotOfOriginal.classCode})' 정규 수업이 있습니다.`,
          details: {
            date: item.targetDate,
            period: item.targetPeriod,
            teacherName: item.originalTeacher,
            existingSubject: targetSlotOfOriginal.subjectName,
            classCode: targetSlotOfOriginal.classCode
          }
        };
      }
    }

    // 본인이 targetDate, targetPeriod에 이미 다른 결보강 배정이 있는지 검사
    for (const app of otherApps) {
      for (const it of app.items) {
        const isOriginalBusyAtTarget = 
          (it.type === 'substitute' && it.substituteTeacher === item.originalTeacher && it.sourceDate === item.targetDate && it.sourcePeriod === item.targetPeriod) ||
          (it.type === 'exchange' && it.targetTeacher === item.originalTeacher && it.targetDate === item.targetDate && it.targetPeriod === item.targetPeriod);

        if (isOriginalBusyAtTarget) {
          return {
            hasConflict: true,
            conflictType: 'TEACHER_BUSY',
            message: `[본인 교사 충돌] ${item.originalTeacher} 선생님은 ${item.targetDate} ${item.targetPeriod}교시에 이미 다른 보강/교체 배정이 있습니다.`,
            details: {
              date: item.targetDate,
              period: item.targetPeriod,
              teacherName: item.originalTeacher
            }
          };
        }
      }
    }

    // 2-3) 교체 대상 교사의 대상 일시 수업이 이미 다른 신청서에 선점되었는지 검사
    for (const app of otherApps) {
      for (const it of app.items) {
        const isTargetSlotTaken = 
          it.sourceDate === item.targetDate && 
          it.sourcePeriod === item.targetPeriod && 
          it.originalTeacher === item.targetTeacher;

        if (isTargetSlotTaken) {
          return {
            hasConflict: true,
            conflictType: 'ALREADY_MODIFIED',
            message: `[교체 대상 충돌] ${item.targetTeacher} 선생님의 ${item.targetDate} ${item.targetPeriod}교시 수업은 이미 다른 신청서(${app.applicationNumber})에서 교체/보강 처리되었습니다.`,
            details: {
              date: item.targetDate,
              period: item.targetPeriod,
              teacherName: item.targetTeacher
            }
          };
        }
      }
    }
  }

  // 3. 보강/대강(substitute)인 경우의 충돌 검증
  if (item.type === 'substitute') {
    if (!item.substituteTeacher) {
      return { hasConflict: true, message: '보강 교사를 지정해야 합니다.' };
    }

    const sourceDay = item.sourceDay || getDayOfWeekFromDate(item.sourceDate);
    const subTeacherSummary = timetableData.teachers.find(t => t.teacherName === item.substituteTeacher);

    // 3-1) 보강 교사의 정규 수업 유무 체크
    if (subTeacherSummary) {
      const regSlot = subTeacherSummary.slots[`${sourceDay}_${item.sourcePeriod}`];
      if (regSlot && regSlot.subjectName) {
        return {
          hasConflict: true,
          conflictType: 'TEACHER_BUSY',
          message: `[보강 교사 불가] ${item.substituteTeacher} 선생님은 ${item.sourceDate}(${sourceDay}) ${item.sourcePeriod}교시에 이미 '${regSlot.subjectName}(${regSlot.classCode})' 정규 수업이 있습니다.`,
          details: {
            date: item.sourceDate,
            period: item.sourcePeriod,
            teacherName: item.substituteTeacher,
            existingSubject: regSlot.subjectName,
            classCode: regSlot.classCode
          }
        };
      }
    }

    // 3-2) 보강 교사가 해당 일시 다른 보강에 이미 배정되었는지 체크
    for (const app of otherApps) {
      for (const it of app.items) {
        const isSubBusy = 
          (it.type === 'substitute' && it.substituteTeacher === item.substituteTeacher && it.sourceDate === item.sourceDate && it.sourcePeriod === item.sourcePeriod) ||
          (it.type === 'exchange' && it.targetTeacher === item.substituteTeacher && it.targetDate === item.sourceDate && it.targetPeriod === item.sourcePeriod);

        if (isSubBusy) {
          return {
            hasConflict: true,
            conflictType: 'TEACHER_BUSY',
            message: `[보강 교사 불가] ${item.substituteTeacher} 선생님은 ${item.sourceDate} ${item.sourcePeriod}교시에 이미 다른 보강/교체 배정이 있습니다.`,
            details: {
              date: item.sourceDate,
              period: item.sourcePeriod,
              teacherName: item.substituteTeacher
            }
          };
        }
      }
    }
  }

  return { hasConflict: false, message: '안전하게 등록 가능합니다.' };
}

/**
 * 특정 일자·교시에 수업이 없는 '실제 공강 교사' 추천 목록 추출
 */
export function getAvailableTeachersForSlot(
  dateStr: string,
  period: number,
  timetableData: ParsedTimetableResult,
  existingApplications: SubstituteApplication[],
  referenceDeptName?: string
): AvailableTeacher[] {
  const day = getDayOfWeekFromDate(dateStr);
  if (!day) return [];

  // 1. 이번 학기 교사별 누적 보강 횟수 계산
  const subCountMap: Record<string, number> = {};
  existingApplications.forEach(app => {
    if (app.status === 'approved' || app.status === 'submitted') {
      app.items.forEach(it => {
        if (it.type === 'substitute' && it.substituteTeacher) {
          subCountMap[it.substituteTeacher] = (subCountMap[it.substituteTeacher] || 0) + 1;
        }
      });
    }
  });

  // 2. 이미 해당 일자·교시에 결보강이 잡힌 교사 목록 수집
  const busyTeachersOnDate = new Set<string>();
  existingApplications.forEach(app => {
    if (app.status !== 'rejected') {
      app.items.forEach(it => {
        if (it.type === 'substitute' && it.sourceDate === dateStr && it.sourcePeriod === period && it.substituteTeacher) {
          busyTeachersOnDate.add(it.substituteTeacher);
        }
        if (it.type === 'exchange' && it.targetDate === dateStr && it.targetPeriod === period && it.targetTeacher) {
          busyTeachersOnDate.add(it.targetTeacher);
        }
      });
    }
  });

  // 3. 공강 교사 필터링
  const available: AvailableTeacher[] = [];

  timetableData.teachers.forEach(teacher => {
    // 3-1) 정규 시간표에서 해당 요일·교시가 비어있는지 확인
    const slot = teacher.slots[`${day}_${period}`];
    const hasRegularClass = Boolean(slot && (slot.subjectName || slot.classCode));

    if (hasRegularClass) return;

    // 3-2) 해당 날짜에 결보강 배정이 없는지 확인
    if (busyTeachersOnDate.has(teacher.teacherName)) return;

    // 같은 학과/교과군 여부 확인
    const isSameDept = Boolean(
      referenceDeptName && 
      (teacher.remarks?.includes(referenceDeptName) || teacher.homeroomClass?.includes(referenceDeptName.charAt(0)))
    );

    available.push({
      teacherName: teacher.teacherName,
      homeroomClass: teacher.homeroomClass,
      deptName: teacher.remarks || '',
      isSameDept,
      totalSubstitutesDone: subCountMap[teacher.teacherName] || 0
    });
  });

  // 4. 정렬: 동일 학과 우선 -> 누적 보강 횟수 적은 순 -> 교사명 가나다순
  available.sort((a, b) => {
    if (a.isSameDept && !b.isSameDept) return -1;
    if (!a.isSameDept && b.isSameDept) return 1;
    if (a.totalSubstitutesDone !== b.totalSubstitutesDone) {
      return a.totalSubstitutesDone - b.totalSubstitutesDone;
    }
    return a.teacherName.localeCompare(b.teacherName, 'ko');
  });

  return available;
}

export interface MultiSlotAvailableTeacher {
  teacherName: string;
  homeroomClass: string;
  deptName: string;
  isSameDept: boolean;
  totalSubstitutesDone: number;
  isAllPeriodsFree: boolean;
  freePeriodCount: number;
  totalPeriodCount: number;
}

/**
 * 여러 개의 수업 슬롯(예: 화 1, 2, 3, 4교시) 모두에 대해
 * '동시에 공강인 교사'를 정밀 분석하고 우선 추천
 */
export function getAllPeriodsAvailableTeachers(
  slots: { date: string; period: number; day?: string; deptName?: string }[],
  timetableData: ParsedTimetableResult,
  existingApplications: SubstituteApplication[],
  applicantTeacherName?: string,
  referenceDeptName?: string
): MultiSlotAvailableTeacher[] {
  if (slots.length === 0) return [];

  // 각 슬롯별 공강 교사 집합 구하기
  const slotAvailableMap: Record<number, Set<string>> = {};
  slots.forEach((s, idx) => {
    const avail = getAvailableTeachersForSlot(
      s.date,
      s.period,
      timetableData,
      existingApplications,
      s.deptName || referenceDeptName
    );
    slotAvailableMap[idx] = new Set(avail.map(a => a.teacherName));
  });

  // 이번 학기 누적 보강 횟수
  const subCountMap: Record<string, number> = {};
  existingApplications.forEach(app => {
    if (app.status === 'approved' || app.status === 'submitted') {
      app.items.forEach(it => {
        if (it.type === 'substitute' && it.substituteTeacher) {
          subCountMap[it.substituteTeacher] = (subCountMap[it.substituteTeacher] || 0) + 1;
        }
      });
    }
  });

  const totalPeriodCount = slots.length;
  const results: MultiSlotAvailableTeacher[] = [];

  timetableData.teachers.forEach(teacher => {
    if (teacher.teacherName === applicantTeacherName) return;

    let freeCount = 0;
    for (let i = 0; i < totalPeriodCount; i++) {
      if (slotAvailableMap[i]?.has(teacher.teacherName)) {
        freeCount++;
      }
    }

    if (freeCount === 0) return; // 하나도 안 비어있으면 제외

    const isSameDept = Boolean(
      referenceDeptName && 
      (teacher.remarks?.includes(referenceDeptName) || teacher.homeroomClass?.includes(referenceDeptName.charAt(0)))
    );

    results.push({
      teacherName: teacher.teacherName,
      homeroomClass: teacher.homeroomClass,
      deptName: teacher.remarks || '',
      isSameDept,
      totalSubstitutesDone: subCountMap[teacher.teacherName] || 0,
      isAllPeriodsFree: freeCount === totalPeriodCount,
      freePeriodCount: freeCount,
      totalPeriodCount,
    });
  });

  // 정렬:
  // 1. 모든 교시 공강(isAllPeriodsFree) 우선
  // 2. 공강 교시 수 많은 순
  // 3. 동일 학과/교과군 우선
  // 4. 누적 보강 횟수 적은 순
  // 5. 교사명 가나다순
  results.sort((a, b) => {
    if (a.isAllPeriodsFree && !b.isAllPeriodsFree) return -1;
    if (!a.isAllPeriodsFree && b.isAllPeriodsFree) return 1;
    if (a.freePeriodCount !== b.freePeriodCount) return b.freePeriodCount - a.freePeriodCount;
    if (a.isSameDept && !b.isSameDept) return -1;
    if (!a.isSameDept && b.isSameDept) return 1;
    if (a.totalSubstitutesDone !== b.totalSubstitutesDone) {
      return a.totalSubstitutesDone - b.totalSubstitutesDone;
    }
    return a.teacherName.localeCompare(b.teacherName, 'ko');
  });

  return results;
}

export interface ExchangeRecommendation {
  partnerTeacher: string;
  homeroomClass?: string;
  deptName?: string;
  isSameDept: boolean;
  targetDate: string;
  targetDay: string;
  targetPeriod: number;
  partnerSubjectName?: string;
  partnerClassCode?: string;
  matchType: 'SAME_CLASS' | 'MUTUAL_FREE' | 'CROSS_CLASS';
  score: number;
  title: string;
  subtitle: string;
  badgeLabel: string;
  badgeColor: string;
}

/**
 * 수업 맞교환(Exchange) 인공지능 스마트 추천 엔진
 * 1. 동일 학반(SAME_CLASS) 수업 맞바꾸기 (학생 시간표 변동 없는 최우선 추천)
 * 2. 동일 교과군 맞교환
 * 3. 상호 완전 공강 맞교환
 */
/**
 * 기준 일자와 동일한 주의 특정 요일(YYYY-MM-DD) 계산
 */
export function getDateForDayInSameWeek(referenceDateStr: string, targetDay: string): string {
  const dayIndexMap: Record<string, number> = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
  const targetDayIdx = dayIndexMap[targetDay] ?? 1;
  if (!referenceDateStr) return getUpcomingDateForDay(targetDay);

  const parts = referenceDateStr.split('-');
  let base: Date;
  if (parts.length === 3) {
    base = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  } else {
    base = new Date(referenceDateStr);
  }
  if (isNaN(base.getTime())) return getUpcomingDateForDay(targetDay);

  const baseDayIdx = base.getDay();
  const diff = targetDayIdx - baseDayIdx;
  const targetDate = new Date(base.getFullYear(), base.getMonth(), base.getDate() + diff);
  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 수업 맞교환(Exchange) 인공지능 스마트 추천 엔진
 * 1. 동일 학반(SAME_CLASS) 수업 맞바꾸기 (학생 시간표 변동 없는 최우선 추천)
 * 2. 동일 교과군 맞교환
 * 3. 일반 수업 맞교환
 * 4. 상호 완전 공강 맞교환
 */
export function getSmartExchangeRecommendations(
  sourceDate: string,
  sourcePeriod: number,
  sourceSlot: { classCode?: string; subjectName?: string; deptName?: string; sourceDay?: string },
  currentTeacherName: string,
  timetableData: ParsedTimetableResult,
  existingApplications: SubstituteApplication[]
): ExchangeRecommendation[] {
  let sourceDay = sourceSlot.sourceDay || getDayOfWeekFromDate(sourceDate);
  if (!sourceDay) {
    sourceDay = '월';
  }
  const validSourceDate = sourceDate || getUpcomingDateForDay(sourceDay);

  const currentTeacher = timetableData.teachers.find(t => t.teacherName === currentTeacherName);
  if (!currentTeacher) return [];

  // 날짜별 바쁜 교사 맵
  const busyTeachersOnDate = new Map<string, Set<string>>(); // `${date}_${period}` => Set<teacherName>
  existingApplications.forEach(app => {
    if (app.status !== 'rejected') {
      app.items.forEach(it => {
        if (it.type === 'substitute' && it.substituteTeacher) {
          const key = `${it.sourceDate}_${it.sourcePeriod}`;
          if (!busyTeachersOnDate.has(key)) busyTeachersOnDate.set(key, new Set());
          busyTeachersOnDate.get(key)!.add(it.substituteTeacher);
        }
        if (it.type === 'exchange' && it.targetTeacher && it.targetDate && it.targetPeriod) {
          const key = `${it.targetDate}_${it.targetPeriod}`;
          if (!busyTeachersOnDate.has(key)) busyTeachersOnDate.set(key, new Set());
          busyTeachersOnDate.get(key)!.add(it.targetTeacher);
        }
      });
    }
  });

  const hasTeacherClassAt = (teacherName: string, day: string, period: number, dateStr?: string) => {
    const teacher = timetableData.teachers.find(t => t.teacherName === teacherName);
    if (!teacher) return true;
    const slot = teacher.slots[`${day}_${period}`];
    if (slot) {
      const sub = (slot.subjectName || '').trim();
      const cls = (slot.classCode || '').trim();
      if (sub && sub !== '-' && sub !== '공강' && sub !== '빈시간') return true;
      if (cls && cls !== '-') return true;
    }
    if (dateStr) {
      const busySet = busyTeachersOnDate.get(`${dateStr}_${period}`);
      if (busySet && busySet.has(teacherName)) return true;
    }
    return false;
  };

  const DAYS = ['월', '화', '수', '목', '금'];
  const recommendations: ExchangeRecommendation[] = [];

  timetableData.teachers.forEach(partner => {
    if (partner.teacherName === currentTeacherName) return;

    // 파트너 교사는 신청자의 원래 수업 시간(sourceDay, sourcePeriod)에 공강이어야만 맞교환 가능!
    const partnerBusyAtSource = hasTeacherClassAt(partner.teacherName, sourceDay, sourcePeriod, validSourceDate);
    if (partnerBusyAtSource) return;

    const isSameDept = Boolean(
      sourceSlot.deptName &&
      (partner.remarks?.includes(sourceSlot.deptName) || partner.homeroomClass?.includes(sourceSlot.deptName.charAt(0)))
    );

    // 파트너 교사의 주간 슬롯 중 동일 학반 수업 탐색
    DAYS.forEach(d => {
      const targetDate = getDateForDayInSameWeek(validSourceDate, d);

      for (let p = 1; p <= 7; p++) {
        if (d === sourceDay && p === sourcePeriod) continue;

        // 조건: currentTeacher가 targetDate, d, p에 공강이어야 함!
        const currentTeacherBusyAtTarget = hasTeacherClassAt(currentTeacherName, d, p, targetDate);
        if (currentTeacherBusyAtTarget) {
          continue;
        }

        const partnerSlot = partner.slots[`${d}_${p}`];
        const hasPartnerClass = Boolean(
          partnerSlot && 
          partnerSlot.subjectName && 
          partnerSlot.subjectName.trim() !== '' && 
          partnerSlot.subjectName !== '-' &&
          partnerSlot.subjectName !== '공강'
        );

        // 동일 학반 맞교환 (오직 학생 시간표 변동 없이 동일 학급 내에서 과목만 1:1 맞교환하는 경우만 유효)
        if (hasPartnerClass && sourceSlot.classCode && partnerSlot?.classCode === sourceSlot.classCode) {
          const isImmediate = !partnerBusyAtSource;
          recommendations.push({
            partnerTeacher: partner.teacherName,
            homeroomClass: partner.homeroomClass,
            deptName: partner.remarks || '',
            isSameDept,
            targetDate,
            targetDay: d,
            targetPeriod: p,
            partnerSubjectName: partnerSlot.subjectName,
            partnerClassCode: partnerSlot.classCode,
            matchType: 'SAME_CLASS',
            score: (isImmediate ? 150 : 80) + (isSameDept ? 10 : 0),
            title: `${partner.teacherName} 선생님 [동일 학반: ${partnerSlot.classCode}]`,
            subtitle: `${d}요일 ${p}교시 '${partnerSlot.subjectName}' 맞교환 (${partnerSlot.classCode} 학급 내 스왑)`,
            badgeLabel: isImmediate ? '★ 동일학반 즉시교체' : '★ 동일학반 교과담당',
            badgeColor: isImmediate ? 'bg-indigo-600 text-white' : 'bg-purple-600 text-white',
          });
        }
      }
    });
  });

  // 점수 높은 순 정렬
  return recommendations.sort((a, b) => b.score - a.score || a.partnerTeacher.localeCompare(b.partnerTeacher, 'ko'));
}

