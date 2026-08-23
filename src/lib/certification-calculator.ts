/**
 * 옥저인재인증제 100점 만점 평가규정 점수 계산 엔진
 */

export interface VocationalDomainGrades {
  korean?: number;   // 의사소통 국어
  english?: number;  // 의사소통 영어
  math?: number;     // 수리활용
  problem?: number;  // 문제해결
  isCompleted?: boolean;
  gradeSum?: number; // 영역 등급 합계 (4~20)
}

export interface RecordAuditMeta {
  userId: string;
  userName: string;
  role?: string;
  at: string; // ISO timestamp
}

export interface IndustryEduItem {
  id: string;
  title: string;
  dateOrTerm?: string;
  remarks?: string;
  category?: string;
  created_by?: RecordAuditMeta;
}

export interface ContestItem {
  id: string;
  type: 'award' | 'participate';      // 입상 / 단순참가
  category?: '교내대회' | '교외대회' | string;
  title: string;                      // 대회명 (예: 교내 백일장 대회)
  dateOrTerm?: string;                // 2026-05-12 또는 2-1
  award?: string;                     // 금상, 은상, 동상, 참가 등
  created_by?: RecordAuditMeta;
}

export interface CertificationEvaluationData {
  id?: string;
  student_id: string;
  academic_year?: number;

  // 작성자 및 수정자 메타데이터
  created_by?: RecordAuditMeta;
  updated_by?: RecordAuditMeta;
  
  // 1. 직업공통능력 (직기초 개별 영역 등급 저장)
  vocational_details?: {
    grade1?: VocationalDomainGrades & { created_by?: RecordAuditMeta };
    grade2?: VocationalDomainGrades & { created_by?: RecordAuditMeta };
    grade3?: VocationalDomainGrades & { created_by?: RecordAuditMeta };
    mock?: VocationalDomainGrades & { created_by?: RecordAuditMeta };
  };

  // 등급합계 (호환 및 빠른 접근용)
  vocational_grade_3?: number; // 3학년 등급합계 (<=4: 7점, <=7: 6점, <=10: 5점, <=13: 4점, <=16: 3점)
  vocational_grade_2?: number; // 2학년 등급합계 (<=4: 5점, <=7: 4점, <=10: 3점, <=13: 2점, <=16: 1점)
  vocational_grade_1?: number; // 1학년 등급합계 (<=4: 3점, <=7: 2.5점, <=10: 2점, <=13: 1.5점, <=16: 1점)
  vocational_mock_grade?: number; // 모의평가 등급합계 (<=4: 2점, <=7: 1.5점, <=10: 1점, <=13: 0.5점)

  // 2. 취업역량강화
  industry_edu_count?: number; // 산학협력부 주관 교육이수 횟수 (1회당 1점, 최대 10점)
  career_course_semesters?: number; // 취업진로코스 참여 학기 (4학기: 10점, 3학기: 8점, 2학기: 6점, 1학기: 4점)
  major_club_years?: number; // 전공심화동아리 참여 학년 (3개년: 5점, 2개년: 4점, 1개년: 3점)
  skills_contest_level?: 'none' | 'national' | 'regional'; // 전국기능대회(5점), 지방기능대회(2점)
  field_training_completed?: boolean; // 현장실습 이수 (5점)
  apprenticeship_semesters?: number; // 도제 OJT 참여 학기 (4학기: 5점, 3학기: 4점, 2학기: 3점, 1학기: 2점)
  employed_early?: boolean; // 취업확정 기업요청 미참여 (5점)

  // 취업역량 세부 근거 자료 (정형화된 슬롯 및 증빙 맵)
  employment_details?: {
    career_courses?: Record<string, string>; // { "1-1": "청솔반", "2-1": "취업맞춤반" }
    career_courses_meta?: Record<string, RecordAuditMeta>;
    major_clubs?: Record<string, string>;    // { "1": "전공심화 로봇제어반", "2": "전공심화 로봇제어반" }
    major_clubs_meta?: Record<string, RecordAuditMeta>;
    skills_contest?: {
      level: 'none' | 'national' | 'regional';
      name: string;
      category?: string;
      award?: string;
      date?: string;
      year?: number;
      created_by?: RecordAuditMeta;
    };
    field_training?: {
      completed: boolean;
      company?: string;
      period?: string;
      created_by?: RecordAuditMeta;
    };
    apprenticeship?: Record<string, string>; // { "2-1": "(주)한화솔루션", "2-2": "(주)한화솔루션" }
    apprenticeship_meta?: Record<string, RecordAuditMeta>;
    employed_early?: {
      confirmed: boolean;
      company?: string;
      date?: string;
      created_by?: RecordAuditMeta;
    };
    industry_edu_list?: IndustryEduItem[];
  };

  // 3. 인성능력 (출결 외)
  volunteer_school_hours?: number; // 교내 봉사활동 시간 (200h 미만 시 x0.025)
  volunteer_outside_hours?: number; // 교외 봉사활동 시간 (200h 미만 시 x0.05)
  volunteer_meta?: RecordAuditMeta;
  arts_sports_semesters?: number; // 운동부 및 관악부 참여 학기 (6학기: 5점, 5학기: 4점, 4학기: 3점, 3학기: 2점, 2학기: 1점)
  contest_award_count?: number; // 교내외 대회 입상 건수 (건당 1점)
  contest_participate_count?: number; // 교내외 대회 참가 건수 (건당 0.5점)

