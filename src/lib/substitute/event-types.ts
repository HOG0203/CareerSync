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
