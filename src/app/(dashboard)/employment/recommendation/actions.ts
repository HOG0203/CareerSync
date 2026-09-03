'use server';

// ==============================================================================
// src/app/(dashboard)/employment/recommendation/actions.ts
// 학교장추천대상자 선정 시스템 Server Actions
// (배점: NCS 30점 + 교과성적 30점 + 옥저인재인증 30점 + 면접 10점 = 총 100점 만점)
// (성적 기준: 9등급제/5등급제 선택, 기존 석차등급 우선 적용, 예체능/외국어 제외)
// ==============================================================================

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { getCachedCertificationSummaryList } from '@/app/(dashboard)/admin/certification/actions';
import * as XLSX from 'xlsx';

// 🎯 성적 산출 제외/반영 규칙 프리셋 인터페이스
export interface GradeExclusionRules {
  excludeArts: boolean; // 예체능(체육/음악/미술/스포츠/건강) 제외 (기본 true)
  excludeSecondLang: boolean; // 제2외국어 및 한문 제외 (기본 true)
  excludePF: boolean; // P/F(이수/미이수) 과목 제외 (기본 true)
  subjectGroup: 'all' | 'kem' | 'general' | 'vocational'; // 반영 교과군 (기본 'all': 예체능·외국어 제외 전과목)
  targetSemesters: 'five_semesters' | 'all_semesters'; // 반영 학기 (기본 'five_semesters': 1-1 ~ 3-1 5개 학기)
  gradeScale: '9_scale' | '5_scale'; // 9등급제(1,3,5,7,9) vs 5등급제(1,2,3,4,5) (기본 '9_scale')
  preferRankGrade: boolean; // 기존 데이터에 석차등급이 있는 경우 석차등급 우선 적용 (기본 true)
}

const DEFAULT_GRADE_RULES: GradeExclusionRules = {
  excludeArts: true,
  excludeSecondLang: true,
  excludePF: true,
  subjectGroup: 'all',
  targetSemesters: 'five_semesters',
  gradeScale: '9_scale',
  preferRankGrade: true
};

export interface CandidateScoreRecord {
  studentId: string;
  studentName: string;
  studentNumber: string;
  major: string;
  classInfo: string;
  graduationYear: number;
  // NCS: 30점 만점 직접 입력
  ncsScore: number | null; // 0 ~ 30
  // 면접: 10점 만점 직접 입력
  interviewScore: number | null; // 0 ~ 10
  // 교과성적: 평균 등급(GPA) 및 100점 만점 원점수, 30점 만점 환산점수
  schoolAverageGrade?: number | null; // 예: 1.10등급
  schoolScoreOriginal: number | null; // 0 ~ 100점
  schoolScoreConverted: number | null; // 0 ~ 30점
  // 옥저인재인증: 100점 만점 원점수 및 30점 만점 환산점수 (원점수 * 0.3)
  certScoreOriginal: number | null;
  certScoreConverted: number | null;
  // 종합점수: 100점 만점
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
  createdAt: string;
  updatedAt: string;
  candidates: Record<string, CandidateScoreRecord>; // studentId -> CandidateScoreRecord
}

const SESSIONS_STORE_KEY = 'principal_recommendation_sessions';

// ------------------------------------------------------------------------------
// 교과목 분류 및 제외 판별 헬퍼 함수
// ------------------------------------------------------------------------------
function isArtsOrPhysical(name: string): boolean {
  if (!name) return false;
  const n = name.replace(/\s+/g, '');
  const keywords = ['체육', '체조', '운동', '스포츠', '축구', '육상', '음악', '미술', '창작', '건강'];
  return keywords.some(k => n.includes(k));
}

function isSecondForeignOrHanja(name: string): boolean {
  if (!name) return false;
  const n = name.replace(/\s+/g, '');
  const keywords = ['일본어', '중국어', '한문', '독일어', '프랑스어', '스페인어', '러시아어', '베트남어'];
  return keywords.some(k => n.includes(k));
}

