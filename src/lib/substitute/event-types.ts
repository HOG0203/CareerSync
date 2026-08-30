// ==============================================================================
// src/lib/substitute/event-types.ts
// 학사일정, 방학/휴업일, 학교/학년별 행사 및 담당교사 데이터 모델
// ==============================================================================

export type EventTargetScope = 'all' | 'grade' | 'class';

export interface SchoolEvent {
  id: string;
  title: string; // 행사명 (예: "1학년 문화공연관람", "전교생 축제", "3학년 취업역량특강")
  date: string; // YYYY-MM-DD (예: "2026-09-03")
  day: string; // "월", "화", "수", "목", "금"
  periods: number[]; // 해당 교시 (예: [5, 6])
  targetScope: EventTargetScope; // "all"(전교생), "grade"(특정 학년), "class"(특정 학반)
  targetGrades: number[]; // [1] (1학년 전체)
  targetClasses?: string[]; // ["축31", "건31"]
  inChargeTeachers: string[]; // 행사 담당/인솔 교사명 목록 (예: ["조영남", "강태우"])
  inChargeRoleLabel?: string; // 🌟 사용자에게 깔끔하게 보여줄 일괄 역할 라벨 (예: "1학년 담임교사 전체 (12명)", "전교생 담임교사 전체 (24명)")
  location?: string; // 장소 (예: "대강당", "시청각실", "체육관")
  description?: string; // 세부 안내
  color?: string; // 뱃지 색상 (기본: purple)
}

export interface VacationPeriod {
  id: string;
  name: string; // "겨울방학", "재량휴업일", "추석연휴", "개교기념일"
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  type: 'vacation' | 'holiday' | 'discretionary'; // 방학, 공휴일, 재량휴업일
}

export interface SemesterPeriod {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface ExamDailySchedule {
  date: string; // YYYY-MM-DD (예: "2026-10-12")
  dayNumber?: number; // 1 (1일차)
  examPeriods: number[]; // [1, 2, 3] (해당 일자의 시험 진행 교시)
  afternoonType: 'dismiss' | 'regular_class'; // 'dismiss'(시험 후 하교), 'regular_class'(오후 정상수업)
}

export interface ExamPeriod {
  id: string;
  name: string; // 고사명 (예: "1학기 1차 지필평가", "2학기 2차 지필평가 (기말고사)", "전국연합학력평가")
  startDate: string; // YYYY-MM-DD (예: "2026-10-12")
  endDate: string; // YYYY-MM-DD (예: "2026-10-15")
  targetGrades: number[]; // [1, 2, 3] (전학년) 또는 [1], [2], [3]
  examPeriods: number[]; // 기본 교시 (예: [1, 2, 3])
  afternoonType: 'dismiss' | 'regular_class'; // 기본 오후 운영 형태
  dailySchedules?: ExamDailySchedule[]; // 🌟 일자별 맞춤 교시 및 오후 일정 설정
  description?: string;
}

export interface SpecialDaySchedule {
  id: string;
  date: string; // YYYY-MM-DD (예: "2026-09-09")
  targetDayOfWeek: string; // "월", "화", "수", "목", "금" (적용할 요일 시간표)
  originalDayOfWeek?: string; // "수" (원래 달력상 요일)
  shortenedPeriods?: number; // 🌟 단축수업 운영 교시 수 (예: 4 -> 4교시까지만 수업하고 5~7교시는 수업 없음)
  periodOverrides?: Record<number, number>; // 🌟 교시 매핑/복제 (예: { 6: 5 } -> 6교시에 5교시 수업을 진행)
  description?: string; // 사유 (예: "월요일 결손시수 확보 대체수업", "개학식 4교시 단축수업")
}

export interface AcademicCalendarConfig {
  academicYear: number; // 2026
  semester: number; // 2
  startDate: string; // "2026-08-18" (현재 학기 개학일)
  endDate: string; // "2027-02-28" (현재 학기 종업/방학)
  semesters?: {
    1: SemesterPeriod;
    2: SemesterPeriod;
  };
  vacations: VacationPeriod[];
  events: SchoolEvent[];
  specialDaySchedules?: SpecialDaySchedule[]; // 대체 요일 시간표 운영 목록
  examPeriods?: ExamPeriod[]; // 지필평가 / 시험 기간 목록
  updatedAt?: string;
  updatedBy?: string;
}

// 2026학년도 2학기 기본 초기 설정
export const DEFAULT_ACADEMIC_CALENDAR_2026_2: AcademicCalendarConfig = {
  academicYear: 2026,
  semester: 2,
  startDate: '2026-08-18',
  endDate: '2027-02-28',
  semesters: {
    1: {
      startDate: '2026-03-02',
      endDate: '2026-08-17',
    },
    2: {
      startDate: '2026-08-18',
      endDate: '2027-02-28',
    }
  },
  vacations: [
    {
      id: 'vac-1',
      name: '추석 연휴',
      startDate: '2026-09-24',
      endDate: '2026-09-26',
      type: 'holiday',
    },
    {
      id: 'vac-2',
      name: '재량휴업일',
      startDate: '2026-10-02',
      endDate: '2026-10-02',
      type: 'discretionary',
    },
    {
      id: 'vac-3',
      name: '겨울방학',
      startDate: '2027-01-08',
      endDate: '2027-02-05',
      type: 'vacation',
    }
  ],
  events: []
};

/**
 * 학년도 및 학기별 지능형 기본 학사일정 생성
 */
export function getDefaultAcademicCalendarConfig(
  academicYear = 2026,
  semester = 2
): AcademicCalendarConfig {
  if (academicYear === 2026 && semester === 2) {
    return DEFAULT_ACADEMIC_CALENDAR_2026_2;
  }

  if (semester === 1) {
    return {
      academicYear,
      semester: 1,
      startDate: `${academicYear}-03-02`,
      endDate: `${academicYear}-08-17`,
      vacations: [
        {
          id: `vac-${academicYear}-summer`,
          name: '여름방학',
          startDate: `${academicYear}-07-20`,
          endDate: `${academicYear}-08-17`,
          type: 'vacation',
        }
      ],
      events: [],
    };
  } else {
    return {
      academicYear,
      semester: 2,
      startDate: `${academicYear}-08-18`,
      endDate: `${academicYear + 1}-02-28`,
      vacations: [
        {
          id: `vac-${academicYear}-winter`,
          name: '겨울방학',
          startDate: `${academicYear + 1}-01-08`,
          endDate: `${academicYear + 1}-02-05`,
          type: 'vacation',
        }
      ],
      events: [],
    };
  }
}