  // 예체능 및 교내외 대회 세부 근거 자료 (정형화된 슬롯 및 증빙 맵)
  arts_contest_details?: {
    arts_sports?: Record<string, string>; // { "1-1": "축구부", "1-2": "축구부", "2-1": "관악부" }
    arts_sports_meta?: Record<string, RecordAuditMeta>;
    contest_list?: ContestItem[];
  };

  // 수동 보정 (선택)
  manual_overrides?: {
    attendance_score?: number;
    certificate_score?: number;
    total_score?: number;
    remarks?: string;
  };
}

export type CertificationRank = 'S' | 'A' | 'B' | 'C' | 'D';

export interface ScoreItemDetail {
  category: string;
  name: string;
  maxScore: number;
  score: number;
  checkedOptionIndex?: number;
  displayText: string;
  details?: any;
}

export interface FullStudentEvaluation {
  studentId: string;
  studentName: string;
  studentNumber: string;
  major: string;
  classInfo: string;
  graduationYear: number;
  currentGrade: number;

  // 4대 영역별 점수
  vocationalCommonScore: number; // 직업공통능력 (25점)
  majorScore: number;            // 전공능력 (25점)
  employmentScore: number;       // 취업역량강화 (25점)
  characterScore: number;        // 인성능력 (25점)

  totalScore: number;            // 종합 점수 (100점 만점)
  rank: CertificationRank;       // S / A / B / C / D
  isCertified: boolean;          // 70점 이상 여부

  // 세부 항목별 점수 및 체크된 인덱스
  details: {
    // 1. 직업공통능력 (25점)
    vocal3Grade: ScoreItemDetail;     // 3학년 직기초 (7점)
    vocal2Grade: ScoreItemDetail;     // 2학년 직기초 (5점)
    vocal1Grade: ScoreItemDetail;     // 1학년 직기초 (3점)
    vocalMockGrade: ScoreItemDetail;  // 모의평가 (2점)
    certComputer: ScoreItemDetail;    // 컴퓨터관련 자격 (3점)
    certInfoTech: ScoreItemDetail;    // 정보기술 자격 (2점)
    certHistory: ScoreItemDetail;     // 한국사 자격 (3점)

    // 2. 전공능력 (25점)
    certMajorBasic: ScoreItemDetail;  // 전공필수 자격 (20점)
    certMajorAdvanced: ScoreItemDetail; // 전공심화 자격 (5점)

    // 3. 취업역량강화 (25점)
    industryEdu: ScoreItemDetail;     // 산학협력 교육 (10점)
    careerCourse: ScoreItemDetail;    // 취업역량강화반 코스/동아리/기능대회 (10점)
    fieldTraining: ScoreItemDetail;   // 현장실습/도제/취업확정 (5점)

    // 4. 인성능력 (25점)
    attendance: ScoreItemDetail;      // 출결상황 (10점)
    volunteer: ScoreItemDetail;       // 봉사활동 (5점)
    artsSports: ScoreItemDetail;      // 예체능 운동/관악부 (5점)
    schoolContests: ScoreItemDetail;  // 교내외 대회 참가 (5점)
  };

  rawEvaluationData?: CertificationEvaluationData;
  certificatesList: string[];
  attendanceSummary: {
    absentUnexcused: number;
    lateUnexcused: number;
    earlyUnexcused: number;
    outUnexcused: number;
    totalPenaltyPoints: number;
  };
}

// -------------------------------------------------------------
// 학과별 전공 자격증 매핑 데이터 (평가규정 서식 반영)
// -------------------------------------------------------------
export const MAJOR_CERTIFICATES_CONFIG: Record<string, string[]> = {
  '자동화기계과': [
    '컴퓨터응용선반기능사', '컴퓨터응용밀링기능사', '피복아크용접기능사', '금형기능사',
    '전산응용기계제도기능사', '설비보전기능사', '3D프린터운용기능사', '자동화설비기능사',
    '기계정비기능사', '반도체설비보전기능사'
  ],
  '친환경자동차과': [
    '자동차정비기능사', '컴퓨터응용선반기능사', '컴퓨터응용밀링기능사', '설비보전기능사',
    '자동차차체수리기능사', '피복아크용접기능사'
  ],
  '스마트공간과': [
    '전산응용건축제도기능사', '건축도장기능사', '가구제작기능사', '목공예기능사',
    '측량기능사', '건설재료시험기능사', '전산응용토목제도기능사', '콘크리트기능사'
  ],
  '스마트전기과': [
    '전기기능사', '승강기기능사', '승강기 기능사', '철도전기신호기능사', '자동화설비기능사',
    '설비보전기능사', '3D프린터운용기능사', '신재생에너지발전설비기능사(태양광)', '신재생에너지발전설비기능사'
  ],
  '바이오화학과': [
    '화학분석기능사', '위험물기능사', '환경기능사', '가스기능사'
  ],
  '스마트융합섬유과': [
    '염색(침염)기능사', '염색기능사', '환경기능사', '3D프린터운용기능사'
  ],
  '공통': [
    '철도교통안전관리자', '지게차운전기능사', '지게차기능사', '정보기기운용기능사', '프로그래밍기능사'
  ]
};

