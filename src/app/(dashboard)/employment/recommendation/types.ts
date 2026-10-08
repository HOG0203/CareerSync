// ==============================================================================
// src/app/(dashboard)/employment/recommendation/types.ts
// 학교장 추천/선발 시스템 공유 타입 및 기본 설정값
// ==============================================================================

export interface GradeExclusionRules {
  excludeArts: boolean; // 예체능(체육/음악/미술/스포츠/건강) 제외 (기본 true)
  excludeSecondLang: boolean; // 제2외국어 및 한문 제외 (기본 true)
  excludePF: boolean; // P/F(이수/미이수) 과목 제외 (기본 true)
  subjectGroup: 'all' | 'kem' | 'general' | 'vocational'; // 반영 교과군 (기본 'all': 예체능·외국어 제외 전과목)
  targetSemesters: 'five_semesters' | 'all_semesters'; // 반영 학기 (기본 'five_semesters': 1-1 ~ 3-1 5개 학기)
  gradeScale: '9_scale' | '5_scale'; // 9등급제(1,3,5,7,9) vs 5등급제(1,2,3,4,5) (기본 '9_scale')
  preferRankGrade: boolean; // 기존 데이터에 석차등급이 있는 경우 석차등급 우선 적용 (기본 true)
}

export const DEFAULT_GRADE_RULES: GradeExclusionRules = {
  excludeArts: true,
  excludeSecondLang: true,
  excludePF: true,
  subjectGroup: 'all',
  targetSemesters: 'five_semesters',
  gradeScale: '9_scale',
  preferRankGrade: true
};

export interface EvaluationWeightsConfig {
  mode: 'standard' | 'custom';
  useNcs: boolean;
  useSchoolScore: boolean;
  useCertScore: boolean;
  useInterview: boolean;
  ncsMax: number;          // 기본 30
  schoolScoreMax: number;  // 기본 30
  certScoreMax: number;    // 기본 30
  interviewMax: number;    // 기본 10
}

export const DEFAULT_EVALUATION_WEIGHTS: EvaluationWeightsConfig = {
  mode: 'standard',
  useNcs: true,
  useSchoolScore: true,
  useCertScore: true,
  useInterview: true,
  ncsMax: 30,
  schoolScoreMax: 30,
  certScoreMax: 30,
  interviewMax: 10
};

export interface CandidateScoreRecord {
  studentId: string;
  studentName: string;
  studentNumber: string;
  major: string;
  classInfo: string;
  graduationYear: number;
  // NCS: 배점 직접 입력 (기본 0~30점)
  ncsScore: number | null;
  // 면접: 배점 직접 입력 (기본 0~10점)
  interviewScore: number | null;
  // 교과성적: 평균 등급(GPA) 및 100점 만점 원점수, 설정 배점 환산점수
  schoolAverageGrade?: number | null;
  schoolScoreOriginal: number | null;
  schoolScoreConverted: number | null;
  // 옥저인재인증: 100점 만점 원점수 및 설정 배점 환산점수
  certScoreOriginal: number | null;
  certScoreConverted: number | null;
  // 종합점수
  totalScore: number | null;
  remarks?: string;
  addedAt: string;
}

export interface RecommendationSession {
  id: string;
  title: string;
  targetGrade: number; // 대상 학년 (기본 3학년)
  recommendationQuota: number; // 추천 선발 인원수 (기본 5명)
  description?: string;
  gradeRules?: GradeExclusionRules; // 성적 제외 및 반영 규칙 프리셋
  evaluationWeights?: EvaluationWeightsConfig; // 평가 항목 및 배점 가중치 설정 (표준형 / 커스텀)
  createdAt: string;
  updatedAt: string;
  candidates: Record<string, CandidateScoreRecord>; // studentId -> CandidateScoreRecord
}
