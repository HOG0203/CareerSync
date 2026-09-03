'use server';

// ==============================================================================
// src/app/(dashboard)/employment/kai-grade/actions.ts
// 한국항공우주산업(주) KAI 고교 내신등급 계산 Server Actions
// ==============================================================================

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { calculateKaiGrades, KaiCalculationResult, RawScoreRecord } from '@/lib/employment/kai-calculator';
import { generateKaiExcelBase64 } from '@/lib/employment/kai-excel-generator';

export interface KaiStudentListItem {
  id: string;
  student_name: string;
  student_number: string;
  class_info: string;
  major: string;
  graduation_year: number;
  allGrade?: number | null;
  kemGrade?: number | null;
  allCredits?: number;
  kemCredits?: number;
  hasScores?: boolean;
}

export interface KaiStudentGradeResponse {
  success: boolean;
  error?: string;
  student?: KaiStudentListItem;
  allResult?: KaiCalculationResult;
  kemResult?: KaiCalculationResult;
  rawScores?: RawScoreRecord[];
}

/**
 * 3학년 학생 목록 조회 및 학생별 전과목/국영수 KAI 최종 등급 사전 산출
 */
export async function getKaiStudents(gradYear?: number): Promise<{ success: boolean; data: KaiStudentListItem[]; error?: string }> {
  try {
    const supabase = createAdminClient();

    // 1. 기본 학년도 설정 조회
    let targetYear = gradYear;
    if (!targetYear) {
      const { data: setting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'general')
        .maybeSingle();
      const baseYear = setting?.value?.baseYear ? Number(setting.value.baseYear) : 2026;
      targetYear = baseYear + 1; // 2026년 기준 3학년은 2027년 2월 졸업
    }

    const { data: students, error } = await supabase
      .from('students')
      .select('id, student_name, student_number, class_info, major, graduation_year')
      .eq('graduation_year', targetYear)
      .order('major', { ascending: true })
      .order('class_info', { ascending: true })
      .order('student_number', { ascending: true });

    if (error || !students) {
      return { success: false, data: [], error: error?.message || '학생 목록을 불러올 수 없습니다.' };
    }

    // 2. 학생들의 5개 학기 성적 데이터 일괄 조회
    // 주의: Supabase PostgREST는 단일 쿼리 최대 1,000행 제한이 있으므로, 학생 1인당 약 50개 성적을 고려하여 청크 크기를 15명(~750행)으로 설정
    const studentIds = students.map(s => s.id);
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
    const scoresByStudent: Record<string, RawScoreRecord[]> = {};

    scoreResults.forEach(r => {
      (r.data || []).forEach((sc: any) => {
        if (!scoresByStudent[sc.student_id]) scoresByStudent[sc.student_id] = [];
        scoresByStudent[sc.student_id].push({
          grade: sc.grade,
          semester: sc.semester,
          subject: sc.subject,
          credits: sc.credits,
          achievement: sc.achievement,
          rank_grade: sc.rank_grade,
        });
      });
    });

    // 3. 학생별 KAI 전과목 및 국영수 등급 즉시 산출
    const studentsWithGrades: KaiStudentListItem[] = students.map(st => {
      const sList = scoresByStudent[st.id] || [];
      if (sList.length === 0) {
        return {
          ...st,
          allGrade: null,
          kemGrade: null,
          allCredits: 0,
          kemCredits: 0,
          hasScores: false,
        };
      }

      const allRes = calculateKaiGrades(st, sList, 'all');
      const kemRes = calculateKaiGrades(st, sList, 'kem');

      return {
        ...st,
        allGrade: allRes.grandTotalCredits > 0 ? allRes.finalGrade : null,
        kemGrade: kemRes.grandTotalCredits > 0 ? kemRes.finalGrade : null,
        allCredits: allRes.grandTotalCredits,
        kemCredits: kemRes.grandTotalCredits,
        hasScores: allRes.grandTotalCredits > 0,
      };
    });

    return { success: true, data: studentsWithGrades };
  } catch (err: any) {
    console.error('getKaiStudents error:', err);
    return { success: false, data: [], error: err.message };
  }
}

/**
 * 특정 학생의 5개 학기 성적 조회 및 KAI 등급(전과목/국영수) 자동 계산
 */
export async function getKaiGradeDataForStudent(
  studentId: string,
  manualExcludedKeys: string[] = []
): Promise<KaiStudentGradeResponse> {
  try {
    const supabase = createAdminClient();

    // 1. 학생 기본 정보 조회
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('id, student_name, student_number, class_info, major, graduation_year')
      .eq('id', studentId)
      .single();

    if (studentErr || !student) {
      return { success: false, error: '학생 정보를 찾을 수 없습니다.' };
    }

    // 2. 학생의 1~3학년 성적 데이터 전체 조회
    const { data: scores, error: scoresErr } = await supabase
      .from('student_scores')
      .select('grade, semester, subject, credits, achievement, rank_grade')
      .eq('student_id', studentId)
      .order('grade', { ascending: true })
      .order('semester', { ascending: true });

    if (scoresErr) {
      return { success: false, error: `성적 조회 실패: ${scoresErr.message}` };
    }

    const rawScores: RawScoreRecord[] = (scores || []).map(s => ({
      grade: s.grade,
      semester: s.semester,
      subject: s.subject,
      credits: s.credits,
      achievement: s.achievement,
      rank_grade: s.rank_grade,
    }));

    const excludedSet = new Set(manualExcludedKeys);

    // 3. 전과목 평균 계산
    const allResult = calculateKaiGrades(student, rawScores, 'all', excludedSet);

    // 4. 국영수 평균 계산
    const kemResult = calculateKaiGrades(student, rawScores, 'kem', excludedSet);

    return {
      success: true,
      student,
      allResult,
      kemResult,
      rawScores,
    };
  } catch (err: any) {
    console.error('getKaiGradeDataForStudent error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 학생별 KAI 공식 엑셀 파일(.xlsx) Base64 생성 및 다운로드 데이터 반환
 */
export async function downloadKaiExcelAction(
  studentId: string,
  manualExcludedKeys: string[] = []
): Promise<{ success: boolean; base64?: string; fileName?: string; error?: string }> {
  try {
    const res = await getKaiGradeDataForStudent(studentId, manualExcludedKeys);
    if (!res.success || !res.allResult || !res.kemResult || !res.student) {
      return { success: false, error: res.error || '성적 데이터를 산출할 수 없습니다.' };
    }

    const base64 = await generateKaiExcelBase64(res.allResult, res.kemResult);
    const cleanClass = res.student.class_info ? res.student.class_info.replace(/반$/, '') : '1';
    const fileName = `한국항공우주산업_고교내신등급계산표_3학년${cleanClass}반_${res.student.student_number}번_${res.student.student_name}.xlsx`;

    return {
      success: true,
      base64,
      fileName,
    };
  } catch (err: any) {
    console.error('downloadKaiExcelAction error:', err);
    return { success: false, error: err.message };
  }
}
