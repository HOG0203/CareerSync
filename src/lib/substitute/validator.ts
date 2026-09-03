// ==============================================================================
// src/lib/substitute/validator.ts
// 결보강 및 수업 교체 3중 충돌 검증 및 스마트 공강 교사 추천 엔진
// ==============================================================================

import { ParsedTimetableResult, TeacherTimetableSummary } from '@/lib/timetable/parser';
import { SubstituteApplication, SubstituteItem, ConflictCheckResult, AvailableTeacher } from './types';
import { 
  AcademicCalendarConfig, 
  DEFAULT_ACADEMIC_CALENDAR_2026_2 
} from './event-types';
import { 
  getEventsForSlot, 
  getClassEventsForSlot, 
  getExamSlotInfo,
  getVacationForDate,
  getSpecialDaySchedule
} from './event-helper';

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
 * 특정 날짜 및 교시에 특정 교사가 실제로 '공강'인지 여부 정밀 판별
 * - 정규 수업이 있더라도 이미 다른 교사에게 넘긴 경우(exchange_out or absence_substitute) -> 공강!
 * - 정규 수업이 없더라도 다른 수업을 대신 맡기로 한 경우(exchange_in or teaching_substitute) -> 수업 중(공강 아님)!
 */
export function isTeacherFreeOnDateAndPeriod(
  teacherName: string,
  dateStr: string,
  period: number,
  timetableData: ParsedTimetableResult,
  existingApplications: SubstituteApplication[],
  currentApplicationId?: string,
  calendarConfig: AcademicCalendarConfig = DEFAULT_ACADEMIC_CALENDAR_2026_2
): boolean {
  if (!teacherName || !dateStr || !period) return false;

  // 🌟 휴업일/공휴일/방학 검사: 수업일이 아니면 보강 불가
  const vacation = getVacationForDate(dateStr, calendarConfig);
  if (vacation) return false;

  const specialDay = getSpecialDaySchedule(dateStr, calendarConfig);
  const rawDay = getDayOfWeekFromDate(dateStr);
  const effectiveDay = specialDay ? specialDay.targetDayOfWeek : rawDay;
  const effectivePeriod = specialDay?.periodOverrides?.[period] ?? period;

  const teacher = timetableData.teachers.find(t => t.teacherName === teacherName);
  if (!teacher) return false;

  // 1) 기본 정규 시간표상 수업 여부 (대체 요일/교시 반영)
  const regularSlot = teacher.slots[`${effectiveDay}_${effectivePeriod}`];
  let hasRegularClass = Boolean(
    regularSlot && 
    regularSlot.subjectName && 
    regularSlot.subjectName.trim() !== '' && 
    regularSlot.subjectName !== '-' && 
    regularSlot.subjectName !== '공강'
  );

  // 단축수업으로 인한 수업 없음 검사
  if (specialDay?.shortenedPeriods && period > specialDay.shortenedPeriods) {
    hasRegularClass = false;
  }

  // 🌟 학사일정 행사 검사:
  // (a) 교사가 직접 인솔/담당하는 행사가 있는지 검사 -> 있으면 행사 근무 중(공강 아님!)
  const teacherEvents = getEventsForSlot(dateStr, period, undefined, teacherName, calendarConfig);
  if (teacherEvents.length > 0) {
    return false;
  }

  // (b) 지필평가/시험 기간 검사: 시험 진행 중이면 감독/진행 중(공강 아님!)
  const examInfo = getExamSlotInfo(dateStr, period, regularSlot?.classCode, calendarConfig);
  if (examInfo?.isExamRunning) {
    return false; // 시험 진행/감독
  }
  if (examInfo?.isDismissed) {
    hasRegularClass = false; // 시험 후 하교로 수업 없음
  }

  const activeApps = existingApplications.filter(
    app => app.id !== currentApplicationId && app.status !== 'rejected'
  );

  // 2) 내 정규 수업을 다른 사람에게 넘겨주었는지 검사 (내가 빠져서 공강이 됨)
  let isPassedOut = false;

  // 3) 내가 다른 수업을 대신 맡아서 들어가기로 했는지 검사 (새로 수업이 생김)
  let isTakenIn = false;

  for (const app of activeApps) {
    for (const it of app.items) {
      // 2-a) 보강으로 내 수업을 다른 교사에게 넘김
      if (it.type === 'substitute' && it.originalTeacher === teacherName && it.sourceDate === dateStr && it.sourcePeriod === period) {
        isPassedOut = true;
      }
      // 2-b) 교체로 내 수업을 다른 교사에게 넘김 (내 source 시간)
      if (it.type === 'exchange' && it.originalTeacher === teacherName && it.sourceDate === dateStr && it.sourcePeriod === period) {
        isPassedOut = true;
      }
      // 2-c) 교체로 내 원래 target 수업을 넘겨줌 (내가 targetTeacher인 경우의 target 시간)
      if (it.type === 'exchange' && it.targetTeacher === teacherName && it.targetDate === dateStr && it.targetPeriod === period) {
        isPassedOut = true;
      }

      // 3-a) 내가 보강 담당 교사로 투입됨
      if (it.type === 'substitute' && it.substituteTeacher === teacherName && it.sourceDate === dateStr && it.sourcePeriod === period) {
        isTakenIn = true;
      }
      // 3-b) 내가 교체로 상대방 수업을 맡음 (신청자로서 상대방의 target 시간에 들어감)
      if (it.type === 'exchange' && it.originalTeacher === teacherName && it.targetDate === dateStr && it.targetPeriod === period) {
        isTakenIn = true;
      }
      // 3-c) 내가 교체로 신청자의 source 수업을 맡음 (대상자로서 신청자의 source 시간에 들어감)
      if (it.type === 'exchange' && it.targetTeacher === teacherName && it.sourceDate === dateStr && it.sourcePeriod === period) {
        isTakenIn = true;
      }
    }
  }

  // 최종 판단:
  if (isTakenIn) return false;
  if (isPassedOut) return true;
  return !hasRegularClass;
}

