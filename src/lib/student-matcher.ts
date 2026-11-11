/**
 * CareerSync 통합 학생 5단 정밀 매칭 엔진 (Unified Student Matcher Engine)
 * 
 * 대구공업고등학교 6개 학과 체계 반영:
 * 1단: 학년 (Grade)
 * 2단: 학과 (Major) - 각 학년마다 학과별 1반이 독립 존재하므로 필수 매칭
 * 3단: 반   (Class)
 * 4단: 번호 (Number)
 * 5단: 성명 (Name)
 * 
 * 모든 일괄 업로드(봉사활동, 출결, 자격증, 성적, 산학협력/취업역량강화)가
 * 이 공통 엔진을 통해 일관된 5단 정밀 검증을 수행합니다.
 */

export interface RawStudentInput {
  grade?: number | string | null;
  major?: string | null;
  classInfo?: number | string | null;
  studentNumber?: number | string | null;
  studentName: string;
}

export interface DbStudent {
  id: string;
  student_name: string;
  student_number?: string | number | null;
  major?: string | null;
  class_info?: string | number | null;
  graduation_year: number;
  [key: string]: any;
}

export type MatchStatus = 'matched' | 'mismatched' | 'ambiguous' | 'unregistered';

export interface MatchResult {
  status: MatchStatus;
  matchedStudent: DbStudent | null;
  candidateStudents: DbStudent[];
  reason: string;
  matchScore: number; // 0 ~ 5 일치 단계 개수
}

/**
 * 대구공고 표준 학과 명칭 및 별칭 정규화 맵
 */
export const MAJOR_NORMALIZE_MAP: Record<string, string> = {
  '전기': '스마트전기과',
  '전기과': '스마트전기과',
  '스마트전기': '스마트전기과',
  '스마트전기과': '스마트전기과',

  '기계': '자동화기계과',
  '기계과': '자동화기계과',
  '자동화기계': '자동화기계과',
  '자동화기계과': '자동화기계과',
  '정밀기계': '자동화기계과',
  '기계계열': '자동화기계과',

  '화학': '바이오화학과',
  '화학과': '바이오화학과',
  '바이오화학': '바이오화학과',
  '바이오화학과': '바이오화학과',
  '바이오': '바이오화학과',

  '자동차': '친환경자동차과',
  '자동차과': '친환경자동차과',
  '친환경자동차': '친환경자동차과',
  '친환경자동차과': '친환경자동차과',
  '자동차기계과': '친환경자동차과',
  '차량': '친환경자동차과',

  '건축': '스마트공간건축과',
  '건축과': '스마트공간건축과',
  '건설': '스마트공간건축과',
  '건설과': '스마트공간건축과',
  '스마트공간건축': '스마트공간건축과',
  '스마트공간건축과': '스마트공간건축과',
  '스마트공간': '스마트공간건축과',
  '스마트공간과': '스마트공간건축과',

  '섬유': '스마트융합섬유과',
  '섬유과': '스마트융합섬유과',
  '섬유소재': '스마트융합섬유과',
  '섬유소재과': '스마트융합섬유과',
  '스마트융합섬유': '스마트융합섬유과',
  '스마트융합섬유과': '스마트융합섬유과',

  '철도': '철도차량과',
  '철도차량': '철도차량과',
  '철도차량과': '철도차량과'
};

/**
 * 정규화 유틸리티 함수들
 */
export function cleanName(name: any): string {
  if (!name) return '';
  return String(name).replace(/[\s\-_()]/g, '').trim();
}

export function cleanNumber(num: any): number | null {
  if (num === null || num === undefined || num === '') return null;
  const cleaned = String(num).replace(/[^0-9]/g, '');
  if (!cleaned) return null;
  const n = parseInt(cleaned, 10);
  return isNaN(n) || n === 0 ? null : n;
}

export function cleanClass(cls: any): number | null {
  if (cls === null || cls === undefined || cls === '') return null;
  const cleaned = String(cls).replace(/[^0-9]/g, '');
  if (!cleaned) return null;
  const n = parseInt(cleaned, 10);
  return isNaN(n) || n === 0 ? null : n;
}