// 모든 전공 인정 자격증 통합 목록 (타학과 자격증도 전공 자격증으로 인정 가능)
export const ALL_MAJOR_CERTIFICATES = Array.from(new Set(
  Object.values(MAJOR_CERTIFICATES_CONFIG).flat()
));

// -------------------------------------------------------------
// 점수 계산 핵심 함수들
// -------------------------------------------------------------

/**
 * 1. 직업공통능력평가 등급 점수 계산 (15점)
 */
/**
 * 1. 직업공통능력평가 등급 점수 계산 (15점)
 * - 4개 영역(국/영/수/문) 전과목 1등급 = 합계 4등급 (최고점)
 * - 값이 없거나 미입력/미응시인 경우: 5등급으로 취급(합계 20등급)하여 최하점 부여
 */
export function calcVocalGrade3Score(gradeSum?: number): { score: number; index: number; text: string } {
  if (!gradeSum || gradeSum <= 0 || gradeSum > 16) {
    return { score: 0, index: -1, text: (!gradeSum || gradeSum <= 0) ? '미응시 (0점)' : `합계 ${gradeSum}등급 (16등급 초과: 0점)` };
  }
  if (gradeSum === 4) return { score: 7, index: 0, text: '합계 4등급 이하 (7점 - 만점)' };
  if (gradeSum <= 7) return { score: 6, index: 1, text: `합계 ${gradeSum}등급 (6점)` };
  if (gradeSum <= 10) return { score: 5, index: 2, text: `합계 ${gradeSum}등급 (5점)` };
  if (gradeSum <= 13) return { score: 4, index: 3, text: `합계 ${gradeSum}등급 (4점)` };
  return { score: 3, index: 4, text: `합계 ${gradeSum}등급 (3점)` };
}

export function calcVocalGrade2Score(gradeSum?: number): { score: number; index: number; text: string } {
  if (!gradeSum || gradeSum <= 0 || gradeSum > 16) {
    return { score: 0, index: -1, text: (!gradeSum || gradeSum <= 0) ? '미응시 (0점)' : `합계 ${gradeSum}등급 (16등급 초과: 0점)` };
  }
  if (gradeSum === 4) return { score: 5, index: 0, text: '합계 4등급 이하 (5점 - 만점)' };
  if (gradeSum <= 7) return { score: 4, index: 1, text: `합계 ${gradeSum}등급 (4점)` };
  if (gradeSum <= 10) return { score: 3, index: 2, text: `합계 ${gradeSum}등급 (3점)` };
  if (gradeSum <= 13) return { score: 2, index: 3, text: `합계 ${gradeSum}등급 (2점)` };
  return { score: 1, index: 4, text: `합계 ${gradeSum}등급 (1점)` };
}

export function calcVocalGrade1Score(gradeSum?: number): { score: number; index: number; text: string } {
  if (!gradeSum || gradeSum <= 0 || gradeSum > 16) {
    return { score: 0, index: -1, text: (!gradeSum || gradeSum <= 0) ? '미응시 (0점)' : `합계 ${gradeSum}등급 (16등급 초과: 0점)` };
  }
  if (gradeSum === 4) return { score: 3, index: 0, text: '합계 4등급 이하 (3점 - 만점)' };
  if (gradeSum <= 7) return { score: 2.5, index: 1, text: `합계 ${gradeSum}등급 (2.5점)` };
  if (gradeSum <= 10) return { score: 2, index: 2, text: `합계 ${gradeSum}등급 (2점)` };
  if (gradeSum <= 13) return { score: 1.5, index: 3, text: `합계 ${gradeSum}등급 (1.5점)` };
  return { score: 1, index: 4, text: `합계 ${gradeSum}등급 (1점)` };
}

export function calcVocalMockGradeScore(gradeSum?: number): { score: number; index: number; text: string } {
  if (!gradeSum || gradeSum <= 0 || gradeSum > 13) {
    return { score: 0, index: -1, text: (!gradeSum || gradeSum <= 0) ? '미응시 (0점)' : `합계 ${gradeSum}등급 (13등급 초과: 0점)` };
  }
  if (gradeSum === 4) return { score: 2, index: 0, text: '합계 4등급 이하 (2점 - 만점)' };
  if (gradeSum <= 7) return { score: 1.5, index: 1, text: `합계 ${gradeSum}등급 (1.5점)` };
  if (gradeSum <= 10) return { score: 1, index: 2, text: `합계 ${gradeSum}등급 (1점)` };
  return { score: 0.5, index: 3, text: `합계 ${gradeSum}등급 (0.5점)` };
}

/**
 * 2. 자격증 33점 자동 분류 및 점수 산출
 */
