'use server';

// ==============================================================================
// src/app/(dashboard)/employment/grade/actions.ts
// 내신등급 계산기 Server Actions
// (사용자 맞춤형 조건 설정, 나만의 프리셋 저장/관리, 학생별 성적 데이터 제공)
// ==============================================================================

import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { calculateKaiGrades } from '@/lib/employment/kai-calculator';
import { generateKaiExcelBase64, generateKaiExcelBuffer } from '@/lib/employment/kai-excel-generator';

// 🎯 내신등급 계산 세부 조건 인터페이스
export interface GpaCriteria {
  kemCutoff: number | null; // 국·영·수 평균 등급 기준 (예: 3.0, null=제한없음)
  allCutoff: number | null; // 전과목 평균 등급 기준 (예: 3.0, null=제한없음)
  conditionLogic: 'AND' | 'OR'; // AND: 둘 다 만족, OR: 하나라도 만족
  selectedMajors: string[]; // 대상 학과 목록 (빈 배열 = 전체 학과)
  excludeArts: boolean; // 예체능 제외 (체육, 음악, 미술, 스포츠, 건강 등)
  excludeSecondLang: boolean; // 제2외국어 및 한문 제외
  excludePF: boolean; // P/F(이수/미이수) 과목 제외
  targetSemesters: 'five_semesters' | 'all_semesters'; // 5개 학기(1-1~3-1) vs 전체 학기
  gradeScale: '9_scale' | '5_scale'; // 9등급제(1,3,5,7,9) vs 5등급제(1,2,3,4,5)
  preferRankGrade: boolean; // 기존 석차등급 우선 적용 여부
}

// 🎯 프리셋 데이터 모델
export interface GpaCalculationPreset {
  id: string;
  name: string; // 예: "KAI 생산직 채용", "2026 현대차 추천"
  isSystemDefault?: boolean; // 시스템 기본 프리셋 여부 (삭제 불가)
  description?: string;
  criteria: GpaCriteria;
  createdAt: string;
  updatedAt: string;
}

export interface RawScoreItem {
  grade: number;
  semester: number;
  subject: string;
  credits: number | null;
  achievement: string | null;
  rank_grade: string | null;
}

export interface GradeStudentListItem {
  id: string;
  student_name: string;
  student_number: string;
  class_info: string;
  major: string;
  graduation_year: number;
  rawScores: RawScoreItem[];
}

const PRESETS_STORE_KEY = 'custom_gpa_presets';