export function cleanMajor(major: any): string {
  if (!major) return '';
  const raw = String(major).replace(/[\s\-_()\[\]]/g, '').trim();
  const stripped = raw.replace(/공업계|공업고등|고등학교|대구공고|계열/g, '');
  
  // 정규화 맵 대조
  for (const [key, stdName] of Object.entries(MAJOR_NORMALIZE_MAP)) {
    if (stripped === key || stripped.includes(key) || key.includes(stripped)) {
      return stdName;
    }
  }
  return stripped;
}

/**
 * 학생의 현재 학년 계산 (졸업년도 기준)
 */
export function calculateStudentGrade(graduationYear: number, baseYear: number = 2026): number {
  return baseYear - graduationYear + 4;
}

/**
 * 졸업년도 계산 (현재 학년 기준)
 */
export function calculateGraduationYear(currentGrade: number, baseYear: number = 2026): number {
  return baseYear + (4 - currentGrade);
}

/**
 * 5단 정밀 매칭 단일 검증 함수
 */
export function matchStudent5Steps(
  raw: RawStudentInput,
  allStudents: DbStudent[],
  baseYear: number = 2026
): MatchResult {
  const rowName = cleanName(raw.studentName);
  if (!rowName) {
    return {
      status: 'unregistered',
      matchedStudent: null,
      candidateStudents: [],
      reason: '학생 성명이 입력되지 않았습니다.',
      matchScore: 0
    };
  }

  const rowGrade = cleanNumber(raw.grade);
  const rowMajor = cleanMajor(raw.major);
  const rowClass = cleanClass(raw.classInfo);
  const rowNum = cleanNumber(raw.studentNumber);

  // 1단계 성명 일치 학생 후보군 추출 (DB 전교생 대상)
  const nameMatches = allStudents.filter(s => cleanName(s.student_name) === rowName);

  if (nameMatches.length === 0) {
    return {
      status: 'unregistered',
      matchedStudent: null,
      candidateStudents: [],
      reason: `DB 학생 명부에 성명(${raw.studentName})이 등록되어 있지 않습니다.`,
      matchScore: 0
    };
  }

  // 2단계: 후보 학생들의 학적을 정규화하여 5단계 일치 검증
  const scoredCandidates = nameMatches.map(st => {
    const stGrade = calculateStudentGrade(st.graduation_year, baseYear);
    const stMajor = cleanMajor(st.major);
    const stClass = cleanClass(st.class_info);
    const stNum = cleanNumber(st.student_number);

    let score = 1; // 성명 일치 (기본 1점)
    let hasConflict = false;
    const conflictReasons: string[] = [];

    // 학년 검증 (엑셀에 기재되어 있을 때)
    if (rowGrade !== null) {
      if (rowGrade === stGrade) {
        score++;
      } else {
        hasConflict = true;
        conflictReasons.push(`학년 불일치 (엑셀: ${rowGrade}학년 ≠ DB: ${stGrade}학년)`);
      }
    }

    // 학과 검증 (엑셀에 기재되어 있을 때)
    if (rowMajor) {
      const majorMatch = stMajor === rowMajor || stMajor.includes(rowMajor) || rowMajor.includes(stMajor);
      if (majorMatch) {
        score++;
      } else {
        hasConflict = true;
        conflictReasons.push(`학과 불일치 (엑셀: ${raw.major} ≠ DB: ${st.major})`);
      }
    }

    // 반 검증 (엑셀에 기재되어 있을 때)
    if (rowClass !== null) {
      if (rowClass === stClass) {
        score++;
      } else {
        hasConflict = true;
        conflictReasons.push(`학급 불일치 (엑셀: ${rowClass}반 ≠ DB: ${stClass}반)`);
      }
    }

    // 번호 검증 (엑셀에 기재되어 있을 때)
    if (rowNum !== null) {
      if (rowNum === stNum) {
        score++;
      } else {
        hasConflict = true;
        conflictReasons.push(`번호 불일치 (엑셀: ${rowNum}번 ≠ DB: ${stNum}번)`);
      }
    }

    return {
      student: st,
      stGrade,
      stMajor,
      stClass,
      stNum,
      score,
      hasConflict,
      conflictReasons
    };
  });

  // 3단계: 완전 일치(충돌 없음 & 필수 항목 일치) 학생 탐색
  const nonConflictCandidates = scoredCandidates.filter(c => !c.hasConflict);

  // A. 5단계 100% 완전 일치 학생 (학년, 학과, 반, 번호, 성명 일치)
  const perfectMatches = nonConflictCandidates.filter(c => {
    const gradeOk = rowGrade === null || rowGrade === c.stGrade;
    const majorOk = !rowMajor || (c.stMajor === rowMajor || c.stMajor.includes(rowMajor) || rowMajor.includes(c.stMajor));
    const classOk = rowClass === null || rowClass === c.stClass;
    const numOk = rowNum === null || rowNum === c.stNum;
    return gradeOk && majorOk && classOk && numOk;
  });

  if (perfectMatches.length === 1) {
    const best = perfectMatches[0];
    return {
      status: 'matched',
      matchedStudent: best.student,
      candidateStudents: [best.student],
      reason: '5단 정밀 매칭 100% 일치 (정상 매칭 완료)',
      matchScore: best.score
    };
  }

  // B. 번호 생략 서식: 학년 + 학과 + 반 + 이름 4단계가 일치하고 해당 학급에 유일한 학생인 경우
  if (perfectMatches.length === 0 && nonConflictCandidates.length === 1) {
    const candidate = nonConflictCandidates[0];
    // 학년과 반이 일치하고 학과도 충돌이 없는 유일 학생
    const gradeOk = rowGrade === null || rowGrade === candidate.stGrade;
    const classOk = rowClass === null || rowClass === candidate.stClass;
    if (gradeOk && classOk) {
      return {
        status: 'matched',
        matchedStudent: candidate.student,
        candidateStudents: [candidate.student],
        reason: '학적 대조 일치 (해당 학과/학급 유일 학생)',
        matchScore: candidate.score
      };
    }
  }

  // C. 학적 상충 (Conflict 발생) - 자동 매칭 원천 차단 (이준호 사태 방지!)
  // 엑셀 기재 학적과 DB 학생 학적이 명백히 다른 경우
  if (nonConflictCandidates.length === 0) {
    const firstConflict = scoredCandidates[0];
    return {
      status: 'mismatched',
      matchedStudent: null, // 절대 억지로 자동 매칭하지 않음!
      candidateStudents: scoredCandidates.map(c => c.student),
      reason: firstConflict.conflictReasons.join(', ') + ' (오매칭 방지를 위해 자동 매칭이 차단되었습니다)',
      matchScore: firstConflict.score
    };
  }

  // D. 동명이인 후보가 2명 이상 남아 구분이 필요한 경우
  return {
    status: 'ambiguous',
    matchedStudent: null,
    candidateStudents: nonConflictCandidates.map(c => c.student),
    reason: `동명이인 ${nonConflictCandidates.length}명이 존재하여 명확한 학적 선택이 필요합니다.`,
    matchScore: 1
  };
}

/**
 * 엑셀 데이터 배열을 일괄로 5단 정밀 매칭하는 통합 배치 함수
 */
export function batchMatchStudents5Steps(
  rawList: RawStudentInput[],
  allStudents: DbStudent[],
  baseYear: number = 2026
): {
  matchedRows: { input: RawStudentInput; result: MatchResult }[];
  summary: {
    total: number;
    matched: number;
    mismatched: number;
    ambiguous: number;
    unregistered: number;
  };
} {
  const matchedRows: { input: RawStudentInput; result: MatchResult }[] = [];
  let matched = 0;
  let mismatched = 0;
  let ambiguous = 0;
  let unregistered = 0;

  for (const input of rawList) {
    const result = matchStudent5Steps(input, allStudents, baseYear);
    matchedRows.push({ input, result });

    if (result.status === 'matched') matched++;
    else if (result.status === 'mismatched') mismatched++;
    else if (result.status === 'ambiguous') ambiguous++;
    else if (result.status === 'unregistered') unregistered++;
  }

  return {
    matchedRows,
    summary: {
      total: rawList.length,
      matched,
      mismatched,
      ambiguous,
      unregistered
    }
  };
}
