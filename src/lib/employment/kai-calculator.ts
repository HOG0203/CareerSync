// ==============================================================================
// src/lib/employment/kai-calculator.ts
// 한국항공우주산업(주) KAI 고등학교 내신등급 계산 엔진
// ==============================================================================

export interface KaiSubjectRow {
  subject: string;
  credits: number;
  rankGrade: number; // 1~9
  weightedGrade: number; // credits * rankGrade
  isExcluded?: boolean;
  excludeReason?: string;
  originalRankGrade?: string | null;
  originalAchievement?: string | null;
}

export interface KaiSemesterData {
  grade: number;
  semester: number;
  label: string; // e.g. "1학년 1학기"
  rows: KaiSubjectRow[];
  totalCredits: number;
  totalWeightedGrade: number;
  semesterAverageGrade: number | null; // totalWeightedGrade / totalCredits
}

export interface KaiCalculationResult {
  studentId: string;
  studentName: string;
  studentNumber: string;
  classInfo: string;
  major: string;
  type: 'all' | 'kem'; // 'all': 전과목 평균, 'kem': 국영수 평균
  semesters: KaiSemesterData[]; // [1-1, 1-2, 2-1, 2-2, 3-1]
  grandTotalCredits: number;
  grandTotalWeightedGrade: number;
  finalGrade: number; // ROUND(grandTotalWeightedGrade / grandTotalCredits, 2)
  includedCount: number;
  excludedCount: number;
}

export interface RawScoreRecord {
  grade: number;
  semester: number;
  subject: string;
  credits: number | null;
  achievement: string | null;
  rank_grade: string | null;
}

// ------------------------------------------------------------------------------
// 1. 과목군 분류 함수
// ------------------------------------------------------------------------------

/** 국어 교과군 판별 */
export function isKoreanSubject(name: string): boolean {
  if (!name) return false;
  const normalized = name.replace(/\s+/g, '');
  const keywords = ['국어', '문학', '독서', '화법', '작문', '언어와매체', '고전읽기', '실용국어', '심화국어', '기본국어'];
  return keywords.some(k => normalized.includes(k));
}

/** 수학 교과군 판별 */
export function isMathSubject(name: string): boolean {
  if (!name) return false;
  const normalized = name.replace(/\s+/g, '');
  const keywords = ['수학', '미적분', '기하', '확률과통계', '실용수학', '경제수학', '인공지능수학', '기본수학', '심화수학'];
  return keywords.some(k => normalized.includes(k));
}

/** 영어 교과군 판별 */
export function isEnglishSubject(name: string): boolean {
  if (!name) return false;
  const normalized = name.replace(/\s+/g, '');
  const keywords = ['영어', '영어회화', '영어독해', '실용영어', '심화영어', '기본영어', '진로영어'];
  return keywords.some(k => normalized.includes(k));
}

/** 국영수 통합 판별 */
export function isKoreanEnglishMathSubject(name: string): boolean {
  return isKoreanSubject(name) || isMathSubject(name) || isEnglishSubject(name);
}

/** 예체능 과목 제외 판별 (KAI 지침 4항: 예체능 성적 산출에서 제외) */
export function isArtOrPhysicalSubject(name: string): boolean {
  if (!name) return false;
  const normalized = name.replace(/\s+/g, '');
  const keywords = [
    '체육', '운동', '스포츠', '축구', '육상', '건강',
    '음악', '연주', '가창', '감상과비평',
    '미술', '창작', '드로잉', '조형'
  ];
  return keywords.some(k => normalized.includes(k));
}

/** 제2외국어 및 한문 과목 제외 판별 (KAI 지침 4항: 제2외국어 성적 산출에서 제외) */
export function isSecondForeignOrHanja(name: string): boolean {
  if (!name) return false;
  const normalized = name.replace(/\s+/g, '');
  const keywords = [
    '일본어', '중국어', '한문', '독일어', '프랑스어', 
    '스페인어', '러시아어', '아랍어', '베트남어'
  ];
  return keywords.some(k => normalized.includes(k));
}

// ------------------------------------------------------------------------------
// 2. 석차등급 환산 함수 (KAI 지침 3항)
// ------------------------------------------------------------------------------

/**
 * 1~9등급 또는 A~E 성취도를 KAI 공식 석차등급(1~9)으로 환산
 * - 1~9등급: 해당 숫자 그대로 적용
 * - A~E 성취도: A=1, B=3, C=5, D=7, E=9
 * - 진로선택과목 A~C: A=1, B=3, C=5
 * - 환산 불가(P/F 등)시 null 반환
 */