function isKorean(name: string): boolean {
  if (!name) return false;
  const n = name.replace(/\s+/g, '');
  const keywords = ['국어', '문학', '독서', '화법', '작문', '언어와', '고전'];
  return keywords.some(k => n.includes(k));
}

function isMath(name: string): boolean {
  if (!name) return false;
  const n = name.replace(/\s+/g, '');
  const keywords = ['수학', '미적분', '기하', '확률'];
  return keywords.some(k => n.includes(k));
}

function isEnglish(name: string): boolean {
  if (!name) return false;
  return name.includes('영어');
}

function isGeneralSubject(name: string): boolean {
  if (!name) return false;
  if (isKorean(name) || isMath(name) || isEnglish(name)) return true;
  const n = name.replace(/\s+/g, '');
  const generalKeywords = ['사회', '역사', '도덕', '과학', '물리', '화학', '생명', '지구', '한국사', '통합사회', '통합과학', '기술·가정', '정보'];
  return generalKeywords.some(k => n.includes(k));
}

/**
 * 여러 학생들의 교과 성적을 지정된 기준(9등급제/5등급제, 기존등급우선, 제외규칙)에 맞춰 일괄 계산
 */
export async function batchCalculateStudentSchoolScores(
  studentIds: string[],
  rules?: GradeExclusionRules
): Promise<Record<string, { schoolOriginal: number; schoolConverted: number; schoolAverageGrade: number }>> {
  try {
    const supabase = createAdminClient();
    const effectiveRules: GradeExclusionRules = {
      ...DEFAULT_GRADE_RULES,
      ...(rules || {})
    };

    const is9Scale = effectiveRules.gradeScale !== '5_scale';
    const preferRankGrade = effectiveRules.preferRankGrade ?? true;

    // 15명 단위 청크 조회
    const chunkSize = 15;
    const chunks: string[][] = [];
    for (let i = 0; i < studentIds.length; i += chunkSize) {
      chunks.push(studentIds.slice(i, i + chunkSize));
    }

    const scorePromises = chunks.map(chunk =>
      supabase
        .from('student_scores')
        .select('student_id, grade, semester, subject, credits, achievement, rank_grade')
        .in('student_id', chunk)
    );

    const scoreResults = await Promise.all(scorePromises);
    const scoresByStudent: Record<string, any[]> = {};
    scoreResults.forEach(r => {
      (r.data || []).forEach((sc: any) => {
        if (!scoresByStudent[sc.student_id]) scoresByStudent[sc.student_id] = [];
        scoresByStudent[sc.student_id].push(sc);
      });
    });

    const resultMap: Record<string, { schoolOriginal: number; schoolConverted: number; schoolAverageGrade: number }> = {};

    studentIds.forEach(id => {
      const sList = scoresByStudent[id] || [];
      let totalGradeWeighted = 0;
      let totalCredits = 0;

      sList.forEach(sc => {
        // 학기 필터 (5개 학기 제한 시 3-2 이상 제외)
        if (effectiveRules.targetSemesters === 'five_semesters') {
          if (sc.grade > 3 || (sc.grade === 3 && sc.semester > 1)) return;
        }

        const sub = sc.subject || '';
        if (effectiveRules.excludeArts && isArtsOrPhysical(sub)) return;
        if (effectiveRules.excludeSecondLang && isSecondForeignOrHanja(sub)) return;
        if (effectiveRules.excludePF && sc.achievement?.toUpperCase() === 'P') return;

        if (effectiveRules.subjectGroup === 'kem') {
          if (!isKorean(sub) && !isMath(sub) && !isEnglish(sub)) return;
        } else if (effectiveRules.subjectGroup === 'general') {
          if (!isGeneralSubject(sub)) return;
        } else if (effectiveRules.subjectGroup === 'vocational') {
          if (isGeneralSubject(sub)) return;
        }

        const credits = sc.credits ? Number(sc.credits) : 0;
        if (credits <= 0) return;

        let subjectGrade: number | null = null;
        const hasRankGrade = sc.rank_grade && !isNaN(Number(sc.rank_grade));

        // 🎯 1. 기존 데이터에 석차등급이 있는 경우 우선 적용할 것인지 판별
        if (preferRankGrade && hasRankGrade) {
          const rg = Number(sc.rank_grade);
          if (is9Scale) {
            subjectGrade = Math.min(9, Math.max(1, rg));
          } else {
            // 5등급제 환산: 1~2->1, 3~4->2, 5~6->3, 7~8->4, 9->5
            subjectGrade = rg <= 2 ? 1 : rg <= 4 ? 2 : rg <= 6 ? 3 : rg <= 8 ? 4 : 5;
          }
        } else {
          // 🎯 2. 성취도(A, B, C, D, E) 기준 등급 산출
          // 9등급제: A=1, B=3, C=5, D=7, E=9
          // 5등급제: A=1, B=2, C=3, D=4, E=5
          const ach = sc.achievement?.toUpperCase();
          if (is9Scale) {
            const map9: Record<string, number> = { A: 1, B: 3, C: 5, D: 7, E: 9 };
            if (ach && map9[ach]) subjectGrade = map9[ach];
            else if (hasRankGrade) subjectGrade = Math.min(9, Math.max(1, Number(sc.rank_grade)));
          } else {
            const map5: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 };
            if (ach && map5[ach]) subjectGrade = map5[ach];
            else if (hasRankGrade) {
              const rg = Number(sc.rank_grade);
              subjectGrade = rg <= 2 ? 1 : rg <= 4 ? 2 : rg <= 6 ? 3 : rg <= 8 ? 4 : 5;
            }
          }
        }

        if (subjectGrade !== null) {
          totalGradeWeighted += subjectGrade * credits;
          totalCredits += credits;
        }
      });

      if (totalCredits > 0) {
        const avgGrade = parseFloat((totalGradeWeighted / totalCredits).toFixed(2));
        const maxGrade = is9Scale ? 9 : 5;
        // 1.00등급 = 100점 만점, 최저등급(9 또는 5) = 0점
        const original = parseFloat((Math.max(0, Math.min(100, 100 - (avgGrade - 1) * (100 / (maxGrade - 1))))).toFixed(2));
        const converted = parseFloat((original * 0.3).toFixed(2));
        resultMap[id] = { schoolOriginal: original, schoolConverted: converted, schoolAverageGrade: avgGrade };
      } else {
        resultMap[id] = { schoolOriginal: 0, schoolConverted: 0, schoolAverageGrade: 0 };
      }
    });

    return resultMap;
  } catch (err) {
    console.error('batchCalculateStudentSchoolScores error:', err);
    return {};
  }
}

