// ==============================================================================
// src/lib/substitute/event-helper.ts
// 학사일정, 방학 및 학교 행사 매칭 헬퍼 유틸리티
// ==============================================================================

import { 
  AcademicCalendarConfig, 
  SchoolEvent, 
  VacationPeriod, 
  DEFAULT_ACADEMIC_CALENDAR_2026_2 
} from './event-types';
import { SemesterWeek } from './validator';

/**
 * 특정 일자가 방학 또는 휴업일에 속하는지 검사
 */
export function getVacationForDate(
  dateStr: string,
  config: AcademicCalendarConfig = DEFAULT_ACADEMIC_CALENDAR_2026_2
): VacationPeriod | null {
  if (!dateStr || !config.vacations) return null;
  return config.vacations.find(v => dateStr >= v.startDate && dateStr <= v.endDate) || null;
}

/**
 * 특정 일자, 교시, 학반(예: '축11'), 교사에 해당하는 행사 목록 조회
 */
export function getEventsForSlot(
  dateStr: string,
  period: number,
  classCode?: string,
  teacherName?: string,
  config: AcademicCalendarConfig = DEFAULT_ACADEMIC_CALENDAR_2026_2
): SchoolEvent[] {
  if (!dateStr || !config.events) return [];

  // 학반에서 학년 추출 (예: '축11' -> 1학년, '도31' -> 3학년)
  let grade = 0;
  if (classCode) {
    const match = classCode.match(/\d/);
    if (match) {
      const firstDigit = parseInt(match[0]);
      if (firstDigit >= 1 && firstDigit <= 3) {
        grade = firstDigit;
      }
    }
  }

  return config.events.filter(ev => {
    // 1. 날짜 및 교시 일치 검사
    if (ev.date !== dateStr) return false;
    if (!ev.periods.includes(period)) return false;

    // 2. 행사 담당 교사인지 검사
    if (teacherName && ev.inChargeTeachers?.includes(teacherName)) {
      return true;
    }

    // 3. 대상 범위(Scope) 검사
    if (ev.targetScope === 'all') return true;

    if (ev.targetScope === 'grade') {
      if (grade > 0 && ev.targetGrades?.includes(grade)) return true;
    }

    if (ev.targetScope === 'class') {
      if (classCode && ev.targetClasses?.includes(classCode)) return true;
    }

    return false;
  });
}

/**
 * 설정된 학사일정(시작일~종료일)을 기반으로 전체 학기 주차 목록 생성
 */
export function generateSemesterWeeksFromConfig(
  config: AcademicCalendarConfig = DEFAULT_ACADEMIC_CALENDAR_2026_2,
  semester?: number
): SemesterWeek[] {
  const activeSem = semester || config.semester || 2;
  const semPeriod = config.semesters?.[activeSem as 1 | 2];

  const startDateStr = semPeriod?.startDate || config.startDate || (activeSem === 1 ? '2026-03-02' : '2026-08-18');
  const endDateStr = semPeriod?.endDate || config.endDate || (activeSem === 1 ? '2026-08-17' : '2027-02-28');

  const parts = startDateStr.split('-');
  const baseStart = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));

  // 개학일이 포함된 주의 월요일 찾기
  const dayOfWeek = baseStart.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : (dayOfWeek === 1 ? 0 : 1 - dayOfWeek);
  const firstMonday = new Date(baseStart.getFullYear(), baseStart.getMonth(), baseStart.getDate() + mondayOffset);

  const endParts = endDateStr.split('-');
  const semesterEnd = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]));

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

  let currentMonday = new Date(firstMonday);
  let weekNum = 1;

  while (currentMonday <= semesterEnd || weekNum <= 28) {
    const friday = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() + 4);

    const dates: Record<string, string> = {};
    const monthDayLabels: Record<string, string> = {};

    DAY_KEYS.forEach((k, idx) => {
      const dayDate = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() + idx);
      dates[k] = formatYMD(dayDate);
      monthDayLabels[k] = formatSlashMD(dayDate);
    });

    const startDate = formatYMD(currentMonday);
    const endDate = formatYMD(friday);
    const dateRangeLabel = `${formatMD(currentMonday)} ~ ${formatMD(friday)}`;

    // 방학 여부 체크
    const isVacationWeek = Boolean(
      config.vacations?.some(v => startDate >= v.startDate && endDate <= v.endDate)
    );

    weeks.push({
      weekNum,
      label: `${weekNum}주차 (${dateRangeLabel})${isVacationWeek ? ' [방학]' : ''}`,
      shortLabel: `${weekNum}주차`,
      dateRangeLabel,
      startDate,
      endDate,
      dates,
      monthDayLabels,
    });

    // 다음 주 월요일로 이동
    currentMonday = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() + 7);
    weekNum++;

    // 최대 30주차 제한
    if (weekNum > 30) break;
  }

  return weeks;
}

/**
 * 오늘 날짜(주말 포함)가 속한 또는 직후의 주차 번호 지능형 계산
 */
export function findCurrentWeekNum(
  weeks: SemesterWeek[],
  targetDate?: Date
): number {
  if (!weeks || weeks.length === 0) return 1;

  const now = targetDate || new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  // 주말(토/일)인 경우 다음 주 월요일 기준으로 시간표 주차를 잡음
  const dayOfWeek = now.getDay();
  let searchDateStr = todayStr;
  if (dayOfWeek === 6) { // 토요일
    const nextMon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
    const ny = nextMon.getFullYear();
    const nm = String(nextMon.getMonth() + 1).padStart(2, '0');
    const nd = String(nextMon.getDate()).padStart(2, '0');
    searchDateStr = `${ny}-${nm}-${nd}`;
  } else if (dayOfWeek === 0) { // 일요일
    const nextMon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const ny = nextMon.getFullYear();
    const nm = String(nextMon.getMonth() + 1).padStart(2, '0');
    const nd = String(nextMon.getDate()).padStart(2, '0');
    searchDateStr = `${ny}-${nm}-${nd}`;
  }

  // 1. 해당 일자가 포함된 주차 찾기 (월~일 범위)
  for (const w of weeks) {
    const mParts = w.startDate.split('-');
    const mDate = new Date(parseInt(mParts[0]), parseInt(mParts[1]) - 1, parseInt(mParts[2]));
    const sDate = new Date(mDate.getFullYear(), mDate.getMonth(), mDate.getDate() + 6);
    
    const sy = sDate.getFullYear();
    const sm = String(sDate.getMonth() + 1).padStart(2, '0');
    const sd = String(sDate.getDate()).padStart(2, '0');
    const sundayStr = `${sy}-${sm}-${sd}`;

    if (searchDateStr >= w.startDate && searchDateStr <= sundayStr) {
      return w.weekNum;
    }
  }

  // 2. 학기 시작 전이면 1주차
  if (todayStr < (weeks[0]?.startDate || '')) {
    return 1;
  }

  // 3. 학기 종료 후면 마지막 주차
  return weeks[weeks.length - 1]?.weekNum || 1;
}