export function convertToKaiGrade(rankGrade: string | null | undefined, achievement: string | null | undefined): number | null {
  if (rankGrade && !isNaN(Number(rankGrade))) {
    const num = Number(rankGrade);
    if (num >= 1 && num <= 9) return num;
  }
  if (achievement) {
    const ach = achievement.trim().toUpperCase();
    if (ach === 'A') return 1;
    if (ach === 'B') return 3;
    if (ach === 'C') return 5;
    if (ach === 'D') return 7;
    if (ach === 'E') return 9;
  }
  return null;
}

// ------------------------------------------------------------------------------
// 3. 5개 학기 성적 집계 엔진
// ------------------------------------------------------------------------------

export const KAI_TARGET_SEMESTERS = [
  { grade: 1, semester: 1, label: '1학년 1학기' },
  { grade: 1, semester: 2, label: '1학년 2학기' },
  { grade: 2, semester: 1, label: '2학년 1학기' },
  { grade: 2, semester: 2, label: '2학년 2학기' },
  { grade: 3, semester: 1, label: '3학년 1학기' },
];

export function calculateKaiGrades(
  student: {
    id: string;
    student_name: string;
    student_number: string;
    class_info: string;
    major: string;
  },
  scores: RawScoreRecord[],
  mode: 'all' | 'kem',
  manualExcludedSubjectKeys?: Set<string> // `${grade}_${semester}_${subject}`
): KaiCalculationResult {
  const semestersData: KaiSemesterData[] = [];
  let grandTotalCredits = 0;
  let grandTotalWeightedGrade = 0;
  let includedCount = 0;
  let excludedCount = 0;

  for (const sem of KAI_TARGET_SEMESTERS) {
    const semScores = scores.filter(s => s.grade === sem.grade && s.semester === sem.semester);
    const rows: KaiSubjectRow[] = [];
    let semCredits = 0;
    let semWeighted = 0;

    for (const sc of semScores) {
      const subjectName = (sc.subject || '').trim();
      const uniqueKey = `${sem.grade}_${sem.semester}_${subjectName}`;

      // 1) 수동 제외 여부 검사
      if (manualExcludedSubjectKeys && manualExcludedSubjectKeys.has(uniqueKey)) {
        excludedCount++;
        continue;
      }

      // 2) 국영수 모드인 경우: 국영수가 아닌 과목 제외
      if (mode === 'kem') {
        if (!isKoreanEnglishMathSubject(subjectName)) {
          excludedCount++;
          continue;
        }
      }

      // 3) 예체능 제외 (KAI 지침 4항)
      if (isArtOrPhysicalSubject(subjectName)) {
        excludedCount++;
        continue;
      }

      // 4) 제2외국어 및 한문 제외 (KAI 지침 4항)
      if (isSecondForeignOrHanja(subjectName)) {
        excludedCount++;
        continue;
      }

      // 5) 단위수 유효성 검사
      const credits = sc.credits ? Number(sc.credits) : 0;
      if (credits <= 0) {
        excludedCount++;
        continue;
      }

      // 6) 등급 환산
      const rankGrade = convertToKaiGrade(sc.rank_grade, sc.achievement);
      if (rankGrade === null) {
        excludedCount++;
        continue;
      }

      const weightedGrade = credits * rankGrade;
      semCredits += credits;
      semWeighted += weightedGrade;
      includedCount++;

      rows.push({
        subject: subjectName,
        credits,
        rankGrade,
        weightedGrade,
        originalRankGrade: sc.rank_grade,
        originalAchievement: sc.achievement,
      });
    }

    grandTotalCredits += semCredits;
    grandTotalWeightedGrade += semWeighted;

    semestersData.push({
      grade: sem.grade,
      semester: sem.semester,
      label: sem.label,
      rows,
      totalCredits: semCredits,
      totalWeightedGrade: semWeighted,
      semesterAverageGrade: semCredits > 0 ? Math.round((semWeighted / semCredits) * 100) / 100 : null,
    });
  }

  const finalGrade = grandTotalCredits > 0 
    ? Math.round((grandTotalWeightedGrade / grandTotalCredits) * 100) / 100 
    : 0;

  return {
    studentId: student.id,
    studentName: student.student_name,
    studentNumber: student.student_number,
    classInfo: student.class_info,
    major: student.major,
    type: mode,
    semesters: semestersData,
    grandTotalCredits,
    grandTotalWeightedGrade,
    finalGrade,
    includedCount,
    excludedCount,
  };
}