/**
 * 2. 개별 결보강 항목에 대한 실시간 충돌 검증
 */
export function checkSubstituteItemConflict(
  item: SubstituteItem,
  timetableData: ParsedTimetableResult,
  existingApplications: SubstituteApplication[],
  currentApplicationId?: string,
  calendarConfig: AcademicCalendarConfig = DEFAULT_ACADEMIC_CALENDAR_2026_2
): ConflictCheckResult {
  const otherApps = existingApplications.filter(
    app => app.id !== currentApplicationId && app.status !== 'rejected'
  );

  // 1. 현재 결재 진행 중(submitted)인 중복 신청 여부 검사 (승인 완료된 건은 재교체 가능하므로 제외)
  const pendingApps = otherApps.filter(app => app.status === 'submitted');
  for (const app of pendingApps) {
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

  // 2. 수업 교체(exchange)인 경우의 충돌 검증 (1:1 맞교환 및 재교체 완벽 검증)
  if (item.type === 'exchange') {
    if (!item.targetDate || !item.targetPeriod || !item.targetTeacher) {
      return { hasConflict: true, message: '교체할 일자, 교시 및 교사를 모두 지정해야 합니다.' };
    }

    const sourceDay = item.sourceDay || getDayOfWeekFromDate(item.sourceDate);
    const targetDay = item.targetDay || getDayOfWeekFromDate(item.targetDate);

    // 2-1) 상대 교사(targetTeacher)가 원래 신청 시간(sourceDate, sourcePeriod)에 실제로 공강인지 검사
    const isTargetFreeAtSource = isTeacherFreeOnDateAndPeriod(
      item.targetTeacher,
      item.sourceDate,
      item.sourcePeriod,
      timetableData,
      existingApplications,
      currentApplicationId,
      calendarConfig
    );

    if (!isTargetFreeAtSource) {
      return {
        hasConflict: true,
        conflictType: 'TEACHER_BUSY',
        message: `[교사 충돌] ${item.targetTeacher} 선생님은 원래 수업 시간(${item.sourceDate}(${sourceDay}) ${item.sourcePeriod}교시)에 이미 다른 정규 수업 또는 보강/교체 배정이 있어 수업을 맡을 수 없습니다.`,
        details: {
          date: item.sourceDate,
          period: item.sourcePeriod,
          teacherName: item.targetTeacher
        }
      };
    }

    // 2-2) 본인(originalTeacher)이 교체 대상 시간(targetDate, targetPeriod)에 실제로 공강인지 검사
    const isOriginalFreeAtTarget = isTeacherFreeOnDateAndPeriod(
      item.originalTeacher,
      item.targetDate,
      item.targetPeriod,
      timetableData,
      existingApplications,
      currentApplicationId,
      calendarConfig
    );

    if (!isOriginalFreeAtTarget) {
      return {
        hasConflict: true,
        conflictType: 'TEACHER_BUSY',
        message: `[본인 교사 충돌] ${item.originalTeacher} 선생님은 맞교환 대상 시간(${item.targetDate}(${targetDay}) ${item.targetPeriod}교시)에 이미 본인의 수업 또는 다른 보강/교체 배정이 있습니다.`,
        details: {
          date: item.targetDate,
          period: item.targetPeriod,
          teacherName: item.originalTeacher
        }
      };
    }
  }

  // 3. 보강/대강(substitute)인 경우의 충돌 검증
  if (item.type === 'substitute') {
    if (!item.substituteTeacher) {
      return { hasConflict: true, message: '보강 교사를 지정해야 합니다.' };
    }

    const sourceDay = item.sourceDay || getDayOfWeekFromDate(item.sourceDate);

    // 3-1) 보강 교사가 해당 일시 실제로 공강인지 검사 (정규 수업, 학교 행사, 지필평가, 결보강 등 완벽 반영)
    const isSubFree = isTeacherFreeOnDateAndPeriod(
      item.substituteTeacher,
      item.sourceDate,
      item.sourcePeriod,
      timetableData,
      existingApplications,
      currentApplicationId,
      calendarConfig
    );

    if (!isSubFree) {
      const subEvents = getEventsForSlot(item.sourceDate, item.sourcePeriod, undefined, item.substituteTeacher, calendarConfig);
      const eventMsg = subEvents.length > 0 ? ` (학교 행사: ${subEvents[0].title})` : '';
      return {
        hasConflict: true,
        conflictType: 'TEACHER_BUSY',
        message: `[보강 교사 불가] ${item.substituteTeacher} 선생님은 ${item.sourceDate}(${sourceDay}) ${item.sourcePeriod}교시에 이미 정규 수업 또는 근무/행사${eventMsg} 배정이 있어 보강을 맡을 수 없습니다.`,
        details: {
          date: item.sourceDate,
          period: item.sourcePeriod,
          teacherName: item.substituteTeacher
        }
      };
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

// 제외할 비교 대상 외 활동/창체/비교과 과목 목록
const NON_ACADEMIC_SUBJECTS = new Set([
  '동아', '동아리', '자율', '진로', '성직', '봉사', '창체', '공강', '빈시간', '-', 
  '스포츠', '클럽', '상담', '보충', '특활', '군1', '군2', '리더'
]);

/**
 * 특정 교사의 순수 교과군(subjectGroup) 및 정규 교과목명 세트 추출 (창체/동아리/자율 등 제외)
 */
export function getTeacherSubjectInfo(teacher: TeacherTimetableSummary): {
  subjectGroup: string;
  subjects: Set<string>;
} {
  const subjects = new Set<string>();
  Object.values(teacher.slots || {}).forEach(s => {
    const sub = (s?.subjectName || '').trim();
    if (sub && !NON_ACADEMIC_SUBJECTS.has(sub)) {
      subjects.add(sub);
    }
  });

  return {
    subjectGroup: teacher.subjectGroup?.trim() || '',
    subjects,
  };
}

/**
 * 두 교사 또는 기준 슬롯/신청 교사와 파트너 교사 간의 동일 교과 여부 정밀 판별
 * - 1순위: subjectGroup 일치 (예: 과학 === 과학, 국어 === 국어 등)
 * - 2순위: 순수 정규 교과목명 일치/계열 접두사 일치 (예: 과1/과2/과3, 수1/수2, 국1/국2 등)
 */
export function checkIsSameSubject(
  targetSubjectName: string | undefined,
  sourceTeacher: TeacherTimetableSummary | undefined,
  partnerTeacher: TeacherTimetableSummary
): boolean {
  const partnerInfo = getTeacherSubjectInfo(partnerTeacher);

  // 1. 교과군(subjectGroup) 일치 검사 (예: 과학 === 과학, 국어 === 국어, 수학 === 수학, 전기 === 전기 등)
  if (
    sourceTeacher?.subjectGroup &&
    partnerTeacher.subjectGroup &&
    sourceTeacher.subjectGroup.trim() !== '' &&
    sourceTeacher.subjectGroup.trim() === partnerTeacher.subjectGroup.trim()
  ) {
    return true;
  }

  // 2. 기준 수업 과목명이 순수 정규 과목일 때 파트너 교사의 담당 과목과 대조
  const cleanTarget = (targetSubjectName || '').trim();
  if (cleanTarget && !NON_ACADEMIC_SUBJECTS.has(cleanTarget)) {
    if (partnerInfo.subjects.has(cleanTarget)) {
      return true;
    }
    // 접두사/계열 검사 (예: '과1' & '과2', '수1' & '수2', '국1' & '국2', '영1' & '영2')
    for (const sub of partnerInfo.subjects) {
      if (
        (cleanTarget.startsWith('과') && sub.startsWith('과')) ||
        (cleanTarget.startsWith('수') && sub.startsWith('수')) ||
        (cleanTarget.startsWith('국') && sub.startsWith('국')) ||
        (cleanTarget.startsWith('영') && sub.startsWith('영')) ||
        (cleanTarget.startsWith('체') && sub.startsWith('체')) ||
        (cleanTarget.startsWith('음') && sub.startsWith('음')) ||
        (cleanTarget.startsWith('미') && sub.startsWith('미')) ||
        (cleanTarget.startsWith('역') && sub.startsWith('역')) ||
        (cleanTarget.startsWith('사') && sub.startsWith('사')) ||
        (cleanTarget.startsWith('한') && sub.startsWith('한'))
      ) {
        return true;
      }
    }
  }

  // 3. 신청 교사의 순수 담당 과목과 파트너 교사의 순수 담당 과목 대조
  if (sourceTeacher) {
    const sourceInfo = getTeacherSubjectInfo(sourceTeacher);
    for (const sSub of sourceInfo.subjects) {
      if (partnerInfo.subjects.has(sSub)) {
        return true;
      }
      for (const pSub of partnerInfo.subjects) {
        if (
          (sSub.startsWith('과') && pSub.startsWith('과')) ||
          (sSub.startsWith('수') && pSub.startsWith('수')) ||
          (sSub.startsWith('국') && pSub.startsWith('국')) ||
          (sSub.startsWith('영') && pSub.startsWith('영'))
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * 기준 슬롯/신청 교사와 파트너 교사 간의 동일 학과 여부 정밀 판별
 * - 보통교과(국영수사과체음미 등)는 특정 학과 전공이 아니므로 학과 매칭에서 제외
 * - 전공 전문교과(기계, 전기, 화공, 공간, 자동차, 섬유 등) 교사만 학과와 매칭
 */
export function checkIsSameDept(
  targetDeptName: string | undefined,
  targetClassCode: string | undefined,
  sourceTeacher: TeacherTimetableSummary | undefined,
  partnerTeacher: TeacherTimetableSummary
): boolean {
  // 보통교과 교사는 특정 학과 소속이 아니므로 제외
  const commonSubjectGroups = new Set(['국어', '수학', '영어', '과학', '사회', '역사', '도덕', '체육', '음악', '미술', '한문', '일본어', '진로']);
  if (partnerTeacher.subjectGroup && commonSubjectGroups.has(partnerTeacher.subjectGroup.trim())) {
    return false;
  }

  const targetDept = targetDeptName?.trim() || '';

  // 전공 전문교과 교사의 교과군 또는 비고란과 대상 학과명 매칭
  if (partnerTeacher.subjectGroup && targetDept && targetDept.includes(partnerTeacher.subjectGroup.trim())) {
    return true;
  }

  if (partnerTeacher.remarks && targetDept && partnerTeacher.remarks.includes(targetDept)) {
    return true;
  }

  return false;
}

/**
 * 특정 일자·교시에 수업이 없는 '실제 공강 교사' 추천 목록 추출
 * 🌟 정렬 우선순위: 동일교과 > 동일학과 > 누적 보강 횟수 적은 순 > 교사명 가나다순
 */
export function getAvailableTeachersForSlot(
  dateStr: string,
  period: number,
  timetableData: ParsedTimetableResult,
  existingApplications: SubstituteApplication[],
  referenceDeptName?: string,
  applicantTeacherName?: string,
  referenceSubjectName?: string,
  referenceClassCode?: string,
  calendarConfig: AcademicCalendarConfig = DEFAULT_ACADEMIC_CALENDAR_2026_2
): AvailableTeacher[] {
  const day = getDayOfWeekFromDate(dateStr);
  if (!day) return [];

  // 🌟 공휴일/재량휴업일/방학 등 휴업일인 경우 수업이 없으므로 보강 추천 불필요
  const vacation = getVacationForDate(dateStr, calendarConfig);
  if (vacation) return [];

  const sourceTeacher = applicantTeacherName ? timetableData.teachers.find(t => t.teacherName === applicantTeacherName) : undefined;

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

  // 3. 공강 교사 필터링 (교체로 수업을 넘겨 비어있는 교사 및 학생 행사로 수업이 없어진 교사 포함!)
  const available: AvailableTeacher[] = [];

  timetableData.teachers.forEach(teacher => {
    if (applicantTeacherName && teacher.teacherName === applicantTeacherName) return;

    // 해당 날짜/교시에 실제로 수업이 없고 공강인지 실시간 정밀 판별 (학사일정·행사·휴업일 완벽 반영)
    const isFree = isTeacherFreeOnDateAndPeriod(
      teacher.teacherName,
      dateStr,
      period,
      timetableData,
      existingApplications,
      undefined,
      calendarConfig
    );

    if (!isFree) return;

    // 동일 교과 여부 판별 (최우선)
    const isSameSubject = checkIsSameSubject(referenceSubjectName, sourceTeacher, teacher);

    // 동일 학과 여부 판별 (차순위)
    const isSameDept = checkIsSameDept(referenceDeptName, referenceClassCode, sourceTeacher, teacher);

    available.push({
      teacherName: teacher.teacherName,
      homeroomClass: teacher.homeroomClass,
      deptName: teacher.remarks || '',
      isSameSubject,
      isSameDept,
      totalSubstitutesDone: subCountMap[teacher.teacherName] || 0
    });
  });

  // 4. 🌟 정렬: 동일 교과 우선(1순위) -> 동일 학과 우선(2순위) -> 누적 보강 횟수 적은 순(3순위) -> 교사명 가나다순
  available.sort((a, b) => {
    if (a.isSameSubject && !b.isSameSubject) return -1;
    if (!a.isSameSubject && b.isSameSubject) return 1;
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
  isSameSubject?: boolean;
  isSameDept: boolean;
  totalSubstitutesDone: number;
  isAllPeriodsFree: boolean;
  freePeriodCount: number;
  totalPeriodCount: number;
}

/**
 * 여러 개의 수업 슬롯(예: 화 1, 2, 3, 4교시) 모두에 대해
 * '동시에 공강인 교사'를 정밀 분석하고 우선 추천
 * 🌟 정렬: 전교시 공강 -> 공강 교시 수 -> 동일교과(1순위) -> 동일학과(2순위) -> 누적 보강 횟수 -> 가나다순
 */
export function getAllPeriodsAvailableTeachers(
  slots: { date: string; period: number; day?: string; deptName?: string; subjectName?: string; classCode?: string }[],
  timetableData: ParsedTimetableResult,
  existingApplications: SubstituteApplication[],
  applicantTeacherName?: string,
  referenceDeptName?: string,
  calendarConfig: AcademicCalendarConfig = DEFAULT_ACADEMIC_CALENDAR_2026_2
): MultiSlotAvailableTeacher[] {
  if (slots.length === 0) return [];

  const sourceTeacher = applicantTeacherName ? timetableData.teachers.find(t => t.teacherName === applicantTeacherName) : undefined;
  const firstSlot = slots[0];

  // 각 슬롯별 공강 교사 집합 구하기
  const slotAvailableMap: Record<number, Set<string>> = {};
  slots.forEach((s, idx) => {
    const avail = getAvailableTeachersForSlot(
      s.date,
      s.period,
      timetableData,
      existingApplications,
      s.deptName || referenceDeptName,
      applicantTeacherName,
      s.subjectName,
      s.classCode,
      calendarConfig
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
    if (applicantTeacherName && teacher.teacherName === applicantTeacherName) return;

    let freeCount = 0;
    for (let i = 0; i < totalPeriodCount; i++) {
      if (slotAvailableMap[i]?.has(teacher.teacherName)) {
        freeCount++;
      }
    }

    if (freeCount > 0) {
      const isSameSubject = checkIsSameSubject(firstSlot?.subjectName, sourceTeacher, teacher);
      const isSameDept = checkIsSameDept(firstSlot?.deptName || referenceDeptName, firstSlot?.classCode, sourceTeacher, teacher);

      results.push({
        teacherName: teacher.teacherName,
        homeroomClass: teacher.homeroomClass || '',
        deptName: teacher.remarks || '',
        isSameSubject,
        isSameDept,
        totalSubstitutesDone: subCountMap[teacher.teacherName] || 0,
        isAllPeriodsFree: freeCount === totalPeriodCount,
        freePeriodCount: freeCount,
        totalPeriodCount,
      });
    }
  });

  // 🌟 정렬: 전교시 공강 우선(1순위) -> 공강 교시 수 많은 순(2순위) -> 동일 교과(3순위) -> 동일 학과(4순위) -> 누적 보강 횟수 적은 순(5순위)
  return results.sort((a, b) => {
    if (a.isAllPeriodsFree && !b.isAllPeriodsFree) return -1;
    if (!a.isAllPeriodsFree && b.isAllPeriodsFree) return 1;
    if (a.freePeriodCount !== b.freePeriodCount) {
      return b.freePeriodCount - a.freePeriodCount;
    }
    if (a.isSameSubject && !b.isSameSubject) return -1;
    if (!a.isSameSubject && b.isSameSubject) return 1;
    if (a.isSameDept && !b.isSameDept) return -1;
    if (!a.isSameDept && b.isSameDept) return 1;
    if (a.totalSubstitutesDone !== b.totalSubstitutesDone) {
      return a.totalSubstitutesDone - b.totalSubstitutesDone;
    }
    return a.teacherName.localeCompare(b.teacherName, 'ko');
  });
}

export interface ExchangeRecommendation {
  partnerTeacher: string;
  homeroomClass?: string;
  deptName?: string;
  isSameSubject?: boolean;
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
 * 특정 교사의 특정 일자/교시 실시간 유효 수업 정보 반환 (교체/보강 및 학사일정 100% 반영)
 */
export function getEffectiveSlotForTeacher(
  teacherName: string,
  dateStr: string,
  period: number,
  timetableData: ParsedTimetableResult,
  existingApplications: SubstituteApplication[],
  calendarConfig: AcademicCalendarConfig = DEFAULT_ACADEMIC_CALENDAR_2026_2
): {
  hasClass: boolean;
  subjectName?: string;
  classCode?: string;
  deptName?: string;
  isExchangeIn?: boolean;
  isExchangeOut?: boolean;
  isTeachingSub?: boolean;
  isClassEventFree?: boolean;
  isTeacherEvent?: boolean;
  eventTitle?: string;
  partnerTeacher?: string;
} {
  const day = getDayOfWeekFromDate(dateStr);
  const teacher = timetableData.teachers.find(t => t.teacherName === teacherName);
  if (!teacher) return { hasClass: false };

  const regularSlot = teacher.slots[`${day}_${period}`];
  let hasRegularClass = Boolean(
    regularSlot && 
    regularSlot.subjectName && 
    regularSlot.subjectName.trim() !== '' && 
    regularSlot.subjectName !== '-' && 
    regularSlot.subjectName !== '공강'
  );

  const activeApps = existingApplications.filter(app => app.status !== 'rejected');

  let modification: any = null;
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
    };
  }

  // 2) 교체 나간 수업 또는 결강 수업 -> 실제로 수업 없음(공강)!
  if (modification && (modification.type === 'exchange_out' || modification.type === 'absence_substitute')) {
    return {
      hasClass: false, // 넘겨주어 공강
      subjectName: regularSlot?.subjectName,
      classCode: regularSlot?.classCode,
      deptName: regularSlot?.deptName,
      isExchangeOut: modification.type === 'exchange_out',
      partnerTeacher: modification.partnerTeacher,
    };
  }

  // 3) 교사가 직접 인솔하는 행사가 있는지 검사
  const teacherEvents = getEventsForSlot(dateStr, period, undefined, teacherName, calendarConfig);
  if (teacherEvents.length > 0) {
    return {
      hasClass: true,
      subjectName: `[행사] ${teacherEvents[0].title}`,
      isTeacherEvent: true,
      eventTitle: teacherEvents[0].title,
    };
  }

  // 4) 비인솔 교사의 수업 학급 학생들이 행사에 참여하여 수업이 없어진 경우 (수업 취소 / 공강!)
  if (hasRegularClass && regularSlot?.classCode) {
    const classEvents = getClassEventsForSlot(dateStr, period, regularSlot.classCode, calendarConfig);
    if (classEvents.length > 0) {
      return {
        hasClass: false, // 🌟 수업 없어짐 (공강!)
        subjectName: `공강 (${classEvents[0].title})`,
        classCode: regularSlot.classCode,
        deptName: regularSlot.deptName,
        isClassEventFree: true,
        eventTitle: classEvents[0].title,
      };
    }
  }

  // 5) 지필평가 후 하교(dismissed)인 경우 -> 수업 없음
  const examInfo = getExamSlotInfo(dateStr, period, regularSlot?.classCode, calendarConfig);
  if (examInfo?.isDismissed) {
    return {
      hasClass: false,
      subjectName: '시험 후 하교',
      classCode: regularSlot?.classCode,
    };
  }

  return {
    hasClass: hasRegularClass,
    subjectName: regularSlot?.subjectName,
    classCode: regularSlot?.classCode,
    deptName: regularSlot?.deptName,
  };
}

/**
 * 수업 맞교환(Exchange) 인공지능 스마트 추천 엔진
 * 🌟 추천 랭킹: 동일 교과(1순위) > 동일 학과(2순위) > 동일 학반 맞교환(SAME_CLASS)
 */
export function getSmartExchangeRecommendations(
  sourceDate: string,
  sourcePeriod: number,
  sourceSlot: { classCode?: string; subjectName?: string; deptName?: string; sourceDay?: string },
  currentTeacherName: string,
  timetableData: ParsedTimetableResult,
  existingApplications: SubstituteApplication[],
  calendarConfig: AcademicCalendarConfig = DEFAULT_ACADEMIC_CALENDAR_2026_2
): ExchangeRecommendation[] {
  let sourceDay = sourceSlot.sourceDay || getDayOfWeekFromDate(sourceDate);
  if (!sourceDay) {
    sourceDay = '월';
  }
  const validSourceDate = sourceDate || getUpcomingDateForDay(sourceDay);

  const currentTeacher = timetableData.teachers.find(t => t.teacherName === currentTeacherName);
  if (!currentTeacher) return [];

  const DAYS = ['월', '화', '수', '목', '금'];
  const recommendations: ExchangeRecommendation[] = [];

  timetableData.teachers.forEach(partner => {
    if (partner.teacherName === currentTeacherName) return;

    // 파트너 교사는 신청자의 원래 수업 시간(sourceDay, sourcePeriod)에 공강이어야만 맞교환 가능! (학사일정·행사 반영)
    const isPartnerFreeAtSource = isTeacherFreeOnDateAndPeriod(
      partner.teacherName,
      validSourceDate,
      sourcePeriod,
      timetableData,
      existingApplications,
      undefined,
      calendarConfig
    );
    if (!isPartnerFreeAtSource) return;

    // 동일 교과 여부 (1순위)
    const isSameSubject = checkIsSameSubject(sourceSlot.subjectName, currentTeacher, partner);

    // 동일 학과 여부 (2순위)
    const isSameDept = checkIsSameDept(sourceSlot.deptName, sourceSlot.classCode, currentTeacher, partner);

    // 파트너 교사의 주간 슬롯 중 동일 학반 수업 탐색
    DAYS.forEach(d => {
      const targetDate = getDateForDayInSameWeek(validSourceDate, d);

      for (let p = 1; p <= 7; p++) {
        if (d === sourceDay && p === sourcePeriod) continue;

        // 조건: currentTeacher가 targetDate, d, p에 공강이어야 함! (학사일정·행사·휴업일 100% 반영)
        const isCurrentTeacherFreeAtTarget = isTeacherFreeOnDateAndPeriod(
          currentTeacherName,
          targetDate,
          p,
          timetableData,
          existingApplications,
          undefined,
          calendarConfig
        );
        if (!isCurrentTeacherFreeAtTarget) {
          continue;
        }

        // 🌟 휴업일(공휴일/방학 등) 검사
        const vacation = getVacationForDate(targetDate, calendarConfig);
        if (vacation) continue;

        const partnerEff = getEffectiveSlotForTeacher(
          partner.teacherName,
          targetDate,
          p,
          timetableData,
          existingApplications,
          calendarConfig
        );

        // 수업이 없거나, 교사 직접 인솔 행사 중이거나, 학생 행사로 수업이 없어진 경우 교체 불가!
        if (!partnerEff.hasClass || partnerEff.isTeacherEvent || partnerEff.isClassEventFree) continue;

        // 지필평가/시험 중이거나 시험 후 하교인 경우 교체 불가
        const examInfo = getExamSlotInfo(targetDate, p, partnerEff.classCode, calendarConfig);
        if (examInfo?.isExamRunning || examInfo?.isDismissed) continue;

        // 동일 학반 맞교환 (오직 학생 시간표 변동 없이 동일 학급 내에서 과목만 1:1 맞교환하는 경우만 유효)
        if (partnerEff.hasClass && sourceSlot.classCode && partnerEff.classCode === sourceSlot.classCode) {
          const isImmediate = true;

          // 🌟 점수 체계: 동일교과(+1000) > 동일학과(+500) > 기본 동일학반 맞교환(150/80)
          const baseScore = isImmediate ? 150 : 80;
          const score = baseScore + (isSameSubject ? 1000 : 0) + (isSameDept ? 500 : 0);

          let badgeLabel = '★ 동일학반 즉시교체';
          let badgeColor = 'bg-indigo-600 text-white';

          if (isSameSubject) {
            badgeLabel = '★ 동일교과 맞교환';
            badgeColor = 'bg-blue-600 text-white';
          } else if (isSameDept) {
            badgeLabel = '★ 동일학과 맞교환';
            badgeColor = 'bg-emerald-600 text-white';
          } else if (!isImmediate) {
            badgeLabel = '★ 동일학반 교과담당';
            badgeColor = 'bg-purple-600 text-white';
          }

          recommendations.push({
            partnerTeacher: partner.teacherName,
            homeroomClass: partner.homeroomClass,
            deptName: partner.remarks || '',
            isSameSubject,
            isSameDept,
            targetDate,
            targetDay: d,
            targetPeriod: p,
            partnerSubjectName: partnerEff.subjectName || '',
            partnerClassCode: partnerEff.classCode || '',
            matchType: 'SAME_CLASS',
            score,
            title: `${partner.teacherName} 선생님 [${isSameSubject ? '동일교과 · ' : isSameDept ? '동일학과 · ' : ''}${partnerEff.classCode}]`,
            subtitle: `${d}요일 ${p}교시 '${partnerEff.subjectName}' 맞교환 (${partnerEff.classCode} 학급 내 스왑)`,
            badgeLabel,
            badgeColor,
          });
        }
      }
    });
  });

  // 🌟 정렬: 동일 교과(1순위) -> 동일 학과(2순위) -> 점수 높은 순 -> 교사명 가나다순
  return recommendations.sort((a, b) => {
    if (a.isSameSubject && !b.isSameSubject) return -1;
    if (!a.isSameSubject && b.isSameSubject) return 1;
    if (a.isSameDept && !b.isSameDept) return -1;
    if (!a.isSameDept && b.isSameDept) return 1;
    return b.score - a.score || a.partnerTeacher.localeCompare(b.partnerTeacher, 'ko');
  });
}