/**
 * 추천 선발 세션 목록 조회
 */
export async function getRecommendationSessions(): Promise<RecommendationSession[]> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', SESSIONS_STORE_KEY)
      .maybeSingle();

    const sessions = (data?.value as RecommendationSession[]) || [];
    return Array.isArray(sessions) ? sessions : [];
  } catch (err) {
    console.error('getRecommendationSessions error:', err);
    return [];
  }
}

/**
 * 추천 선발 세션 생성 또는 수정 (성적 규칙 변경 시 후보자 성적 자동 재계산)
 */
export async function saveRecommendationSession(
  sessionData: Partial<RecommendationSession> & { id?: string; title: string }
): Promise<{ success: boolean; session?: RecommendationSession; error?: string }> {
  try {
    const supabase = createAdminClient();
    const sessions = await getRecommendationSessions();
    const now = new Date().toISOString();

    let targetSession: RecommendationSession;

    const gradeRules: GradeExclusionRules = {
      ...DEFAULT_GRADE_RULES,
      ...(sessionData.gradeRules || {})
    };

    if (sessionData.id) {
      const idx = sessions.findIndex(s => s.id === sessionData.id);
      if (idx === -1) {
        return { success: false, error: '수정할 세션을 찾을 수 없습니다.' };
      }
      targetSession = {
        ...sessions[idx],
        title: sessionData.title.trim(),
        targetGrade: sessionData.targetGrade || sessions[idx].targetGrade || 3,
        recommendationQuota: sessionData.recommendationQuota || sessions[idx].recommendationQuota || 5,
        description: sessionData.description !== undefined ? sessionData.description : sessions[idx].description,
        gradeRules,
        updatedAt: now,
      };

      // 규칙이 변경되었을 수 있으므로 기존 등록된 후보자들의 성적(30점) 자동 재산출
      const studentIds = Object.keys(targetSession.candidates || {});
      if (studentIds.length > 0) {
        const recomputedScores = await batchCalculateStudentSchoolScores(studentIds, gradeRules);
        studentIds.forEach(id => {
          const cand = targetSession.candidates[id];
          if (!cand) return;
          const score = recomputedScores[id];
          if (score) {
            cand.schoolAverageGrade = score.schoolAverageGrade;
            cand.schoolScoreOriginal = score.schoolOriginal;
            cand.schoolScoreConverted = score.schoolConverted;
            const certConv = cand.certScoreConverted || 0;
            const ncsVal = cand.ncsScore || 0;
            const intVal = cand.interviewScore || 0;
            cand.totalScore = parseFloat((ncsVal + score.schoolConverted + certConv + intVal).toFixed(2));
          }
        });
      }

      sessions[idx] = targetSession;
    } else {
      targetSession = {
        id: `rec-session-${Date.now()}`,
        title: sessionData.title.trim(),
        targetGrade: sessionData.targetGrade || 3,
        recommendationQuota: sessionData.recommendationQuota || 5,
        description: sessionData.description || '',
        gradeRules,
        createdAt: now,
        updatedAt: now,
        candidates: {}
      };
      sessions.unshift(targetSession);
    }

    const { error } = await supabase.from('system_settings').upsert({
      key: SESSIONS_STORE_KEY,
      value: sessions,
      updated_at: now
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/employment/recommendation');
    return { success: true, session: targetSession };
  } catch (err: any) {
    console.error('saveRecommendationSession error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 추천 선발 세션 삭제
 */
export async function deleteRecommendationSession(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();
    const sessions = await getRecommendationSessions();
    const filtered = sessions.filter(s => s.id !== sessionId);

    const { error } = await supabase.from('system_settings').upsert({
      key: SESSIONS_STORE_KEY,
      value: filtered,
      updated_at: new Date().toISOString()
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/employment/recommendation');
    return { success: true };
  } catch (err: any) {
    console.error('deleteRecommendationSession error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 대상 학년 학생 목록 조회 (후보자 추가 모달용)
 */
export async function getAvailableStudentsForRecommendation(targetGrade: number = 3) {
  try {
    const supabase = createAdminClient();
    const settings = await getSystemSettings();
    const baseYear = settings.baseYear || 2026;
    const targetGradYear = baseYear + (4 - targetGrade);

    const { data: students, error } = await supabase
      .from('students')
      .select('id, student_name, student_number, class_info, major, graduation_year')
      .eq('graduation_year', targetGradYear)
      .order('major', { ascending: true })
      .order('class_info', { ascending: true })
      .order('student_number', { ascending: true });

    if (error) {
      console.error('getAvailableStudents error:', error);
      return [];
    }

    return students || [];
  } catch (err) {
    console.error('getAvailableStudents error:', err);
    return [];
  }
}

/**
 * 학생들의 기존 [성적(30점 만점, 규칙 적용)] 및 [옥저인재인증(30점 만점)] 점수 자동 계산 조회
 */
export async function fetchStudentBaseScores(
  studentIds: string[],
  targetGrade: number = 3,
  rules?: GradeExclusionRules
): Promise<Record<string, { schoolOriginal: number; schoolConverted: number; schoolAverageGrade: number; certOriginal: number; certConverted: number }>> {
  try {
    const settings = await getSystemSettings();
    const baseYear = settings.baseYear || 2026;

    // 1. 성적 점수: 공고별 제외 규칙을 적용하여 계산
    const schoolScores = await batchCalculateStudentSchoolScores(studentIds, rules);

    // 2. 옥저인재인증점수(100점 만점) 조회 (getCachedCertificationSummaryList)
    const certList = await getCachedCertificationSummaryList(targetGrade, baseYear);
    const certMap = new Map<string, number>();
    certList.forEach(c => certMap.set(c.studentId, c.totalScore));

    const result: Record<string, { schoolOriginal: number; schoolConverted: number; schoolAverageGrade: number; certOriginal: number; certConverted: number }> = {};

    studentIds.forEach(id => {
      const sScore = schoolScores[id] || { schoolOriginal: 0, schoolConverted: 0, schoolAverageGrade: 0 };
      const certOriginal = certMap.has(id) ? Number(certMap.get(id)) : 0;
      const certConverted = parseFloat((certOriginal * 0.3).toFixed(2));

      result[id] = {
        schoolOriginal: sScore.schoolOriginal,
        schoolConverted: sScore.schoolConverted,
        schoolAverageGrade: sScore.schoolAverageGrade,
        certOriginal,
        certConverted
      };
    });

    return result;
  } catch (err) {
    console.error('fetchStudentBaseScores error:', err);
    return {};
  }
}

/**
 * 세션에 희망 학생 추가 (제외 규칙이 적용된 성적 30점 및 옥저인증 30점 자동 환산)
 */
export async function addCandidatesToSession(
  sessionId: string,
  studentIds: string[]
): Promise<{ success: boolean; session?: RecommendationSession; error?: string }> {
  try {
    const supabase = createAdminClient();
    const sessions = await getRecommendationSessions();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx === -1) {
      return { success: false, error: '세션을 찾을 수 없습니다.' };
    }

    const session = sessions[idx];
    const targetGrade = session.targetGrade || 3;
    const rules = session.gradeRules || DEFAULT_GRADE_RULES;

    // 1. 학생 기본 정보 조회
    const { data: students, error: stErr } = await supabase
      .from('students')
      .select('id, student_name, student_number, class_info, major, graduation_year')
      .in('id', studentIds);

    if (stErr || !students) {
      return { success: false, error: stErr?.message || '학생 정보를 불러오지 못했습니다.' };
    }

    // 2. 학생 성적(규칙 적용) 및 옥저인재인증 점수 자동 연동
    const baseScores = await fetchStudentBaseScores(studentIds, targetGrade, rules);
    const now = new Date().toISOString();

    students.forEach(st => {
      const existing = session.candidates[st.id];
      const score = baseScores[st.id] || { schoolOriginal: 0, schoolConverted: 0, schoolAverageGrade: 0, certOriginal: 0, certConverted: 0 };

      const ncsScore = existing?.ncsScore ?? null;
      const interviewScore = existing?.interviewScore ?? null;

      // 종합점수 = NCS(30) + 성적환산(30) + 옥저인증환산(30) + 면접(10)
      const totalScore = (ncsScore !== null || interviewScore !== null || score.schoolConverted > 0 || score.certConverted > 0)
        ? parseFloat(((ncsScore || 0) + score.schoolConverted + score.certConverted + (interviewScore || 0)).toFixed(2))
        : null;

      session.candidates[st.id] = {
        studentId: st.id,
        studentName: st.student_name,
        studentNumber: st.student_number,
        major: st.major,
        classInfo: st.class_info,
        graduationYear: st.graduation_year,
        ncsScore,
        interviewScore,
        schoolAverageGrade: score.schoolAverageGrade,
        schoolScoreOriginal: score.schoolOriginal,
        schoolScoreConverted: score.schoolConverted,
        certScoreOriginal: score.certOriginal,
        certScoreConverted: score.certConverted,
        totalScore,
        remarks: existing?.remarks || '',
        addedAt: existing?.addedAt || now
      };
    });

    session.updatedAt = now;
    sessions[idx] = session;

    const { error } = await supabase.from('system_settings').upsert({
      key: SESSIONS_STORE_KEY,
      value: sessions,
      updated_at: now
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/employment/recommendation');
    return { success: true, session };
  } catch (err: any) {
    console.error('addCandidatesToSession error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 후보 학생 제거
 */
export async function removeCandidateFromSession(
  sessionId: string,
  studentId: string
): Promise<{ success: boolean; session?: RecommendationSession; error?: string }> {
  try {
    const supabase = createAdminClient();
    const sessions = await getRecommendationSessions();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx === -1) {
      return { success: false, error: '세션을 찾을 수 없습니다.' };
    }

    const session = sessions[idx];
    delete session.candidates[studentId];
    session.updatedAt = new Date().toISOString();
    sessions[idx] = session;

    const { error } = await supabase.from('system_settings').upsert({
      key: SESSIONS_STORE_KEY,
      value: sessions,
      updated_at: session.updatedAt
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/employment/recommendation');
    return { success: true, session };
  } catch (err: any) {
    console.error('removeCandidateFromSession error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 여러 학생 점수 일괄 저장
 */
export async function bulkSaveCandidateScores(
  sessionId: string,
  updates: { studentId: string; ncsScore?: number | null; interviewScore?: number | null; remarks?: string }[]
): Promise<{ success: boolean; session?: RecommendationSession; error?: string }> {
  try {
    const supabase = createAdminClient();
    const sessions = await getRecommendationSessions();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx === -1) {
      return { success: false, error: '세션을 찾을 수 없습니다.' };
    }

    const session = sessions[idx];

    updates.forEach(u => {
      const cand = session.candidates[u.studentId];
      if (!cand) return;

      if (u.ncsScore !== undefined) {
        cand.ncsScore = u.ncsScore !== null ? Math.min(30, Math.max(0, parseFloat(Number(u.ncsScore).toFixed(2)))) : null;
      }
      if (u.interviewScore !== undefined) {
        cand.interviewScore = u.interviewScore !== null ? Math.min(10, Math.max(0, parseFloat(Number(u.interviewScore).toFixed(2)))) : null;
      }
      if (u.remarks !== undefined) {
        cand.remarks = u.remarks;
      }

      const schoolConv = cand.schoolScoreConverted || 0;
      const certConv = cand.certScoreConverted || 0;
      const ncsVal = cand.ncsScore || 0;
      const intVal = cand.interviewScore || 0;

      cand.totalScore = parseFloat((ncsVal + schoolConv + certConv + intVal).toFixed(2));
    });

    session.updatedAt = new Date().toISOString();
    sessions[idx] = session;

    const { error } = await supabase.from('system_settings').upsert({
      key: SESSIONS_STORE_KEY,
      value: sessions,
      updated_at: session.updatedAt
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/employment/recommendation');
    return { success: true, session };
  } catch (err: any) {
    console.error('bulkSaveCandidateScores error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 세션의 모든 후보자 성적 점수 재계산
 */
export async function recalculateSessionScoresAction(
  sessionId: string
): Promise<{ success: boolean; session?: RecommendationSession; error?: string }> {
  try {
    const supabase = createAdminClient();
    const sessions = await getRecommendationSessions();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx === -1) {
      return { success: false, error: '세션을 찾을 수 없습니다.' };
    }

    const session = sessions[idx];
    const rules = session.gradeRules || DEFAULT_GRADE_RULES;
    const studentIds = Object.keys(session.candidates || {});

    if (studentIds.length > 0) {
      const recomputed = await batchCalculateStudentSchoolScores(studentIds, rules);
      studentIds.forEach(id => {
        const cand = session.candidates[id];
        if (!cand) return;
        const score = recomputed[id];
        if (score) {
          cand.schoolAverageGrade = score.schoolAverageGrade;
          cand.schoolScoreOriginal = score.schoolOriginal;
          cand.schoolScoreConverted = score.schoolConverted;
          const certConv = cand.certScoreConverted || 0;
          const ncsVal = cand.ncsScore || 0;
          const intVal = cand.interviewScore || 0;
          cand.totalScore = parseFloat((ncsVal + score.schoolConverted + certConv + intVal).toFixed(2));
        }
      });
    }

    session.updatedAt = new Date().toISOString();
    sessions[idx] = session;

    const { error } = await supabase.from('system_settings').upsert({
      key: SESSIONS_STORE_KEY,
      value: sessions,
      updated_at: session.updatedAt
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/employment/recommendation');
    return { success: true, session };
  } catch (err: any) {
    console.error('recalculateSessionScoresAction error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 공식 심사 결과표 엑셀 내보내기 (.xlsx base64)
 */
export async function exportRecommendationExcelAction(
  sessionId: string
): Promise<{ success: boolean; base64?: string; fileName?: string; error?: string }> {
  try {
    const sessions = await getRecommendationSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      return { success: false, error: '세션을 찾을 수 없습니다.' };
    }

    const candidates = Object.values(session.candidates).sort((a, b) => {
      const tA = a.totalScore ?? -1;
      const tB = b.totalScore ?? -1;
      if (tB !== tA) return tB - tA;
      return (b.ncsScore || 0) - (a.ncsScore || 0);
    });

    const quota = session.recommendationQuota || 5;
    const rules = session.gradeRules || DEFAULT_GRADE_RULES;
    const scaleName = rules.gradeScale === '5_scale' ? '5등급제' : '9등급제';

    // 워크시트 데이터 생성
    const headers = [
      ['순위', '선발상태', '성명', '학과', '반', '번호', '평균등급', '교과성적환산 (30점)', 'NCS점수 (30점)', '옥저인재인증환산 (30점)', '면접점수 (10점)', '종합점수 (100점)', '비고']
    ];

    const rows = candidates.map((c, idx) => {
      const rank = idx + 1;
      const status = rank <= quota ? '추천 확정' : '후보';
      return [
        rank,
        status,
        c.studentName,
        c.major,
        c.classInfo,
        c.studentNumber,
        c.schoolAverageGrade ? `${c.schoolAverageGrade.toFixed(2)}등급` : '-',
        c.schoolScoreConverted !== null ? c.schoolScoreConverted : '-',
        c.ncsScore !== null ? c.ncsScore : '-',
        c.certScoreConverted !== null ? c.certScoreConverted : '-',
        c.interviewScore !== null ? c.interviewScore : '-',
        c.totalScore !== null ? c.totalScore : '-',
        c.remarks || ''
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([
      [`대구공업고등학교 학교장 추천 대상자 심사 평가 결과표`],
      [`선발 공고: ${session.title}`],
      [`추천 선발 정원: ${quota}명 (총 지원 희망자 ${candidates.length}명) | 성적 기준: ${scaleName} (${rules.preferRankGrade ? '석차등급 우선' : '성취도 환산'}) | 총 100점 만점`],
      [],
      ...headers,
      ...rows
    ]);

    // 열 너비 설정
    ws['!cols'] = [
      { wch: 6 },  // 순위
      { wch: 12 }, // 선발상태
      { wch: 10 }, // 성명
      { wch: 16 }, // 학과
      { wch: 6 },  // 반
      { wch: 6 },  // 번호
      { wch: 12 }, // 평균등급
      { wch: 18 }, // 교과성적
      { wch: 14 }, // NCS
      { wch: 20 }, // 옥저인증
      { wch: 14 }, // 면접
      { wch: 16 }, // 종합점수
      { wch: 20 }  // 비고
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '학교장추천심사결과');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    const fileName = `${session.title.replace(/[\/\\?%*:|"<>]/g, '_')}_심사결과.xlsx`;

    return { success: true, base64: wbout, fileName };
  } catch (err: any) {
    console.error('exportRecommendationExcelAction error:', err);
    return { success: false, error: err.message };
  }
}