export function evaluateCertificates(certificates: string[], studentMajor?: string) {
  const normCerts = (certificates || []).map(c => c.trim()).filter(Boolean);

  // A. 컴퓨터 관련 자격 (컴활 2급이상, 워드 2급이상, GTQ 2급이상) - 최대 3점
  // 2개 이상: 3점, 1개: 2점
  const computerCerts = normCerts.filter(c => {
    const s = c.replace(/\s+/g, '');
    const isDIATorITQ = s.includes('디지털정보') || s.includes('DIAT') || s.toUpperCase().includes('ITQ') || s.includes('정보기술자격') || s.includes('PCT');
    if (isDIATorITQ) return false;

    return s.includes('컴퓨터활용능력') || s.includes('워드프로세서') || s.includes('GTQ') || s.includes('그래픽기술자격');
  });
  const computerCount = computerCerts.length;
  let compScore = 0;
  let compIndex = -1;
  let compText = '해당 없음 (0점)';
  if (computerCount >= 2) {
    compScore = 3;
    compIndex = 0;
    compText = `2개 이상 취득 (${computerCerts.join(', ')}) (3점)`;
  } else if (computerCount === 1) {
    compScore = 2;
    compIndex = 1;
    compText = `1개 취득 (${computerCerts[0]}) (2점)`;
  }

  // B. 정보기술자격 (ITQ, PCT, DIAT / 디지털정보활용능력 - 1개당 0.5점, 최대 2점 = 4개)
  // 최상등급 인정: ITQ(A등급), PCT(A등급), DIAT·디지털정보활용능력(고급)
  const infoTechCerts = normCerts.filter(c => {
    const s = c.toUpperCase().replace(/\s+/g, '');
    const isITQ = s.includes('ITQ') || s.includes('정보기술자격');
    const isPCT = s.includes('PCT') || s.includes('PC활용능력');
    const isDIAT = s.includes('DIAT') || s.includes('디지털정보활용능력') || s.includes('디지털정보활용') || s.includes('디지털정보');
    if (!isITQ && !isPCT && !isDIAT) return false;

    // 하위 등급 제외 (최상등급인 A등급 / 고급 인정)
    if (isITQ) {
      if (s.includes('B등급') || s.includes('C등급') || s.includes('(B)') || s.includes('(C)')) return false;
    }
    if (isPCT) {
      if (s.includes('B등급') || s.includes('C등급') || s.includes('B급') || s.includes('C급')) return false;
    }
    if (isDIAT) {
      if (s.includes('중급') || s.includes('초급') || s.includes('B등급') || s.includes('C등급')) return false;
    }
    return true;
  });
  const itCount = infoTechCerts.length;
  const itScore = Math.min(2, itCount * 0.5);
  const itText = itCount > 0 
    ? `${itCount}개 취득 (${infoTechCerts.join(', ')}) (${itScore}점)`
    : '해당 없음 (0점)';

  // C. 한국사능력검정 (1급: 3점, 2급: 2점, 3급: 1점 - 상위 1개만 인정)
  let historyScore = 0;
  let historyIndex = -1;
  let historyText = '해당 없음 (0점)';
  const history1 = normCerts.some(c => c.includes('한국사') && (c.includes('1급') || c.includes('1')));
  const history2 = normCerts.some(c => c.includes('한국사') && (c.includes('2급') || c.includes('2')));
  const history3 = normCerts.some(c => c.includes('한국사') && (c.includes('3급') || c.includes('3')));

  if (history1) {
    historyScore = 3;
    historyIndex = 0;
    historyText = '1급 취득 (3점)';
  } else if (history2) {
    historyScore = 2;
    historyIndex = 1;
    historyText = '2급 취득 (2점)';
  } else if (history3) {
    historyScore = 1;
    historyIndex = 2;
    historyText = '3급 취득 (1점)';
  }

  // D. 전공 필수 / 심화 자격증 (타학과 자격증 포함 인정)
  // 컴퓨터/ITQ/DIAT/한국사를 제외한 전공 자격증 카운트
  const majorCerts = normCerts.filter(c => {
    const s = c.replace(/\s+/g, '');
    const isComp = s.includes('컴퓨터활용') || s.includes('워드') || s.includes('GTQ') || s.includes('그래픽기술자격');
    const isIT = s.toUpperCase().includes('ITQ') || s.includes('PCT') || s.includes('DIAT') || s.includes('정보기술자격') || s.includes('디지털정보활용능력') || s.includes('디지털정보활용') || s.includes('디지털정보');
    const isHist = s.includes('한국사');
    if (isComp || isIT || isHist) return false;

    // 전공 자격증 목록 또는 기능사/기사 자격증 매칭
    return ALL_MAJOR_CERTIFICATES.some(mc => s.includes(mc.replace(/\s+/g, ''))) || s.includes('기능사') || s.includes('산업기사');
  });

  const majorCount = majorCerts.length;

  // 전공기초자격 (20점): 3개 20점 / 2개 15점 / 1개 10점
  let majorBasicScore = 0;
  let majorBasicIndex = -1;
  let majorBasicText = '해당 없음 (0점)';
  if (majorCount >= 3) {
    majorBasicScore = 20;
    majorBasicIndex = 0;
    majorBasicText = `3개 이상 취득 (20점)`;
  } else if (majorCount === 2) {
    majorBasicScore = 15;
    majorBasicIndex = 1;
    majorBasicText = `2개 취득 (15점)`;
  } else if (majorCount === 1) {
    majorBasicScore = 10;
    majorBasicIndex = 2;
    majorBasicText = `1개 취득 (10점)`;
  }

  // 전공심화자격 (5점): 5개 이상 5점 / 4개 3점
  let majorAdvScore = 0;
  let majorAdvIndex = -1;
  let majorAdvText = '해당 없음 (0점)';
  if (majorCount >= 5) {
    majorAdvScore = 5;
    majorAdvIndex = 0;
    majorAdvText = `5개 이상 취득 (${majorCount}개) (5점)`;
  } else if (majorCount === 4) {
    majorAdvScore = 3;
    majorAdvIndex = 1;
    majorAdvText = `4개 취득 (3점)`;
  }

  return {
    computer: { score: compScore, index: compIndex, text: compText, count: computerCount, certs: computerCerts },
    infoTech: { score: itScore, index: itCount > 0 ? 0 : -1, text: itText, count: itCount, certs: infoTechCerts },
    history: { score: historyScore, index: historyIndex, text: historyText },
    majorBasic: { score: majorBasicScore, index: majorBasicIndex, text: majorBasicText, count: majorCount, certs: majorCerts },
    majorAdv: { score: majorAdvScore, index: majorAdvIndex, text: majorAdvText, count: majorCount, certs: majorCerts },
    totalCertScore: compScore + itScore + historyScore + majorBasicScore + majorAdvScore
  };
}

