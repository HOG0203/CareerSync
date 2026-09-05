// ==============================================================================
// src/lib/substitute/event-helper.ts
// 학사일정, 방학 및 학교 행사 매칭 헬퍼 유틸리티
// ==============================================================================

import { 
  AcademicCalendarConfig, 
  SchoolEvent, 
  VacationPeriod, 
  SpecialDaySchedule,
  ExamPeriod,
  DEFAULT_ACADEMIC_CALENDAR_2026_2 
} from './event-types';
import { SemesterWeek } from './validator';

/**
 * 특정 일자가 지필평가/시험 기간에 속하는지 검사
 */
export function getExamPeriodForDate(
  dateStr: string,
  config: AcademicCalendarConfig = DEFAULT_ACADEMIC_CALENDAR_2026_2
): ExamPeriod | null {
  if (!dateStr || !config.examPeriods) return null;
  return config.examPeriods.find(e => dateStr >= e.startDate && dateStr <= e.endDate) || null;
}

/**
 * 특정 일자, 교시에 해당하는 시험 슬롯 상태 조회 (시험 진행 중 vs 시험 후 하교 vs 해당 없음)
 * 일자별 개별 교시 설정(dailySchedules)이 있으면 해당 일자 전용 교시를 우선 적용합니다.
 */
export function getExamSlotInfo(
  dateStr: string,
  period: number,
  classCode?: string,
  config: AcademicCalendarConfig = DEFAULT_ACADEMIC_CALENDAR_2026_2
): { isExamPeriod: boolean; isExamRunning: boolean; isDismissed: boolean; exam: ExamPeriod } | null {
  const exam = getExamPeriodForDate(dateStr, config);
  if (!exam) return null;

  // 학반 학년 검사 (특정 학년만 시험인 경우)
  let grade = 0;
  if (classCode) {
    const match = classCode.match(/\d/);
    if (match) grade = parseInt(match[0], 10);
  }

  if (grade > 0 && exam.targetGrades && exam.targetGrades.length > 0) {
    if (!exam.targetGrades.includes(grade)) {
      return null;
    }
  }

  // 🌟 일자별 개별 교시 설정 조회
  const daily = exam.dailySchedules?.find(d => d.date === dateStr);
  const effectivePeriods = daily?.examPeriods || exam.examPeriods || [1, 2, 3];
  const effectiveAfternoonType = daily?.afternoonType || exam.afternoonType || 'dismiss';

  const isExamRunning = effectivePeriods.includes(period);
  const maxExamPeriod = effectivePeriods.length > 0 ? Math.max(...effectivePeriods) : 3;
  const isDismissed = !isExamRunning && effectiveAfternoonType === 'dismiss' && period > maxExamPeriod;

  return {
    isExamPeriod: true,
    isExamRunning,
    isDismissed,
    exam,
  };
}

/**
 * 특정 일자에 대체 요일 시간표가 설정되어 있는지 검사 (예: 9월 9일 수요일에 '월요일' 시간표 적용)
 */
export function getSpecialDaySchedule(
  dateStr: string,
  config: AcademicCalendarConfig = DEFAULT_ACADEMIC_CALENDAR_2026_2
): SpecialDaySchedule | null {
  if (!dateStr || !config.specialDaySchedules) return null;
  return config.specialDaySchedules.find(s => s.date === dateStr) || null;
}

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

    // 2. 교사 개인 시간표 조회 시 (teacherName이 전달된 경우):
    if (teacherName) {
      // 해당 행사의 담당/인솔 교사 목록에 포함되어 있을 때만 해당 교사의 행사 수업으로 배정
      if (ev.inChargeTeachers && ev.inChargeTeachers.length > 0) {
        return ev.inChargeTeachers.includes(teacherName);
      }
      // 담당/인솔 교사가 지정되지 않은 행사는 어떤 교사에게도 개인 담당 수업으로 배정되지 않음
      return false;
    }

    // 3. 학급 시간표 조회 시 (teacherName이 전달되지 않은 경우): 대상 범위(Scope) 검사
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
 * 특정 일자, 교시, 학급(classCode)의 학생들이 참여 중인 행사 조회 (교사 인솔 여부와 무관하게 학급 자체의 행사 여부 확인)
 */