// 시스템 기본 추천 프리셋 목록
const SYSTEM_DEFAULT_PRESETS: GpaCalculationPreset[] = [
  {
    id: 'preset-kai-default',
    name: 'KAI 생산직 채용',
    isSystemDefault: true,
    description: '국영수 3.0 & 전과목 3.0 이내, 지원가능 3개 학과, 예체능/외국어 제외',
    criteria: {
      kemCutoff: 3.0,
      allCutoff: 3.0,
      conditionLogic: 'AND',
      selectedMajors: ['자동화기계과', '친환경자동차과', '스마트전기과'],
      excludeArts: true,
      excludeSecondLang: true,
      excludePF: true,
      targetSemesters: 'five_semesters',
      gradeScale: '9_scale',
      preferRankGrade: true,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'preset-public-enterprise',
    name: '공기업 / 지역인재 9급',
    isSystemDefault: true,
    description: '전과목 2.5등급 이내, 전체 학과 대상, 예체능/외국어 제외',
    criteria: {
      kemCutoff: null,
      allCutoff: 2.5,
      conditionLogic: 'AND',
      selectedMajors: [],
      excludeArts: true,
      excludeSecondLang: true,
      excludePF: true,
      targetSemesters: 'five_semesters',
      gradeScale: '9_scale',
      preferRankGrade: true,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'preset-large-corp',
    name: '대기업 생산직 (일반)',
    isSystemDefault: true,
    description: '전과목 3.0등급 이내, 전체 학과 대상, 예체능 제외',
    criteria: {
      kemCutoff: null,
      allCutoff: 3.0,
      conditionLogic: 'AND',
      selectedMajors: [],
      excludeArts: true,
      excludeSecondLang: false,
      excludePF: true,
      targetSemesters: 'five_semesters',
      gradeScale: '9_scale',
      preferRankGrade: true,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'preset-school-all',
    name: '학교 전체 전과목 랭킹',
    isSystemDefault: true,
    description: '등급 제한 없음, 전체 학과, 전 학기, 전 과목 반영',
    criteria: {
      kemCutoff: null,
      allCutoff: null,
      conditionLogic: 'AND',
      selectedMajors: [],
      excludeArts: false,
      excludeSecondLang: false,
      excludePF: false,
      targetSemesters: 'all_semesters',
      gradeScale: '9_scale',
      preferRankGrade: true,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

/**
 * 저장된 프리셋 목록 조회 (시스템 기본 프리셋 + 사용자 정의 프리셋, unstable_cache 적용)
 */
export const getGpaPresets = unstable_cache(
  async (): Promise<GpaCalculationPreset[]> => {
    try {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', PRESETS_STORE_KEY)
        .maybeSingle();

      const userPresets = (data?.value as GpaCalculationPreset[]) || [];
      const validUserPresets = Array.isArray(userPresets)
        ? userPresets.filter(p => !p.isSystemDefault)
        : [];

      return [...SYSTEM_DEFAULT_PRESETS, ...validUserPresets];
    } catch (err) {
      console.error('getGpaPresets error:', err);
      return SYSTEM_DEFAULT_PRESETS;
    }
  },
  ['gpa_presets_cache'],
  {
    tags: ['gpa_presets_cache'],
    revalidate: 86400,
  }
);

/**
 * 프리셋 저장 (신규 등록 또는 기존 사용자 프리셋 수정)
 */
export async function saveGpaPreset(
  presetData: Partial<GpaCalculationPreset> & { name: string; criteria: GpaCriteria }
): Promise<{ success: boolean; preset?: GpaCalculationPreset; error?: string }> {
  try {
    const supabase = createAdminClient();
    const existingPresets = await getGpaPresets();
    const now = new Date().toISOString();

    let targetPreset: GpaCalculationPreset;
    const userOnlyPresets = existingPresets.filter(p => !p.isSystemDefault);

    if (presetData.id && !presetData.id.startsWith('preset-kai') && !presetData.id.startsWith('preset-public') && !presetData.id.startsWith('preset-large') && !presetData.id.startsWith('preset-school')) {
      // 기존 사용자 프리셋 수정
      const idx = userOnlyPresets.findIndex(p => p.id === presetData.id);
      if (idx !== -1) {
        targetPreset = {
          ...userOnlyPresets[idx],
          name: presetData.name.trim(),
          description: presetData.description || '',
          criteria: presetData.criteria,
          updatedAt: now,
        };
        userOnlyPresets[idx] = targetPreset;
      } else {
        targetPreset = {
          id: `preset-user-${Date.now()}`,
          name: presetData.name.trim(),
          isSystemDefault: false,
          description: presetData.description || '',
          criteria: presetData.criteria,
          createdAt: now,
          updatedAt: now,
        };
        userOnlyPresets.push(targetPreset);
      }
    } else {
      // 신규 프리셋 등록
      targetPreset = {
        id: `preset-user-${Date.now()}`,
        name: presetData.name.trim(),
        isSystemDefault: false,
        description: presetData.description || '',
        criteria: presetData.criteria,
        createdAt: now,
        updatedAt: now,
      };
      userOnlyPresets.push(targetPreset);
    }

    const { error } = await supabase.from('system_settings').upsert({
      key: PRESETS_STORE_KEY,
      value: userOnlyPresets,
      updated_at: now,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateTag('gpa_presets_cache');
    revalidatePath('/employment/grade');
    return { success: true, preset: targetPreset };
  } catch (err: any) {
    console.error('saveGpaPreset error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 사용자 정의 프리셋 삭제 (시스템 기본 프리셋은 삭제 불가)
 */
export async function deleteGpaPreset(
  presetId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (SYSTEM_DEFAULT_PRESETS.some(p => p.id === presetId)) {
      return { success: false, error: '시스템 기본 프리셋은 삭제할 수 없습니다.' };
    }

    const supabase = createAdminClient();
    const existingPresets = await getGpaPresets();
    const filtered = existingPresets.filter(p => !p.isSystemDefault && p.id !== presetId);

    const { error } = await supabase.from('system_settings').upsert({
      key: PRESETS_STORE_KEY,
      value: filtered,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateTag('gpa_presets_cache');
    revalidatePath('/employment/grade');
    return { success: true };
  } catch (err: any) {
    console.error('deleteGpaPreset error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 3학년 학생 목록 및 성적 원본 데이터 조회 (unstable_cache 적용)
 */
export const getGradeStudents = unstable_cache(
  async (
    gradYear?: number
  ): Promise<{ success: boolean; data: GradeStudentListItem[]; error?: string }> => {
    try {
      const supabase = createAdminClient();

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

      // 학생들의 성적 데이터 청크(18명 최적 단위) 조회
      const studentIds = students.map(s => s.id);
      const chunkSize = 18;
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
      const scoresByStudent: Record<string, RawScoreItem[]> = {};

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

      const studentsWithScores: GradeStudentListItem[] = students.map(st => ({
        ...st,
        rawScores: scoresByStudent[st.id] || [],
      }));

      return { success: true, data: studentsWithScores };
    } catch (err: any) {
      console.error('getGradeStudents error:', err);
      return { success: false, data: [], error: err.message };
    }
  },
  ['employment_grade_students_cache'],
  {
    tags: ['students', 'student_scores', 'employment_grade_cache'],
    revalidate: 86400, // 24시간 캐시 (성적 수정 시 revalidateTag로 자동 갱신)
  }
);

/**
 * 공식 내신등급 계산 결과표 엑셀 내보내기 (.xlsx base64)
 */
export async function downloadGradeExcelAction(
  criteriaName: string,
  rows: {
    rank: number;
    studentName: string;
    major: string;
    classInfo: string;
    studentNumber: string;
    kemGrade: number | null;
    allGrade: number | null;
    statusText: string;
    totalCredits: number;
  }[]
): Promise<{ success: boolean; base64?: string; fileName?: string; error?: string }> {
  try {
    const headers = [
      ['순위', '선발 상태', '성명', '학과', '반', '번호', '국영수 평균등급', '전과목 평균등급', '이수단위 합계']
    ];

    const excelRows = rows.map(r => [
      r.rank,
      r.statusText,
      r.studentName,
      r.major,
      r.classInfo,
      r.studentNumber,
      r.kemGrade !== null ? `${r.kemGrade.toFixed(2)}등급` : '-',
      r.allGrade !== null ? `${r.allGrade.toFixed(2)}등급` : '-',
      r.totalCredits,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([
      [`대구공업고등학교 학생 내신등급 계산 및 지원자 선별표`],
      [`적용 기준/프리셋: ${criteriaName} | 총 ${rows.length}명 심사`],
      [`출력 일시: ${new Date().toLocaleDateString('ko-KR')}`],
      [],
      ...headers,
      ...excelRows,
    ]);

    ws['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 10 },
      { wch: 16 },
      { wch: 6 },
      { wch: 6 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '내신등급결과표');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    const fileName = `대구공고_내신등급계산_${criteriaName.replace(/[\/\\?%*:|"<>]/g, '_')}.xlsx`;

    return { success: true, base64: wbout, fileName };
  } catch (err: any) {
    console.error('downloadGradeExcelAction error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 개별 학생 KAI 공식 엑셀 서식 파일(.xlsx) Base64 다운로드
 */
export async function downloadStudentKaiExcelAction(
  studentId: string
): Promise<{ success: boolean; base64?: string; fileName?: string; error?: string }> {
  try {
    const supabase = createAdminClient();

    const { data: student, error: stErr } = await supabase
      .from('students')
      .select('id, student_name, student_number, class_info, major, graduation_year')
      .eq('id', studentId)
      .single();

    if (stErr || !student) {
      return { success: false, error: '학생 정보를 찾을 수 없습니다.' };
    }

    const { data: scores, error: scErr } = await supabase
      .from('student_scores')
      .select('grade, semester, subject, credits, achievement, rank_grade')
      .eq('student_id', studentId)
      .order('grade', { ascending: true })
      .order('semester', { ascending: true });

    if (scErr || !scores || scores.length === 0) {
      return { success: false, error: '학생의 성적 데이터가 없습니다.' };
    }

    const allResult = calculateKaiGrades(student, scores, 'all');
    const kemResult = calculateKaiGrades(student, scores, 'kem');

    const base64 = await generateKaiExcelBase64(allResult, kemResult);
    const cleanClass = student.class_info ? student.class_info.replace(/반$/, '') : '1';
    const fileName = `한국항공우주산업_고교내신등급계산표_3학년${cleanClass}반_${student.student_number}번_${student.student_name}.xlsx`;

    return { success: true, base64, fileName };
  } catch (err: any) {
    console.error('downloadStudentKaiExcelAction error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 여러 학생들의 KAI 공식 엑셀 파일들을 일괄 압축(.zip)하여 Base64 다운로드
 */
export async function downloadBatchKaiExcelZipAction(
  studentIds: string[]
): Promise<{ success: boolean; base64?: string; fileName?: string; count?: number; error?: string }> {
  try {
    if (!studentIds || studentIds.length === 0) {
      return { success: false, error: '선택된 학생이 없습니다.' };
    }

    const supabase = createAdminClient();

    const { data: students, error: stErr } = await supabase
      .from('students')
      .select('id, student_name, student_number, class_info, major, graduation_year')
      .in('id', studentIds);

    if (stErr || !students || students.length === 0) {
      return { success: false, error: '학생 정보를 불러오지 못했습니다.' };
    }

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
        .order('grade', { ascending: true })
        .order('semester', { ascending: true })
    );

    const scoreResults = await Promise.all(scorePromises);
    const scoresByStudent: Record<string, any[]> = {};
    scoreResults.forEach(r => {
      (r.data || []).forEach((sc: any) => {
        if (!scoresByStudent[sc.student_id]) scoresByStudent[sc.student_id] = [];
        scoresByStudent[sc.student_id].push(sc);
      });
    });

    const zip = new JSZip();
    let generatedCount = 0;

    for (const st of students) {
      const sList = scoresByStudent[st.id] || [];
      if (sList.length === 0) continue;

      const allResult = calculateKaiGrades(st, sList, 'all');
      const kemResult = calculateKaiGrades(st, sList, 'kem');

      const buf = await generateKaiExcelBuffer(allResult, kemResult);
      const cleanClass = st.class_info ? st.class_info.replace(/반$/, '') : '1';
      const fName = `한국항공우주산업_고교내신등급계산표_3학년${cleanClass}반_${st.student_number}번_${st.student_name}.xlsx`;

      zip.file(fName, buf);
      generatedCount++;
    }

    if (generatedCount === 0) {
      return { success: false, error: '생성할 수 있는 성적 데이터가 없습니다.' };
    }

    const zipBase64 = await zip.generateAsync({ type: 'base64' });
    const zipFileName = `대구공고_KAI고교내신등급계산표_총${generatedCount}명.zip`;

    return { success: true, base64: zipBase64, fileName: zipFileName, count: generatedCount };
  } catch (err: any) {
    console.error('downloadBatchKaiExcelZipAction error:', err);
    return { success: false, error: err.message };
  }
}