/**
 * 3. 출결 점수 계산 (10점 만점 - 감점제)
 * 공식: 10점 - A(미인정 결석 횟수) x 1점 - B(미인정 지각,조퇴,결과 횟수) x 0.5점
 */
export function evaluateAttendance(attendanceRecords: any[]): {
  score: number;
  text: string;
  summary: {
    absentUnexcused: number;
    lateUnexcused: number;
    earlyUnexcused: number;
    outUnexcused: number;
    totalPenaltyPoints: number;
  };
} {
  let a = 0; // 결석
  let b = 0; // 지각, 조퇴, 결과

  (attendanceRecords || []).forEach(r => {
    a += Number(r.absent_unexcused || 0);
    b += Number(r.late_unexcused || 0) + Number(r.early_unexcused || 0) + Number(r.out_unexcused || 0);
  });

  const penalty = (a * 1.0) + (b * 0.5);
  const rawScore = 10.0 - penalty;
  const score = Math.max(0, Math.round(rawScore * 10) / 10);

  const text = penalty > 0
    ? `출결점수: ${score}점 (미인정 결석 ${a}회, 지각/조퇴/결과 ${b}회 = -${penalty}점 감점)`
    : `만점 10점 (미인정 결석/지각 0건)`;

  return {
    score,
    text,
    summary: {
      absentUnexcused: a,
      lateUnexcused: (attendanceRecords || []).reduce((acc, r) => acc + Number(r.late_unexcused || 0), 0),
      earlyUnexcused: (attendanceRecords || []).reduce((acc, r) => acc + Number(r.early_unexcused || 0), 0),
      outUnexcused: (attendanceRecords || []).reduce((acc, r) => acc + Number(r.out_unexcused || 0), 0),
      totalPenaltyPoints: penalty
    }
  };
}

/**
 * 4. 봉사활동 점수 계산 (5점)
 * 200시간 이상: 5점 / 200시간 미만: 교내봉사시간 x 0.025 + 교외봉사시간 x 0.05
 */
export function evaluateVolunteer(schoolHours = 0, outsideHours = 0): { score: number; index: number; text: string } {
  const totalHours = Number(schoolHours || 0) + Number(outsideHours || 0);
  if (totalHours >= 200) {
    return { score: 5, index: 0, text: `200시간 이상 (${totalHours}시간) (5점)` };
  }

  const raw = (Number(schoolHours || 0) * 0.025) + (Number(outsideHours || 0) * 0.05);
  const score = Math.min(5, Math.max(0, Math.round(raw * 10) / 10));
  return {
    score,
    index: totalHours > 0 ? 1 : -1,
    text: `200시간 미만 (교내 ${schoolHours}h + 교외 ${outsideHours}h = ${score}점)`
  };
}

/**
 * 대회명 정규화 헬퍼 (동일 대회 식별용)
 */
export function getContestBaseTitle(title: string): string {
  return String(title || '')
    .replace(/\s*(입상|참가|출전|수상|공모전참가|공모전입상)\s*$/g, '')
    .replace(/\(\d+회\)/g, '')
    .replace(/\(\d+(\.\d+)?점\)/g, '')
    .replace(/\s+/g, '')
    .trim();
}

/**
 * 대회 실적 목록 평가 (동일 대회에 입상과 참가가 모두 있으면 입상 1.0점 우선 인정, 참가 0.5점 중복 제외)
 */