export function getClassEventsForSlot(
  dateStr: string,
  period: number,
  classCode?: string,
  config: AcademicCalendarConfig = DEFAULT_ACADEMIC_CALENDAR_2026_2
): SchoolEvent[] {
  if (!dateStr || !config.events || !classCode) return [];

  let grade = 0;
  const match = classCode.match(/\d/);
  if (match) {
    const firstDigit = parseInt(match[0]);
    if (firstDigit >= 1 && firstDigit <= 3) {
      grade = firstDigit;
    }
  }

  return config.events.filter(ev => {
    if (ev.date !== dateStr) return false;
    if (!ev.periods.includes(period)) return false;

    if (ev.targetScope === 'all') return true;
    if (ev.targetScope === 'grade' && grade > 0 && ev.targetGrades?.includes(grade)) return true;
    if (ev.targetScope === 'class' && ev.targetClasses?.includes(classCode)) return true;

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

/**
 * 특정 교사, 요일, 교시(또는 학반)에 매주 시간강사가 상시보강으로 배정되어 있는지 검사
 * (시간강사 배정 수업은 상시보강 완료 상태이므로 수업교체 및 추가보강 전면 불가)
 */
export function getInstructorAssignmentForSlot(
  teacherName: string,
  day: string, // "월", "화", "수", "목", "금"
  period: number, // 1 ~ 7
  classCode?: string,
  config?: AcademicCalendarConfig,
  dateStr?: string // 선택적: 유효기간 검사용
): {
  isInstructorSlot: boolean;
  assignment?: import('./event-types').TeacherInstructorAssignment;
  instructorName?: string;
  remarks?: string;
} {
  if (!config?.teacherInstructorAssignments || config.teacherInstructorAssignments.length === 0) {
    return { isInstructorSlot: false };
  }

  const cleanTeacher = (teacherName || '').trim();
  if (!cleanTeacher) return { isInstructorSlot: false };

  for (const assign of config.teacherInstructorAssignments) {
    if (assign.originalTeacherName.trim() !== cleanTeacher) continue;

    // 🌟 1. 일일/주차별(daily) 시간강사인 경우: 주차 기간(effectivePeriod) 또는 특정 일자와 일치해야 함!
    if (assign.assignmentMode === 'daily') {
      if (assign.effectivePeriod?.startDate && assign.effectivePeriod?.endDate) {
        if (!dateStr || dateStr < assign.effectivePeriod.startDate || dateStr > assign.effectivePeriod.endDate) {
          continue;
        }
      } else {
        const targetDate = assign.assignedDate || assign.effectivePeriod?.startDate;
        if (!targetDate) continue;
        // 특정 일자가 주어지지 않았거나 다른 날짜인 경우 일일 강사 슬롯에 미해당
        if (!dateStr || dateStr !== targetDate) continue;
      }
    } else {
      // 🌟 2. 매주(weekly) 시간강사인 경우: 유효기간 검사 (설정된 경우)
      if (dateStr && assign.effectivePeriod) {
        if (assign.effectivePeriod.startDate && dateStr < assign.effectivePeriod.startDate) continue;
        if (assign.effectivePeriod.endDate && dateStr > assign.effectivePeriod.endDate) continue;
      }
    }

    const matchedSlot = assign.assignedSlots.find(slot => {
      const matchDay = slot.day === day;
      const matchPeriod = slot.period === period;
      const matchClass = !classCode || !slot.classCode || slot.classCode === classCode;
      return matchDay && matchPeriod && matchClass;
    });

    if (matchedSlot) {
      return {
        isInstructorSlot: true,
        assignment: assign,
        instructorName: assign.instructorName,
        remarks: assign.remarks,
      };
    }
  }

  return { isInstructorSlot: false };
}

/**
 * 2026학년도 대한민국 법정 공휴일 및 주요 학사 기념일 기본 목록 반환
 */
export function getKoreanHolidays(year: number = 2026): VacationPeriod[] {
  return [
    { id: `hol-${year}-03-01`, name: '3·1절', startDate: `${year}-03-01`, endDate: `${year}-03-01`, type: 'holiday' },
    { id: `hol-${year}-03-02`, name: '대체공휴일(3·1절)', startDate: `${year}-03-02`, endDate: `${year}-03-02`, type: 'holiday' },
    { id: `hol-${year}-05-05`, name: '어린이날', startDate: `${year}-05-05`, endDate: `${year}-05-05`, type: 'holiday' },
    { id: `hol-${year}-05-24`, name: '부처님오신날', startDate: `${year}-05-24`, endDate: `${year}-05-24`, type: 'holiday' },
    { id: `hol-${year}-05-25`, name: '대체공휴일(부처님오신날)', startDate: `${year}-05-25`, endDate: `${year}-05-25`, type: 'holiday' },
    { id: `hol-${year}-06-06`, name: '현충일', startDate: `${year}-06-06`, endDate: `${year}-06-06`, type: 'holiday' },
    { id: `hol-${year}-08-15`, name: '광복절', startDate: `${year}-08-15`, endDate: `${year}-08-15`, type: 'holiday' },
    { id: `hol-${year}-08-17`, name: '대체공휴일(광복절)', startDate: `${year}-08-17`, endDate: `${year}-08-17`, type: 'holiday' },
    { id: `hol-${year}-09-24`, name: '추석 전날', startDate: `${year}-09-24`, endDate: `${year}-09-24`, type: 'holiday' },
    { id: `hol-${year}-09-25`, name: '추석', startDate: `${year}-09-25`, endDate: `${year}-09-25`, type: 'holiday' },
    { id: `hol-${year}-09-26`, name: '추석 다음 날', startDate: `${year}-09-26`, endDate: `${year}-09-26`, type: 'holiday' },
    { id: `hol-${year}-10-03`, name: '개천절', startDate: `${year}-10-03`, endDate: `${year}-10-03`, type: 'holiday' },
    { id: `hol-${year}-10-05`, name: '대체공휴일(개천절)', startDate: `${year}-10-05`, endDate: `${year}-10-05`, type: 'holiday' },
    { id: `hol-${year}-10-09`, name: '한글날', startDate: `${year}-10-09`, endDate: `${year}-10-09`, type: 'holiday' },
    { id: `hol-${year}-12-25`, name: '성탄절', startDate: `${year}-12-25`, endDate: `${year}-12-25`, type: 'holiday' },
    { id: `hol-${year+1}-01-01`, name: '새해 첫날', startDate: `${year+1}-01-01`, endDate: `${year+1}-01-01`, type: 'holiday' },
    { id: `hol-${year+1}-02-16`, name: '설날 연휴', startDate: `${year+1}-02-16`, endDate: `${year+1}-02-18`, type: 'holiday' },
  ];
}

/**
 * 엑셀 파일(ArrayBuffer)에서 학사일정 데이터(행사, 휴업일, 대체/변형, 시험) 파싱
 */
export async function parseScheduleExcel(
  buffer: ArrayBuffer
): Promise<{
  events: SchoolEvent[];
  vacations: VacationPeriod[];
  specialDays: SpecialDaySchedule[];
  exams: ExamPeriod[];
}> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    return { events: [], vacations: [], specialDays: [], exams: [] };
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
  const events: SchoolEvent[] = [];
  const vacations: VacationPeriod[] = [];
  const specialDays: SpecialDaySchedule[] = [];
  const exams: ExamPeriod[] = [];

  let idx = 1;
  for (const r of rawRows) {
    // 컬럼명 유연 대응 (구분/유형, 일정명/행사명, 시작일/일자, 종료일, 대상/교시, 비고)
    const type = String(r['구분'] || r['유형'] || r['분류'] || '').trim().toLowerCase();
    const name = String(r['일정명'] || r['행사명'] || r['명칭'] || r['내용'] || '').trim();
    let startDate = String(r['시작일'] || r['일자'] || r['날짜'] || '').trim();
    let endDate = String(r['종료일'] || startDate).trim();
    const details = String(r['상세'] || r['대상'] || r['비고'] || '').trim();

    if (!name || !startDate) continue;

    // YYYY-MM-DD 포맷 정규화
    if (/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(startDate)) startDate = startDate.replace(/\./g, '-');
    if (/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(endDate)) endDate = endDate.replace(/\./g, '-');
    startDate = startDate.split('-').map((p, i) => (i > 0 && p.length === 1 ? `0${p}` : p)).join('-');
    endDate = endDate.split('-').map((p, i) => (i > 0 && p.length === 1 ? `0${p}` : p)).join('-');

    if (type.includes('방학') || type.includes('휴업') || type.includes('공휴') || type.includes('재량')) {
      vacations.push({
        id: `excel-vac-${Date.now()}-${idx++}`,
        name,
        startDate,
        endDate,
        type: type.includes('공휴') ? 'holiday' : (type.includes('재량') ? 'discretionary' : 'vacation'),
      });
    } else if (type.includes('시험') || type.includes('고사') || type.includes('평가')) {
      exams.push({
        id: `excel-exam-${Date.now()}-${idx++}`,
        name,
        startDate,
        endDate,
        targetGrades: [1, 2, 3],
        examPeriods: [1, 2, 3],
        afternoonType: 'dismiss',
        description: details || undefined,
      });
    } else if (type.includes('대체') || type.includes('단축') || type.includes('변형') || type.includes('연속') || type.includes('블록')) {
      const isShortened = type.includes('단축') || /\d+교시\s*단축/.test(details) || /\d+교시\s*단축/.test(name);
      const isBlockOverride = type.includes('연속') || type.includes('블록') || details.includes('연속') || details.includes('복제') || name.includes('연속');
      
      let shortPeriods = undefined;
      let periodOverrides: Record<number, number> | undefined = undefined;

      if (isShortened) {
        const matchPeriod = (details + ' ' + name).match(/(\d+)교시/);
        if (matchPeriod) {
          shortPeriods = parseInt(matchPeriod[1], 10);
        }
      } else if (isBlockOverride) {
        // e.g. "5~6교시" or "5교시 -> 6교시"
        const matchBlock = (details + ' ' + name).match(/(\d+)\s*(?:~|->|➔|에서|교시\s*➔)\s*(\d+)교시/);
        if (matchBlock) {
          const src = parseInt(matchBlock[1], 10);
          const tgt = parseInt(matchBlock[2], 10);
          periodOverrides = { [tgt]: src };
        } else {
          periodOverrides = { 6: 5 }; // 기본 5->6교시 연속
        }
      }

      specialDays.push({
        id: `excel-sp-${Date.now()}-${idx++}`,
        date: startDate,
        originalDayOfWeek: '금',
        targetDayOfWeek: '금',
        shortenedPeriods: shortPeriods,
        periodOverrides,
        description: name || details,
      });
    } else {
      // 일반 행사
      events.push({
        id: `excel-ev-${Date.now()}-${idx++}`,
        title: name,
        date: startDate,
        day: '월',
        periods: [1, 2, 3, 4, 5, 6, 7],
        targetScope: 'all',
        targetGrades: [1, 2, 3],
        inChargeTeachers: [],
        description: details || undefined,
      });
    }
  }

  return { events, vacations, specialDays, exams };
}

/**
 * 현재 학사일정 목록을 엑셀 파일로 다운로드 (XLSX 생성)
 */
export async function exportScheduleToExcel(config: AcademicCalendarConfig, filename = '2026학년도_학사일정.xlsx') {
  const XLSX = await import('xlsx');
  const rows: any[] = [];

  // 1. 방학 및 휴업일
  config.vacations?.forEach(v => {
    rows.push({
      '구분': v.type === 'holiday' ? '공휴일' : (v.type === 'discretionary' ? '재량휴업일' : '방학'),
      '일정명': v.name,
      '시작일': v.startDate,
      '종료일': v.endDate,
      '상세/비고': v.type === 'holiday' ? '법정공휴일' : (v.type === 'discretionary' ? '학교재량휴업일' : '방학기간'),
    });
  });

  // 2. 지필평가
  config.examPeriods?.forEach(e => {
    rows.push({
      '구분': '지필평가',
      '일정명': e.name,
      '시작일': e.startDate,
      '종료일': e.endDate,
      '상세/비고': `${e.targetGrades?.join(',') || '전'}학년, 시험교시: ${e.examPeriods?.join(',') || '1~3'}, 오후: ${e.afternoonType === 'dismiss' ? '하교' : '수업'}`,
    });
  });

  // 3. 대체 및 단축수업 / 교시 연속
  config.specialDaySchedules?.forEach(s => {
    const hasOverrides = Boolean(s.periodOverrides && Object.keys(s.periodOverrides).length > 0);

    let category = '대체요일';
    let detailNote = `${s.originalDayOfWeek || '당일'}요일 ➔ ${s.targetDayOfWeek}요일 시간표`;
    let title = s.description || `${s.targetDayOfWeek}요일 시간표 대체`;

    if (s.shortenedPeriods) {
      category = '단축수업';
      detailNote = `${s.shortenedPeriods}교시 단축수업 운영`;
      title = s.description || `${s.shortenedPeriods}교시 단축운영`;
    } else if (hasOverrides && s.periodOverrides) {
      const targetP = Number(Object.keys(s.periodOverrides)[0]) || 6;
      const srcP = Number(s.periodOverrides[targetP]) || 5;
      category = '교시연속(블록)';
      detailNote = `[연속수업] ${srcP}교시 수업 ➔ ${targetP}교시 복제`;
      title = s.description || `${srcP}~${targetP}교시 연속/중복 진행`;
    }

    rows.push({
      '구분': category,
      '일정명': title,
      '시작일': s.date,
      '종료일': s.date,
      '상세/비고': detailNote,
    });
  });

  // 4. 학교 행사
  config.events?.forEach(ev => {
    const teachersSummary = (() => {
      if (!ev.inChargeTeachers || ev.inChargeTeachers.length === 0) return '';
      if (ev.inChargeRoleLabel) {
        const rl = ev.inChargeRoleLabel.trim();
        if (rl.includes('담임')) {
          if (rl.includes('1학년')) return '1학년 담임';
          if (rl.includes('2학년')) return '2학년 담임';
          if (rl.includes('3학년')) return '3학년 담임';
          if (rl.includes('전교') || rl.includes('전체') || rl.includes('전학년')) return '전학년 담임';
          return '담임교사';
        }
        if (rl.includes('진로')) {
          if (rl.includes('1학년')) return '1학년 진로';
          if (rl.includes('2학년')) return '2학년 진로';
          if (rl.includes('3학년')) return '3학년 진로';
          return '진로담당';
        }
        if (rl.includes('동아리') || rl.includes('동아')) {
          if (rl.includes('1학년')) return '1학년 동아리';
          if (rl.includes('2학년')) return '2학년 동아리';
          if (rl.includes('3학년')) return '3학년 동아리';
          return '동아리담당';
        }
        return rl.replace(/\s*일괄/g, '').replace(/\(\d+명\)/g, '').trim() || rl;
      }
      return ev.inChargeTeachers.length <= 3 
        ? ev.inChargeTeachers.join(', ') 
        : `${ev.inChargeTeachers.slice(0, 2).join(', ')} 외 ${ev.inChargeTeachers.length - 2}명`;
    })();

    const teachersNote = teachersSummary ? ` / 인솔: ${teachersSummary}` : '';

    rows.push({
      '구분': '학교행사',
      '일정명': ev.title,
      '시작일': ev.date,
      '종료일': ev.date,
      '상세/비고': `${ev.periods.join(',')}교시 / 대상: ${ev.targetScope === 'grade' ? `${ev.targetGrades?.join(',') || ''}학년` : '전교생'}${teachersNote}`,
    });
  });

  // 날짜순 정렬
  rows.sort((a, b) => String(a['시작일']).localeCompare(String(b['시작일'])));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '학사일정');
  XLSX.writeFile(workbook, filename);
}
