// ==============================================================================
// src/lib/timetable/constants.ts
// 교수학습지원 - 시간표 시스템 공통 상수 및 유틸리티
// ==============================================================================

export interface DepartmentInfo {
  code: string;
  name: string;
  color: string;
}

export const DEPARTMENT_CODE_MAP: Record<string, string> = {
  '기': '자동화기계과',
  '차': '친환경자동차과',
  '공': '스마트공간과',
  '건': '건설과',
  '축': '스마트공간건축과',
  '전': '스마트전기과',
  '화': '바이오화학과',
  '섬': '스마트융합섬유과',
  '도': '도제학급',
};

export const DEPARTMENT_COLOR_MAP: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  '기': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-600 text-white font-black' },
  '차': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-600 text-white font-black' },
  '공': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badge: 'bg-amber-600 text-white font-black' },
  '건': { bg: 'bg-orange-50', text: 'text-orange-900', border: 'border-orange-200', badge: 'bg-orange-600 text-white font-black' },
  '축': { bg: 'bg-teal-50', text: 'text-teal-900', border: 'border-teal-200', badge: 'bg-teal-600 text-white font-black' },
  '전': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', badge: 'bg-indigo-600 text-white font-black' },
  '화': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', badge: 'bg-rose-600 text-white font-black' },
  '섬': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', badge: 'bg-purple-600 text-white font-black' },
  '도': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', badge: 'bg-cyan-700 text-white font-black' },
};

export interface DayPeriodConfig {
  key: string;
  name: string;
  periods: number;
}

export const DAYS_OF_WEEK: DayPeriodConfig[] = [
  { key: '월', name: '월요일', periods: 7 },
  { key: '화', name: '화요일', periods: 7 },
  { key: '수', name: '수요일', periods: 6 },
  { key: '목', name: '목요일', periods: 6 },
  { key: '금', name: '금요일', periods: 6 },
];

export const TOTAL_WEEKLY_PERIODS = 32; // 월(7)+화(7)+수(6)+목(6)+금(6) = 32

export interface ActivityWeightConfig {
  [key: string]: number;
}

export const DEFAULT_ACTIVITY_WEIGHTS: ActivityWeightConfig = {
  '자율': 1.5,
  '자율활동': 1.5,
  '동아': 0.5,
  '동아리': 0.5,
  '동아리활동': 0.5,
  '진로': 1.0,
  '진로활동': 1.0,
  '성직': 1.0,
  '봉사': 1.0,
  '기타': 1.0,
};

export const SPECIAL_CLASS_MAP: Record<string, { deptName: string; grade: number; classNum: number; displayName: string; deptKey: string }> = {
  '도31': {
    deptKey: '기',
    deptName: '자동화기계과',
    grade: 3,
    classNum: 1,
    displayName: '자동화기계과 3학년 1반 (도31)',
  },
  '도21': {
    deptKey: '기',
    deptName: '자동화기계과',
    grade: 2,
    classNum: 1,
    displayName: '자동화기계과 2학년 1반 (도21)',
  },
};

/**
 * 학반 코드 파싱 (예: "기11" -> 자동화기계과 1학년 1반, "도31" -> 자동화기계과 3학년 1반)
 */