export function evaluateContestList<T extends { type: 'award' | 'participate'; title: string; dateOrTerm?: string }>(contestList: T[]) {
  const eventMap = new Map<string, { hasAward: boolean; hasParticipate: boolean }>();

  for (const c of contestList) {
    const base = getContestBaseTitle(c.title);
    const key = `${c.dateOrTerm || ''}_${base}`;
    if (!eventMap.has(key)) {
      eventMap.set(key, { hasAward: false, hasParticipate: false });
    }
    const entry = eventMap.get(key)!;
    if (c.type === 'award') {
      entry.hasAward = true;
    } else {
      entry.hasParticipate = true;
    }
  }

  let effectiveAwardCount = 0;
  let effectivePartCount = 0;

  for (const [, flags] of eventMap.entries()) {
    if (flags.hasAward) {
      // 입상이 있는 대회는 입상(1.0점) 우선 부여 (참가 0.5점 중복 제외)
      effectiveAwardCount++;
    } else if (flags.hasParticipate) {
      // 입상이 없는 순수 참가 대회만 참가(0.5점) 부여
      effectivePartCount++;
    }
  }

  const score = Math.min(5.0, Math.round(((effectiveAwardCount * 1.0) + (effectivePartCount * 0.5)) * 10) / 10);

  // 개별 실적별 중복 인정 여부 및 획득 점수 매핑
  const itemsWithStatus = contestList.map(c => {
    const base = getContestBaseTitle(c.title);
    const key = `${c.dateOrTerm || ''}_${base}`;
    const event = eventMap.get(key);
    const isSuperseded = c.type === 'participate' && Boolean(event?.hasAward);
    const earnedScore = c.type === 'award' ? 1.0 : (isSuperseded ? 0.0 : 0.5);

    return {
      ...c,
      isSuperseded,
      earnedScore
    };
  });

  return {
    effectiveAwardCount,
    effectivePartCount,
    totalAwards: contestList.filter(c => c.type === 'award').length,
    totalParticipates: contestList.filter(c => c.type === 'participate').length,
    score,
    itemsWithStatus
  };
}

/**
 * 5. 종합 평가 전체 산출 마스터 함수
 */
export function calculateStudentFullEvaluation(params: {
  student: {
    id: string;
    student_name: string;
    student_number?: string;
    major?: string;
    class_info?: string;
    graduation_year: number;
    certificates?: string[];
  };
  attendanceRecords?: any[];
  evalData?: CertificationEvaluationData;
  baseYear: number;
}): FullStudentEvaluation {
  const { student, attendanceRecords = [], evalData = { student_id: student.id }, baseYear } = params;

  const currentGrade = Math.max(1, Math.min(3, baseYear + 4 - student.graduation_year));

  // 1. 직업공통능력평가 (17점) - 개별 영역별 등급(국/영/수/문제) 또는 등급합계 기반 산출 (미응시/미입력은 0점)
  const getDomainSum = (details?: VocationalDomainGrades, fallbackSum?: number) => {
    if (details) {
      if (details.isCompleted === false) return 0;
      const k = Number(details.korean || 0);
      const e = Number(details.english || 0);
      const m = Number(details.math || 0);
      const p = Number(details.problem || 0);
      if (k === 0 && e === 0 && m === 0 && p === 0) return 0;
      const kVal = k > 0 ? k : 5;
      const eVal = e > 0 ? e : 5;
      const mVal = m > 0 ? m : 5;
      const pVal = p > 0 ? p : 5;
      return kVal + eVal + mVal + pVal;
    }
    return (fallbackSum && fallbackSum > 0 && fallbackSum <= 16) ? fallbackSum : 0;
  };

  const g3Sum = getDomainSum(evalData.vocational_details?.grade3, evalData.vocational_grade_3);
  const g2Sum = getDomainSum(evalData.vocational_details?.grade2, evalData.vocational_grade_2);
  const g1Sum = getDomainSum(evalData.vocational_details?.grade1, evalData.vocational_grade_1);
  const gMockSum = getDomainSum(evalData.vocational_details?.mock, evalData.vocational_mock_grade);

  const v3 = calcVocalGrade3Score(g3Sum);
  const v2 = calcVocalGrade2Score(g2Sum);
  const v1 = calcVocalGrade1Score(g1Sum);
  const vMock = calcVocalMockGradeScore(gMockSum);

  // 2. 자격증 평가 (33점)
  const certsRes = evaluateCertificates(student.certificates || [], student.major);

  // 3. 취업진로교육참여 (10점 - 산학협력부 교육 1회당 1점)
  const eduCount = (evalData.employment_details?.industry_edu_list !== undefined)
    ? evalData.employment_details.industry_edu_list.length
    : Number(evalData.industry_edu_count || 0);
  const eduScore = Math.min(10, Math.max(0, eduCount * 1.0));
  const eduDetail: ScoreItemDetail = {
    category: '취업역량강화',
    name: '산학협력부 주관 교육이수',
    maxScore: 10,
    score: eduScore,
    displayText: eduCount > 0 ? `${eduCount}회 이수 (${eduScore}점)` : '해당 없음 (0점)'
  };

  // 4. 취업역량강화반 참여 (최대 10점 캡)
  // 진로코스: 4학기(10점), 3학기(8점), 2학기(6점), 1학기(4점)
  let courseScore = 0;
  let courseIndex = -1;
  const courseSems = (evalData.employment_details?.career_courses !== undefined)
    ? Object.keys(evalData.employment_details.career_courses).length
    : Number(evalData.career_course_semesters || 0);
  if (courseSems >= 4) { courseScore = 10; courseIndex = 0; }
  else if (courseSems === 3) { courseScore = 8; courseIndex = 1; }
  else if (courseSems === 2) { courseScore = 6; courseIndex = 2; }
  else if (courseSems === 1) { courseScore = 4; courseIndex = 3; }

  // 동아리: 3개년(5점), 2개년(4점), 1개년(3점)
  let clubScore = 0;
  const clubYears = (evalData.employment_details?.major_clubs !== undefined)
    ? Object.keys(evalData.employment_details.major_clubs).length
    : Number(evalData.major_club_years || 0);
  if (clubYears >= 3) clubScore = 5;
  else if (clubYears === 2) clubScore = 4;
  else if (clubYears === 1) clubScore = 3;

  // 기능경기대회: 전국(5점), 지방(2점)
  let contestSkillsScore = 0;
  const skillsLevel = (evalData.employment_details?.skills_contest?.level !== undefined)
    ? evalData.employment_details.skills_contest.level
    : (evalData.skills_contest_level || 'none');
  if (skillsLevel === 'national') contestSkillsScore = 5;
  else if (skillsLevel === 'regional') contestSkillsScore = 2;

  const rawCareerSum = courseScore + clubScore + contestSkillsScore;
  const careerCourseFinalScore = Math.min(10, rawCareerSum);
  const careerCourseDetail: ScoreItemDetail = {
    category: '취업역량강화',
    name: '취업역량강화반/동아리/기능대회',
    maxScore: 10,
    score: careerCourseFinalScore,
    checkedOptionIndex: courseIndex,
    details: {
      courseScore,
      clubScore,
      contestSkillsScore,
      courseSemesters: courseSems,
      clubYears,
      skillsContestLevel: skillsLevel
    },
    displayText: rawCareerSum > 0 
      ? `진로코스 ${courseSems}학기(${courseScore}점) + 동아리 ${clubYears}개학년(${clubScore}점) + 기능대회(${contestSkillsScore}점) = ${careerCourseFinalScore}점`
      : '해당 없음 (0점)'
  };

  // 5. 현장실습 참여 (최대 5점 캡)
  let fieldScore = 0;
  const isFieldCompleted = evalData.employment_details?.field_training !== undefined
    ? Boolean(evalData.employment_details.field_training.completed)
    : Boolean(evalData.field_training_completed);

  const isEmployedEarly = evalData.employment_details?.employed_early !== undefined
    ? Boolean(evalData.employment_details.employed_early.confirmed)
    : Boolean(evalData.employed_early);

  const ojtSems = evalData.employment_details?.apprenticeship !== undefined
    ? Object.keys(evalData.employment_details.apprenticeship).length
    : Number(evalData.apprenticeship_semesters || 0);

  if (isFieldCompleted || isEmployedEarly) {
    fieldScore = 5;
  } else {
    if (ojtSems >= 4) fieldScore = 5;
    else if (ojtSems === 3) fieldScore = 4;
    else if (ojtSems === 2) fieldScore = 3;
    else if (ojtSems === 1) fieldScore = 2;
  }
  const fieldFinalScore = Math.min(5, fieldScore);
  const fieldDetail: ScoreItemDetail = {
    category: '취업역량강화',
    name: '현장실습 및 도제 참여',
    maxScore: 5,
    score: fieldFinalScore,
    displayText: fieldFinalScore > 0 ? `현장실습/도제 참여 (${fieldFinalScore}점)` : '해당 없음 (0점)'
  };

  // 6. 출결상황 (10점)
  const attRes = evaluateAttendance(attendanceRecords);

  // 7. 봉사활동 (5점)
  const volRes = evaluateVolunteer(evalData.volunteer_school_hours, evalData.volunteer_outside_hours);

  // 8. 예체능활동 참여 (5점 - 운동부/관악부)
  let sportsScore = 0;
  let sportsIndex = -1;
  const sportsSems = (evalData.arts_contest_details?.arts_sports !== undefined)
    ? Object.keys(evalData.arts_contest_details.arts_sports).length
    : Number(evalData.arts_sports_semesters || 0);
  if (sportsSems >= 6) { sportsScore = 5; sportsIndex = 0; }
  else if (sportsSems === 5) { sportsScore = 4; sportsIndex = 1; }
  else if (sportsSems === 4) { sportsScore = 3; sportsIndex = 2; }
  else if (sportsSems === 3) { sportsScore = 2; sportsIndex = 3; }
  else if (sportsSems >= 2) { sportsScore = 1; sportsIndex = 4; }
  const sportsDetail: ScoreItemDetail = {
    category: '인성능력',
    name: '운동부 및 관악부 참여',
    maxScore: 5,
    score: sportsScore,
    checkedOptionIndex: sportsIndex,
    displayText: sportsScore > 0 ? `${sportsSems}학기 참여 (${sportsScore}점)` : '해당 없음 (0점)'
  };

  // 9. 교내외 대회 참가 (최대 5점 - 입상 건당 1점, 참가 건당 0.5점, 동일 대회 입상 시 입상 우선 부여)
  const contestList = evalData.arts_contest_details?.contest_list || [];
  let contestScore = 0;
  let effectiveAwardCount = 0;
  let effectivePartCount = 0;

  if (contestList.length > 0) {
    const res = evaluateContestList(contestList);
    effectiveAwardCount = res.effectiveAwardCount;
    effectivePartCount = res.effectivePartCount;
    contestScore = res.score;
  } else {
    effectiveAwardCount = Number(evalData.contest_award_count || 0);
    effectivePartCount = Number(evalData.contest_participate_count || 0);
    contestScore = Math.min(5, Math.max(0, Math.round(((effectiveAwardCount * 1.0) + (effectivePartCount * 0.5)) * 10) / 10));
  }

  const contestDetail: ScoreItemDetail = {
    category: '인성능력',
    name: '교내외 각종 대회 참가',
    maxScore: 5,
    score: contestScore,
    displayText: contestScore > 0 
      ? `입상 ${effectiveAwardCount}건, 참가 ${effectivePartCount}건 (${contestScore}점)` 
      : '해당 없음 (0점)'
  };

  // -------------------------------------------------------------
  // 4대 영역별 점수 합산
  // -------------------------------------------------------------
  // 1. 직업공통능력 (25점) = 직기초(15) + 모의평가(2) + 컴퓨터(3) + 정보기술(2) + 한국사(3)
  const vocationalCommonScore = Math.min(25, 
    v3.score + v2.score + v1.score + vMock.score + 
    certsRes.computer.score + certsRes.infoTech.score + certsRes.history.score
  );

  // 2. 전공능력 (25점) = 전공기초(20) + 전공심화(5)
  const majorScore = Math.min(25, certsRes.majorBasic.score + certsRes.majorAdv.score);

  // 3. 취업역량강화 (25점) = 산학교육(10) + 취업역량반(10) + 현장실습(5)
  const employmentScore = Math.min(25, eduScore + careerCourseFinalScore + fieldFinalScore);

  // 4. 인성능력 (25점) = 출결(10) + 봉사(5) + 예체능(5) + 대회참가(5)
  const characterScore = Math.min(25, 
    (evalData.manual_overrides?.attendance_score !== undefined ? evalData.manual_overrides.attendance_score : attRes.score) + 
    volRes.score + sportsScore + contestScore
  );

  // 총점 계산 (수동 오버라이드 총점이 있으면 우선)
  let totalScore = Math.round((vocationalCommonScore + majorScore + employmentScore + characterScore) * 10) / 10;
  if (evalData.manual_overrides?.total_score !== undefined) {
    totalScore = evalData.manual_overrides.total_score;
  }

  // 랭크 산정
  let rank: CertificationRank = 'D';
  if (totalScore >= 81) rank = 'S';
  else if (totalScore >= 61) rank = 'A';
  else if (totalScore >= 41) rank = 'B';
  else if (totalScore >= 21) rank = 'C';
  else rank = 'D';

  const isCertified = totalScore >= 70;

  return {
    studentId: student.id,
    studentName: student.student_name,
    studentNumber: student.student_number || '',
    major: student.major || '',
    classInfo: student.class_info || '',
    graduationYear: student.graduation_year,
    currentGrade,

    vocationalCommonScore,
    majorScore,
    employmentScore,
    characterScore,
    totalScore,
    rank,
    isCertified,

    details: {
      vocal3Grade: { category: '직업공통능력', name: '전국단위평가(3학년)', maxScore: 7, score: v3.score, checkedOptionIndex: v3.index, displayText: v3.text },
      vocal2Grade: { category: '직업공통능력', name: '자가진단평가(2학년)', maxScore: 5, score: v2.score, checkedOptionIndex: v2.index, displayText: v2.text },
      vocal1Grade: { category: '직업공통능력', name: '자가진단평가(1학년)', maxScore: 3, score: v1.score, checkedOptionIndex: v1.index, displayText: v1.text },
      vocalMockGrade: { category: '직업공통능력', name: '모의평가 등급', maxScore: 2, score: vMock.score, checkedOptionIndex: vMock.index, displayText: vMock.text },
      certComputer: { category: '직업공통능력', name: '컴퓨터관련 자격', maxScore: 3, score: certsRes.computer.score, checkedOptionIndex: certsRes.computer.index, displayText: certsRes.computer.text, details: certsRes.computer },
      certInfoTech: { category: '직업공통능력', name: '정보기술자격', maxScore: 2, score: certsRes.infoTech.score, checkedOptionIndex: certsRes.infoTech.index, displayText: certsRes.infoTech.text, details: certsRes.infoTech },
      certHistory: { category: '직업공통능력', name: '한국사능력검정', maxScore: 3, score: certsRes.history.score, checkedOptionIndex: certsRes.history.index, displayText: certsRes.history.text },

      certMajorBasic: { category: '전공능력', name: '전공 필수 자격', maxScore: 20, score: certsRes.majorBasic.score, checkedOptionIndex: certsRes.majorBasic.index, displayText: certsRes.majorBasic.text, details: certsRes.majorBasic },
      certMajorAdvanced: { category: '전공능력', name: '전공 심화 자격', maxScore: 5, score: certsRes.majorAdv.score, checkedOptionIndex: certsRes.majorAdv.index, displayText: certsRes.majorAdv.text, details: certsRes.majorAdv },

      industryEdu: eduDetail,
      careerCourse: careerCourseDetail,
      fieldTraining: fieldDetail,

      attendance: { 
        category: '인성능력', 
        name: '출결상황', 
        maxScore: 10, 
        score: (evalData.manual_overrides?.attendance_score !== undefined ? evalData.manual_overrides.attendance_score : attRes.score), 
        displayText: attRes.text, 
        details: attRes.summary 
      },
      volunteer: { category: '인성능력', name: '교내외 봉사활동', maxScore: 5, score: volRes.score, checkedOptionIndex: volRes.index, displayText: volRes.text },
      artsSports: sportsDetail,
      schoolContests: contestDetail
    },

    rawEvaluationData: evalData,
    certificatesList: student.certificates || [],
    attendanceSummary: attRes.summary
  };
}