export function parseClassCode(classCode: string) {
  if (!classCode || typeof classCode !== 'string') {
    return {
      raw: '',
      deptKey: '',
      deptName: '',
      grade: 0,
      classNum: 0,
      displayName: '미지정',
      shortName: '',
      color: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', badge: 'bg-slate-700 text-white font-black' }
    };
  }

  const clean = classCode.trim();

  // 특수 학반 코드 (예: 도31 -> 자동화기계과 3학년 1반)
  if (SPECIAL_CLASS_MAP[clean]) {
    const special = SPECIAL_CLASS_MAP[clean];
    const color = DEPARTMENT_COLOR_MAP[special.deptKey] || { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-600 text-white font-black' };
    return {
      raw: clean,
      deptKey: special.deptKey,
      deptName: special.deptName,
      grade: special.grade,
      classNum: special.classNum,
      displayName: special.displayName,
      shortName: `${special.deptKey}${special.grade}-${special.classNum}`,
      color
    };
  }

  const deptKey = clean.charAt(0);
  const grade = parseInt(clean.charAt(1)) || 0;
  const classNum = parseInt(clean.charAt(2)) || 0;
  const deptName = DEPARTMENT_CODE_MAP[deptKey] || `${deptKey}과`;
  const color = DEPARTMENT_COLOR_MAP[deptKey] || { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', badge: 'bg-slate-700 text-white font-black' };

  let displayName = clean;
  if (grade > 0 && classNum > 0) {
    displayName = `${deptName} ${grade}학년 ${classNum}반 (${clean})`;
  } else if (grade > 0) {
    displayName = `${deptName} ${grade}학년 (${clean})`;
  }

  return {
    raw: clean,
    deptKey,
    deptName,
    grade,
    classNum,
    displayName,
    shortName: `${deptKey}${grade}-${classNum}`,
    color
  };
}

/**
 * 학반 코드(예: 화11, 기13, 전12, 공11, 자21, 섬11 등)별 학과 대표 테마 색상 뱃지 스타일 반환
 */
export function getClassDeptBadgeStyle(classCode?: string): {
  bg: string;
  text: string;
  border: string;
  badge: string;
  pill: string;
} {
  if (!classCode || typeof classCode !== 'string') {
    return {
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      border: 'border-slate-200',
      badge: 'bg-slate-100 text-slate-700 border border-slate-200',
      pill: 'bg-slate-100 text-slate-700 font-bold',
    };
  }

  const clean = classCode.trim();
  const firstChar = clean.charAt(0);

  // 1. 기계 (기11, 기12, 기13, 도31 등) -> 블루 테마
  if (firstChar === '기' || clean.startsWith('도')) {
    return {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      badge: 'bg-blue-50 text-blue-800 border border-blue-200/80 font-black',
      pill: 'bg-blue-100 text-blue-900 font-black',
    };
  }

  // 2. 화학/바이오화학 (화11, 화12 등) -> 로즈/핑크 테마
  if (firstChar === '화') {
    return {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
      badge: 'bg-rose-50 text-rose-800 border border-rose-200/80 font-black',
      pill: 'bg-rose-100 text-rose-900 font-black',
    };
  }

  // 3. 전기 (전11, 전12 등) -> 인디고/보라 테마
  if (firstChar === '전') {
    return {
      bg: 'bg-indigo-50',
      text: 'text-indigo-700',
      border: 'border-indigo-200',
      badge: 'bg-indigo-50 text-indigo-800 border border-indigo-200/80 font-black',
      pill: 'bg-indigo-100 text-indigo-900 font-black',
    };
  }

  // 4. 자동차 (자11, 자12, 차11 등) -> 에메랄드/그린 테마
  if (firstChar === '자' || firstChar === '차') {
    return {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      badge: 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-black',
      pill: 'bg-emerald-100 text-emerald-900 font-black',
    };
  }

  // 5. 공간/건축/건설 (공11, 공12, 건11, 건12, 축11 등) -> 앰버/오렌지 테마
  if (firstChar === '공' || firstChar === '건' || firstChar === '축') {
    return {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      badge: 'bg-amber-50 text-amber-900 border border-amber-200/80 font-black',
      pill: 'bg-amber-100 text-amber-900 font-black',
    };
  }

  // 6. 섬유 (섬11, 섬12 등) -> 퍼플/바이올렛 테마
  if (firstChar === '섬') {
    return {
      bg: 'bg-purple-50',
      text: 'text-purple-700',
      border: 'border-purple-200',
      badge: 'bg-purple-50 text-purple-800 border border-purple-200/80 font-black',
      pill: 'bg-purple-100 text-purple-900 font-black',
    };
  }

  // 7. 디자인 (디11, 디12 등) -> 스카이 테마
  if (firstChar === '디') {
    return {
      bg: 'bg-sky-50',
      text: 'text-sky-700',
      border: 'border-sky-200',
      badge: 'bg-sky-50 text-sky-800 border border-sky-200/80 font-black',
      pill: 'bg-sky-100 text-sky-900 font-black',
    };
  }

  return {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    badge: 'bg-slate-100 text-slate-700 border border-slate-200 font-bold',
    pill: 'bg-slate-100 text-slate-700 font-bold',
  };
}

/**
 * 과목명/활동명 기반 특별활동 판별 및 스타일링
 */
export function getActivityInfo(subjectName: string, customWeights?: ActivityWeightConfig) {
  if (!subjectName || typeof subjectName !== 'string') {
    return {
      isActivity: false,
      type: 'regular',
      label: '',
      weight: 1.0,
      style: {
        bg: 'bg-white',
        border: 'border-slate-200',
        badge: 'bg-slate-100 text-slate-700 border-slate-200'
      }
    };
  }

  const clean = subjectName.trim();
  const weights = customWeights || DEFAULT_ACTIVITY_WEIGHTS;

  if (clean.includes('자율')) {
    const weight = weights['자율'] ?? weights['자율활동'] ?? 1.5;
    return {
      isActivity: true,
      type: 'autonomous',
      label: '자율활동',
      weight,
      style: {
        bg: 'bg-purple-50/90',
        border: 'border-purple-300',
        badge: 'bg-purple-100 text-purple-900 border-purple-300 font-bold'
      }
    };
  }

  if (clean.includes('동아')) {
    const weight = weights['동아'] ?? weights['동아리'] ?? weights['동아리활동'] ?? 0.5;
    return {
      isActivity: true,
      type: 'club',
      label: '동아리',
      weight,
      style: {
        bg: 'bg-amber-50/90',
        border: 'border-amber-300',
        badge: 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
      }
    };
  }

  if (clean.includes('진로')) {
    const weight = weights['진로'] ?? weights['진로활동'] ?? 1.0;
    return {
      isActivity: true,
      type: 'career',
      label: '진로활동',
      weight,
      style: {
        bg: 'bg-emerald-50/90',
        border: 'border-emerald-300',
        badge: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold'
      }
    };
  }

  if (clean.includes('성직')) {
    const weight = weights['성직'] ?? 1.0;
    return {
      isActivity: true,
      type: 'vocation',
      label: '성직',
      weight,
      style: {
        bg: 'bg-cyan-50/90',
        border: 'border-cyan-300',
        badge: 'bg-cyan-100 text-cyan-900 border-cyan-300 font-bold'
      }
    };
  }

  return {
    isActivity: false,
    type: 'regular',
    label: '교과수업',
    weight: 1.0,
    style: {
      bg: 'bg-white',
      border: 'border-slate-300',
      badge: 'bg-slate-100 text-slate-700 border-slate-300'
    }
  };
}
