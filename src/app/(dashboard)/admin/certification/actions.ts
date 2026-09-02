'use server';

import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/data';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { 
  CertificationEvaluationData, 
  calculateStudentFullEvaluation, 
  FullStudentEvaluation,
  evaluateContestList,
  RecordAuditMeta
} from '@/lib/certification-calculator';
import { logAuditAction } from '@/lib/audit-logger';

const EVAL_SETTINGS_KEY = 'certification_evaluations_store';

// 평가 데이터 저장소 인메모리 캐시 (0ms 응답용, 5분 TTL)
let evalStoreMemoryCache: { data: Record<string, CertificationEvaluationData>; timestamp: number } | null = null;
const EVAL_STORE_CACHE_TTL_MS = 5 * 60 * 1000;

export async function clearEvaluationsStoreCache() {
  evalStoreMemoryCache = null;
}

/**
 * 평가 데이터 저장소 (Map: studentId -> CertificationEvaluationData) 조회 (초고속 인메모리 캐싱)
 */
export async function getEvaluationsStore(): Promise<Record<string, CertificationEvaluationData>> {
  const now = Date.now();
  if (evalStoreMemoryCache && (now - evalStoreMemoryCache.timestamp < EVAL_STORE_CACHE_TTL_MS)) {
    return evalStoreMemoryCache.data;
  }

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', EVAL_SETTINGS_KEY)
      .maybeSingle();

    const store = (data?.value as Record<string, CertificationEvaluationData>) || {};
    evalStoreMemoryCache = { data: store, timestamp: now };
    return store;
  } catch (e) {
    console.error('Error in getEvaluationsStore:', e);
    return {};
  }
}

// 옥저인재인증제 종합평가 서버 인메모리 캐시 (0ms 초고속 응답용, 5분 TTL)
const certSummaryMemoryCache: Record<number, { data: FullStudentEvaluation[]; timestamp: number }> = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분

export async function clearCertificationSummaryCache(gradeNum?: number) {
  evalStoreMemoryCache = null;
  if (gradeNum) {
    delete certSummaryMemoryCache[gradeNum];
  } else {
    Object.keys(certSummaryMemoryCache).forEach(k => delete certSummaryMemoryCache[Number(k)]);
  }
}

/**
 * 특정 학년의 전교생 옥저인재인증제 종합 평가 목록 조회 (1-Shot 완전 동시 병렬 쿼리 + 초고속 인메모리)
 */
export async function getCertificationSummaryList(gradeNum: number, preloadedBaseYear?: number): Promise<FullStudentEvaluation[]> {
  const now = Date.now();
  const cached = certSummaryMemoryCache[gradeNum];
  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  const supabase = createAdminClient();
  const baseYear = preloadedBaseYear || (await getSystemSettings()).baseYear;
  const targetGradYear = baseYear + (4 - gradeNum);

  // 1. [1-Shot 동시 병렬화] 학생 목록, 3개년 출결, 평가 스토어를 단 1번에 동시 병렬 패칭
  const [studentsRes, attendanceRes, evalStore] = await Promise.all([
    supabase
      .from('students')
      .select('id, student_name, student_number, major, class_info, graduation_year, certificates, career_course')
      .eq('graduation_year', targetGradYear)
      .order('major', { ascending: true })
      .order('class_info', { ascending: true })
      .order('student_number', { ascending: true }),
    supabase
      .from('student_attendance')
      .select('student_id, grade, absent_unexcused, late_unexcused, early_unexcused, out_unexcused, students!inner(graduation_year)')
      .eq('students.graduation_year', targetGradYear)
      .range(0, 5000),
    getEvaluationsStore()
  ]);

  const students = studentsRes.data;
  if (studentsRes.error || !students || students.length === 0) {
    return [];
  }

  // 출결 데이터를 student_id 별로 그룹화
  const attendanceMap: Record<string, any[]> = {};
  (attendanceRes.data || []).forEach(r => {
    if (!attendanceMap[r.student_id]) attendanceMap[r.student_id] = [];
    attendanceMap[r.student_id].push(r);
  });

  // 2. 각 학생별 100점 만점 종합 평가 산출
  const results: FullStudentEvaluation[] = students.map(s => {
    const studentEvalData = evalStore[s.id] || { student_id: s.id };

    return calculateStudentFullEvaluation({
      student: s,
      attendanceRecords: attendanceMap[s.id] || [],
      evalData: studentEvalData,
      baseYear
    });
  });

  // 서버 인메모리 캐시에 저장
  certSummaryMemoryCache[gradeNum] = { data: results, timestamp: now };

  return results;
}

/**
 * [캐싱 최적화] 학년별 옥저인재인증제 종합 평가 목록 Next.js 글로벌 영구 캐시 조회 (Vercel 전역 0.01초 공유)
 */
const certSummaryCacheMap = new Map<string, ReturnType<typeof unstable_cache>>();

export async function getCachedCertificationSummaryList(gradeNum: number, preloadedBaseYear?: number): Promise<FullStudentEvaluation[]> {
  const baseYear = preloadedBaseYear || 2026;
  const cacheKey = `${gradeNum}-${baseYear}`;
  if (!certSummaryCacheMap.has(cacheKey)) {
    const cachedFn = unstable_cache(
      async () => getCertificationSummaryList(gradeNum, baseYear),
      [`cert-summary-list-${cacheKey}`],
      {
        revalidate: 86400,
        tags: [`cert-eval-grade-${gradeNum}`, 'cert-eval', 'students']
      }
    );
    certSummaryCacheMap.set(cacheKey, cachedFn);
  }
  return certSummaryCacheMap.get(cacheKey)!();
}


/**
 * [캐싱 & 실시간 즉시 갱신 지원] 학년별 직기초 성적 및 석차 요약 목록 조회
 */
export async function getGradeSummaryListAction(gradeNum: number, forceFresh: boolean = false) {
  const settings = await getSystemSettings();
  const baseYear = settings.baseYear;
  const targetGradYear = baseYear + (4 - gradeNum);
  const { getCachedYearlyRankingsSummary, getYearlyRankingsSummary, clearYearlyRankingsCache } = await import('@/lib/data');

  if (forceFresh) {
    clearYearlyRankingsCache(targetGradYear);
    const summaryMap = await getYearlyRankingsSummary(targetGradYear, baseYear);
    return Object.values(summaryMap);
  }

  const summaryMap = await getCachedYearlyRankingsSummary(targetGradYear, baseYear);
  return Object.values(summaryMap);
}



/**
 * 개별 학생 단건 옥저인증제 종합 평가 산출
 */
export async function getStudentSingleEvaluation(studentId: string): Promise<FullStudentEvaluation | null> {
  const supabase = createAdminClient();
  const settings = await getSystemSettings();
  const baseYear = settings.baseYear;

  const [studentRes, attendanceRes, evalStore] = await Promise.all([
    supabase
      .from('students')
      .select('id, student_name, student_number, major, class_info, graduation_year, certificates, career_course, phone_number')
      .eq('id', studentId)

      .maybeSingle(),
    supabase
      .from('student_attendance')
      .select('student_id, grade, absent_unexcused, late_unexcused, early_unexcused, out_unexcused')
      .eq('student_id', studentId),
    getEvaluationsStore()
  ]);

  if (studentRes.error || !studentRes.data) {
    return null;
  }

  const student = studentRes.data;
  const attendanceRecords = attendanceRes.data || [];
  const evalData = evalStore[studentId] || { student_id: studentId };

  return calculateStudentFullEvaluation({
    student,
    attendanceRecords,
    evalData,
    baseYear
  });
}


/**
 * 개별 학생 인증 데이터 저장 / 수동 보정 (RBAC 적용: 관리자 또는 해당 학반 담임만 가능)
 */
export async function saveStudentEvaluationAction(
  studentId: string, 
  evalData: Partial<CertificationEvaluationData>,
  certificates?: string[]
) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { success: false, error: '로그인이 필요합니다.' };
  }

  const supabase = createAdminClient();

  // 1. 해당 학생의 학년/학반 확인
  const { data: student, error: sErr } = await supabase
    .from('students')
    .select('id, student_name, student_number, class_info, graduation_year')
    .eq('id', studentId)
    .single();

  if (sErr || !student) {
    return { success: false, error: '학생 정보를 찾을 수 없습니다.' };
  }

  const settings = await getSystemSettings();
  const currentGrade = Math.max(1, Math.min(3, settings.baseYear + 4 - student.graduation_year));

  // 2. 권한 검사 (관리자 또는 전체 교사)
  const isAdmin = profile.role === 'admin';
  const isTeacher = profile.role === 'teacher';

  if (!isAdmin && !isTeacher) {
    return { 
      success: false, 
      error: `해당 학생(${student.student_name})의 평가 데이터 수정 권한이 없습니다. (관리자 또는 교사만 가능)` 
    };
  }

  const auditMeta: RecordAuditMeta = {
    userId: profile.id,
    userName: profile.full_name || profile.username || '교사',
    role: profile.role,
    at: new Date().toISOString()
  };

  // 자격증 목록 변경 시 students 테이블 업데이트
  if (certificates !== undefined) {
    const { error: certErr } = await supabase
      .from('students')
      .update({ certificates })
      .eq('id', studentId);
    if (certErr) {
      console.error('Failed to update student certificates:', certErr);
    }
  }

  // 상세 실적 기반 스칼라 카운트 자동 동기화
  if (evalData.arts_contest_details) {
    const artsSports = evalData.arts_contest_details.arts_sports || {};
    evalData.arts_sports_semesters = Object.keys(artsSports).length;

    const contestList = evalData.arts_contest_details.contest_list || [];
    const contestRes = evaluateContestList(contestList);
    evalData.contest_award_count = contestRes.effectiveAwardCount;
    evalData.contest_participate_count = contestRes.effectivePartCount;
  }

  if (evalData.employment_details) {
    const emp = evalData.employment_details;
    if (emp.industry_edu_list) {
      evalData.industry_edu_count = emp.industry_edu_list.length;
    }
    if (emp.career_courses) {
      evalData.career_course_semesters = Object.keys(emp.career_courses).length;
    }
    if (emp.major_clubs) {
      evalData.major_club_years = Object.keys(emp.major_clubs).length;
    }
    if (emp.field_training) {
      evalData.field_training_completed = emp.field_training.completed;
    }
    if (emp.apprenticeship) {
      evalData.apprenticeship_semesters = Object.keys(emp.apprenticeship).length;
    }
    if (emp.employed_early) {
      evalData.employed_early = emp.employed_early.confirmed;
    }
  }

  // 3. 데이터 저장
  const currentStore = await getEvaluationsStore();
  const existing = currentStore[studentId] || { student_id: studentId };

  const updatedStudentData: CertificationEvaluationData = {
    ...existing,
    ...evalData,
    student_id: studentId,
    academic_year: settings.baseYear,
    updated_by: auditMeta,
    created_by: existing.created_by || auditMeta,
  };

  currentStore[studentId] = updatedStudentData;

  const { error: saveErr } = await supabase
    .from('system_settings')
    .upsert({
      key: EVAL_SETTINGS_KEY,
      value: currentStore,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });

  if (saveErr) {
    console.error('Failed to save evaluation data:', saveErr);
    return { success: false, error: '데이터 저장에 실패했습니다.' };
  }

  // 4. Audit Log 기록
  const actorName = profile.full_name || profile.username || '교사';
  await logAuditAction({
    actor_name: actorName,
    action_type: 'STUDENT_UPDATE',
    target_name: `[인증제 상세평가 수동수정] ${student.student_name} (${student.class_info}반 ${student.student_number}번)`,
    details: {
      student_id: studentId,
      student_name: student.student_name,
      updated_fields: Object.keys(evalData),
      updated_by_role: profile.role
    }
  });

  // 5. 캐시 무효화
  clearCertificationSummaryCache(currentGrade);
  revalidateTag(`cert-eval-grade-${currentGrade}`);
  revalidateTag('cert-eval');
  revalidateTag('cert-certificates');
  revalidatePath('/admin/certification');

  return { success: true };
}


/**
 * 엑셀 일괄 등록용 대량 데이터 업데이트 액션
 */
export async function batchImportEvaluationsAction(
  rows: Array<{
    studentNumber?: string;
    studentName: string;
    classInfo?: string;
    evalData: Partial<CertificationEvaluationData>;
  }>
) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { success: false, error: '로그인이 필요합니다.' };
  }

  if (profile.role !== 'admin' && profile.role !== 'teacher') {
    return { success: false, error: '일괄 등록 권한이 없습니다.' };
  }

  const supabase = createAdminClient();
  const settings = await getSystemSettings();

  // 전교생 목록 전체 확보 (1000건 초과 청크 페이징 조회)
  const allStudents: any[] = [];
  let sFrom = 0;
  let sHasMore = true;
  while (sHasMore) {
    const { data } = await supabase
      .from('students')
      .select('id, student_name, student_number, class_info, graduation_year')
      .range(sFrom, sFrom + 999);
    if (!data || data.length === 0) {
      sHasMore = false;
    } else {
      allStudents.push(...data);
      if (data.length < 1000) sHasMore = false;
      else sFrom += 1000;
    }
  }

  if (allStudents.length === 0) {
    return { success: false, error: '학생 데이터가 존재하지 않습니다.' };
  }

  const currentStore = await getEvaluationsStore();
  let updatedCount = 0;

  const cleanClass = (c: any) => String(c || '').replace(/[^0-9]/g, '');
  const cleanNum = (n: any) => String(n || '').replace(/[^0-9]/g, '');
  const cleanName = (n: any) => String(n || '').trim().replace(/\s+/g, '');

  for (const row of rows) {
    // 매칭
    const matched = allStudents.find(s => {
      const matchName = cleanName(s.student_name) === cleanName(row.studentName);
      const matchNum = row.studentNumber ? cleanNum(s.student_number) === cleanNum(row.studentNumber) : true;
      const matchClass = row.classInfo ? cleanClass(s.class_info) === cleanClass(row.classInfo) : true;
      return matchName && (matchNum || matchClass);
    });

    if (matched) {
      currentStore[matched.id] = {
        ...(currentStore[matched.id] || { student_id: matched.id }),
        ...row.evalData,
        student_id: matched.id,
        academic_year: settings.baseYear
      };
      updatedCount++;
    }
  }

  const { error: saveErr } = await supabase
    .from('system_settings')
    .upsert({
      key: EVAL_SETTINGS_KEY,
      value: currentStore,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });

  if (saveErr) {
    return { success: false, error: '일괄 저장 중 오류가 발생했습니다.' };
  }

  await logAuditAction({
    actor_name: profile.full_name || profile.username || '교사',
    action_type: 'STUDENT_BULK_UPDATE',
    target_name: `[인증제 평가] 엑셀 일괄 등록 (${updatedCount}명 반영)`,
    details: { count: updatedCount }
  });

  clearCertificationSummaryCache();
  revalidateTag('cert-eval');
  revalidatePath('/admin/certification');
  revalidatePath('/admin/certification/import');


  return { success: true, count: updatedCount };
}

export interface VolunteerImportStudentRow {
  grade: number;
  classInfo: string;
  major?: string;
  studentNumber: string;
  studentName: string;
  schoolHours: number;
  outsideHours: number;
}

/**
 * 나이스(NEIS) 봉사활동 파싱 결과 일괄 DB 저장 액션
 */
export async function batchImportVolunteerAction(studentsList: VolunteerImportStudentRow[]) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { success: false, error: '로그인이 필요합니다.' };
  }

  if (profile.role !== 'admin' && profile.role !== 'teacher') {
    return { success: false, error: '봉사활동 일괄 등록 권한이 없습니다.' };
  }

  const supabase = createAdminClient();
  const settings = await getSystemSettings();
  const baseYear = settings.baseYear;

  // 전체 학생 목록 전체 확보 (1000건 초과 청크 페이징 조회)
  const allStudents: any[] = [];
  let sFrom = 0;
  let sHasMore = true;
  while (sHasMore) {
    const { data } = await supabase
      .from('students')
      .select('id, student_name, student_number, class_info, major, graduation_year')
      .range(sFrom, sFrom + 999);
    if (!data || data.length === 0) {
      sHasMore = false;
    } else {
      allStudents.push(...data);
      if (data.length < 1000) sHasMore = false;
      else sFrom += 1000;
    }
  }

  if (allStudents.length === 0) {
    return { success: false, error: '시스템에 등록된 학생 정보가 없습니다.' };
  }

  const currentStore = await getEvaluationsStore();
  let updatedCount = 0;
  const skippedStudents: string[] = [];

  const cleanClass = (c: any) => String(c || '').replace(/[^0-9]/g, '');
  const cleanNum = (n: any) => String(n || '').replace(/[^0-9]/g, '');
  const cleanName = (n: any) => String(n || '').trim().replace(/\s+/g, '');

  for (const row of studentsList) {
    const targetGradYear = baseYear + (4 - row.grade);

    // 1. 해당 학년 학생 중 [이름 + 번호] 또는 [이름 + 반] 매칭 (자연수/문자열 정규화)
    const matched = allStudents.find(s => {
      if (s.graduation_year !== targetGradYear) return false;
      
      const nameMatch = cleanName(s.student_name) === cleanName(row.studentName);
      const numMatch = cleanNum(s.student_number) === cleanNum(row.studentNumber);
      const classMatch = row.classInfo ? cleanClass(s.class_info) === cleanClass(row.classInfo) : true;

      return nameMatch && (numMatch || classMatch);
    });

    if (matched) {
      const auditMeta = {
        userId: profile.id,
        userName: profile.full_name || profile.username || '교사',
        role: profile.role,
        at: new Date().toISOString(),
      };

      currentStore[matched.id] = {
        ...(currentStore[matched.id] || { student_id: matched.id }),
        volunteer_school_hours: row.schoolHours,
        volunteer_outside_hours: row.outsideHours,
        volunteer_meta: auditMeta,
        updated_by: auditMeta,
        student_id: matched.id,
        academic_year: baseYear,
      };
      updatedCount++;
    } else {
      skippedStudents.push(`${row.studentName} (${row.grade}학년 ${row.classInfo} ${row.studentNumber}번 - 매칭 학생 없음)`);
    }
  }

  const { error: saveErr } = await supabase
    .from('system_settings')
    .upsert({
      key: EVAL_SETTINGS_KEY,
      value: currentStore,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

  if (saveErr) {
    return { success: false, error: 'DB 저장 중 오류가 발생했습니다.' };
  }

  await logAuditAction({
    actor_name: profile.full_name || profile.username || '교사',
    action_type: 'STUDENT_BULK_UPDATE',
    target_name: `[인증제 봉사활동] 나이스 엑셀 일괄 등록 (${updatedCount}명 반영)`,
    details: { count: updatedCount, skipped: skippedStudents.length }
  });

  revalidateTag('cert-eval');
  revalidateTag(`cert-eval-grade-3`);
  revalidateTag(`cert-eval-grade-2`);
  revalidateTag(`cert-eval-grade-1`);
  revalidatePath('/admin/certification');
  revalidatePath('/admin/certification/import');
  revalidatePath('/admin/certification');
  revalidatePath('/admin/certification/import');

  return { 
    success: true, 
    updatedCount, 
    skippedCount: skippedStudents.length,
    skippedStudents: skippedStudents.slice(0, 10)
  };
}

/**
 * 엑셀 일괄 등록 파싱용 전교생 기본 정보 조회 (초고속 캐싱)
 */
export async function getAllStudentsForMatching() {
  const supabase = createAdminClient();
  const allStudents: any[] = [];
  let sFrom = 0;
  let sHasMore = true;
  while (sHasMore) {
    const { data } = await supabase
      .from('students')
      .select('id, student_name, student_number, class_info, major, graduation_year')
      .range(sFrom, sFrom + 999);
    if (!data || data.length === 0) {
      sHasMore = false;
    } else {
      allStudents.push(...data);
      if (data.length < 1000) sHasMore = false;
      else sFrom += 1000;
    }
  }
  return allStudents;
}

export interface VocationalImportStudentRow {
  studentId?: string;
  grade: number; // 1, 2, 3
  isMock?: boolean; // 3학년 모의평가 여부
  academicYear: number;
  korean?: number;
  english?: number;
  math?: number;
  problem?: number;
  gradeSum: number;
  isCompleted: boolean;
  studentName?: string;
}

/**
 * 직업기초능력평가 등급 파싱 결과 일괄 DB 저장 액션 (개별 영역 등급 영구 보관)
 */
export async function batchImportVocationalAction(studentsList: VocationalImportStudentRow[]) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { success: false, error: '로그인이 필요합니다.' };
  }

  if (profile.role !== 'admin' && profile.role !== 'teacher') {
    return { success: false, error: '직기초 평가 일괄 등록 권한이 없습니다.' };
  }

  const supabase = createAdminClient();
  const settings = await getSystemSettings();
  const baseYear = settings.baseYear;

  const currentStore = await getEvaluationsStore();
  let updatedCount = 0;
  const skippedStudents: string[] = [];

  for (const row of studentsList) {
    if (!row.studentId) {
      skippedStudents.push(`${row.studentName || '미매칭'} (매칭 학생 ID 없음)`);
      continue;
    }

    const prev = currentStore[row.studentId] || { student_id: row.studentId };
    
    // 개별 영역 등급 객체 구성 (미응시 0점은 5등급으로 계산하여 반영)
    const kVal = (row.korean && row.korean > 0) ? row.korean : 5;
    const eVal = (row.english && row.english > 0) ? row.english : 5;
    const mVal = (row.math && row.math > 0) ? row.math : 5;
    const pVal = (row.problem && row.problem > 0) ? row.problem : 5;

    // 국/영/수/문제 등급이 있거나 등급합이 있으면 응시 완료로 안전하게 인정
    const hasScoreInput = (row.korean && row.korean > 0) || (row.english && row.english > 0) || (row.math && row.math > 0) || (row.problem && row.problem > 0) || (row.gradeSum && row.gradeSum > 0 && row.gradeSum < 20);
    const isCompletedFinal = row.isCompleted || (row.isCompleted !== false && hasScoreInput) || hasScoreInput;

    const calculatedSum = kVal + eVal + mVal + pVal;
    const finalGradeSum = isCompletedFinal ? ((row.gradeSum && row.gradeSum > 0) ? row.gradeSum : calculatedSum) : 20;

    const auditMeta = {
      userId: profile.id,
      userName: profile.full_name || profile.username || '교사',
      role: profile.role,
      at: new Date().toISOString(),
    };

    const domainData = {
      korean: row.korean || 0,
      english: row.english || 0,
      math: row.math || 0,
      problem: row.problem || 0,
      gradeSum: finalGradeSum,
      isCompleted: isCompletedFinal,
      created_by: auditMeta,
    };

    const domainKey = row.isMock ? 'mock' : `grade${row.grade}`;
    const prevDetails = prev.vocational_details || {};
    const updatedDetails = {
      ...prevDetails,
      [domainKey]: domainData,
    };

    // 학년별 직기초 개별 영역 및 등급합 반영
    const updatedEval: CertificationEvaluationData = {
      ...prev,
      student_id: row.studentId,
      academic_year: baseYear,
      vocational_details: updatedDetails,
      updated_by: auditMeta,
    };

    if (row.isMock) {
      updatedEval.vocational_mock_grade = domainData.gradeSum;
    } else if (row.grade === 1) {
      updatedEval.vocational_grade_1 = domainData.gradeSum;
    } else if (row.grade === 2) {
      updatedEval.vocational_grade_2 = domainData.gradeSum;
    } else if (row.grade === 3) {
      updatedEval.vocational_grade_3 = domainData.gradeSum;
    }

    currentStore[row.studentId] = updatedEval;
    updatedCount++;
  }

  const { error: saveErr } = await supabase
    .from('system_settings')
    .upsert({
      key: EVAL_SETTINGS_KEY,
      value: currentStore,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

  if (saveErr) {
    return { success: false, error: 'DB 저장 중 오류가 발생했습니다.' };
  }

  await logAuditAction({
    actor_name: profile.full_name || profile.username || '교사',
    action_type: 'STUDENT_BULK_UPDATE',
    target_name: `[인증제 직기초] 직업기초능력평가 등급 일괄 등록 (${updatedCount}건 반영)`,
    details: { count: updatedCount, skipped: skippedStudents.length }
  });

  revalidateTag('cert-eval');
  revalidateTag('cert-eval-grade-3');
  revalidateTag('cert-eval-grade-2');
  revalidateTag('cert-eval-grade-1');
  revalidatePath('/admin/certification');
  revalidatePath('/admin/certification/import');

  return { 
    success: true, 
    updatedCount, 
    skippedCount: skippedStudents.length,
    skippedStudents: skippedStudents.slice(0, 10)
  };
}

/**
 * 취업역량 및 산학협력 실적 일괄 저장 서버 액션
 */
export async function batchImportEmploymentAction(
  rows: {
    studentId: string;
    industryEduList?: { id: string; title: string; dateOrTerm?: string }[];
    careerCourses?: Record<string, string>;
    majorClubs?: Record<string, string>;
    skillsContest?: { level: 'none' | 'national' | 'regional'; name: string };
    fieldTraining?: { completed: boolean; company?: string };
    apprenticeship?: Record<string, string>;
    employedEarly?: { confirmed: boolean; company?: string };
    industryEduCount: number;
    careerCourseSemesters: number;
    majorClubYears: number;
    skillsContestLevel: 'none' | 'national' | 'regional';
    fieldTrainingCompleted: boolean;
    apprenticeshipSemesters: number;
    employedEarlyFlag: boolean;
  }[]
): Promise<{
  success: boolean;
  updatedCount?: number;
  error?: string;
}> {
  const profile = await getCurrentUserProfile();
  if (profile?.role !== 'admin' && profile?.role !== 'teacher') {
    return { success: false, error: '권한이 없습니다.' };
  }

  const auditMeta = {
    userId: profile.id,
    userName: profile.full_name || profile.username || '교사',
    role: profile.role,
    at: new Date().toISOString(),
  };

  const supabase = createAdminClient();
  const currentStore = await getEvaluationsStore();
  let updatedCount = 0;

  for (const row of rows) {
    const existing = currentStore[row.studentId] || { student_id: row.studentId };
    const prevEmployment = existing.employment_details || {};

    // 1. 산학협력 교육: 기존 목록 보존 및 새 항목 누적 병합
    const existingEduList = prevEmployment.industry_edu_list || [];
    const newEduList = (row.industryEduList || []).map(item => ({
      ...item,
      created_by: (item as any).created_by || auditMeta,
    }));
    const mergedEduList = [...existingEduList];
    for (const ne of newEduList) {
      if (!mergedEduList.some(e => e.id === ne.id)) {
        mergedEduList.push(ne);
      }
    }

    // 2. 취업진로코스 슬롯 병합
    const mergedCourses = { ...(prevEmployment.career_courses || {}), ...(row.careerCourses || {}) };
    const updatedCoursesMeta = { ...(prevEmployment.career_courses_meta || {}) };
    if (row.careerCourses) {
      Object.keys(row.careerCourses).forEach(k => {
        updatedCoursesMeta[k] = auditMeta;
      });
    }

    // 3. 전공심화동아리 슬롯 병합
    const mergedClubs = { ...(prevEmployment.major_clubs || {}), ...(row.majorClubs || {}) };
    const updatedClubsMeta = { ...(prevEmployment.major_clubs_meta || {}) };
    if (row.majorClubs) {
      Object.keys(row.majorClubs).forEach(k => {
        updatedClubsMeta[k] = auditMeta;
      });
    }

    // 4. 기능경기대회
    const mergedContest = row.skillsContest && row.skillsContest.level !== 'none' ? {
      level: row.skillsContest.level,
      name: row.skillsContest.name,
      created_by: auditMeta,
    } : prevEmployment.skills_contest;

    // 5. 현장실습 / 도제 / 조기취업
    const mergedField = row.fieldTraining?.completed ? {
      ...row.fieldTraining,
      created_by: auditMeta,
    } : prevEmployment.field_training;

    const mergedApprentice = { ...(prevEmployment.apprenticeship || {}), ...(row.apprenticeship || {}) };
    const updatedApprenticeMeta = { ...(prevEmployment.apprenticeship_meta || {}) };
    if (row.apprenticeship) {
      Object.keys(row.apprenticeship).forEach(k => {
        updatedApprenticeMeta[k] = auditMeta;
      });
    }

    const mergedEarly = row.employedEarly?.confirmed ? {
      ...row.employedEarly,
      created_by: auditMeta,
    } : prevEmployment.employed_early;

    const finalEduCount = mergedEduList.length;
    const finalCourseSemesters = Object.keys(mergedCourses).length;
    const finalClubYears = Object.keys(mergedClubs).length;
    const finalSkillsLevel = mergedContest?.level || 'none';
    const finalFieldCompleted = mergedField?.completed || false;
    const finalApprSemesters = Object.keys(mergedApprentice).length;
    const finalEarlyFlag = mergedEarly?.confirmed || false;

    const updatedEval: CertificationEvaluationData = {
      ...existing,
      created_by: existing.created_by || auditMeta,
      updated_by: auditMeta,
      industry_edu_count: finalEduCount,
      career_course_semesters: finalCourseSemesters,
      major_club_years: finalClubYears,
      skills_contest_level: finalSkillsLevel,
      field_training_completed: finalFieldCompleted,
      apprenticeship_semesters: finalApprSemesters,
      employed_early: finalEarlyFlag,
      employment_details: {
        industry_edu_list: mergedEduList,
        career_courses: mergedCourses,
        career_courses_meta: updatedCoursesMeta,
        major_clubs: mergedClubs,
        major_clubs_meta: updatedClubsMeta,
        skills_contest: mergedContest,
        field_training: mergedField,
        apprenticeship: mergedApprentice,
        apprenticeship_meta: updatedApprenticeMeta,
        employed_early: mergedEarly,
      }
    };

    currentStore[row.studentId] = updatedEval;
    updatedCount++;
  }

  const { error: saveErr } = await supabase
    .from('system_settings')
    .upsert({
      key: EVAL_SETTINGS_KEY,
      value: currentStore,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

  if (saveErr) {
    return { success: false, error: 'DB 저장 중 오류가 발생했습니다.' };
  }

  await logAuditAction({
    actor_name: profile.full_name || profile.username || '교사',
    action_type: 'STUDENT_BULK_UPDATE',
    target_name: `[인증제 취업역량] 취업역량 및 산학협력 실적 일괄 등록 (${updatedCount}명 반영)`,
    details: { count: updatedCount }
  });

  revalidateTag('cert-eval');
  revalidateTag('cert-eval-grade-3');
  revalidateTag('cert-eval-grade-2');
  revalidateTag('cert-eval-grade-1');
  revalidatePath('/admin/certification');
  revalidatePath('/admin/certification/import');

  return {
    success: true,
    updatedCount,
  };
}

/**
 * 4. 예체능(운동부/관악부) 및 교내외 대회 실적 일괄 저장 서버 액션
 */
export async function batchImportArtsContestAction(
  rows: {
    studentId: string;
    artsSports: Record<string, string>;
    contestList: Array<{
      id: string;
      type: 'award' | 'participate';
      category?: string;
      title: string;
      dateOrTerm?: string;
      award?: string;
    }>;
    artsSportsSemesters: number;
    contestAwardCount: number;
    contestParticipateCount: number;
  }[]
): Promise<{
  success: boolean;
  updatedCount?: number;
  error?: string;
}> {
  const profile = await getCurrentUserProfile();
  if (profile?.role !== 'admin' && profile?.role !== 'teacher') {
    return { success: false, error: '권한이 없습니다.' };
  }

  const auditMeta = {
    userId: profile.id,
    userName: profile.full_name || profile.username || '교사',
    role: profile.role,
    at: new Date().toISOString(),
  };

  const supabase = createAdminClient();
  const currentStore = await getEvaluationsStore();
  let updatedCount = 0;

  for (const row of rows) {
    const existing = currentStore[row.studentId] || { student_id: row.studentId };
    const prevArts = existing.arts_contest_details || {};

    const updatedSportsMeta = { ...(prevArts.arts_sports_meta || {}) };
    if (row.artsSports) {
      Object.keys(row.artsSports).forEach(k => {
        updatedSportsMeta[k] = auditMeta;
      });
    }

    const updatedContestList = (row.contestList || []).map(c => ({
      ...c,
      created_by: (c as any).created_by || auditMeta,
    }));

    const contestEval = evaluateContestList(updatedContestList);

    const updatedEval: CertificationEvaluationData = {
      ...existing,
      created_by: existing.created_by || auditMeta,
      updated_by: auditMeta,
      arts_sports_semesters: row.artsSportsSemesters,
      contest_award_count: contestEval.effectiveAwardCount,
      contest_participate_count: contestEval.effectivePartCount,
      arts_contest_details: {
        arts_sports: row.artsSports || {},
        arts_sports_meta: updatedSportsMeta,
        contest_list: updatedContestList,
      }
    };

    currentStore[row.studentId] = updatedEval;
    updatedCount++;
  }

  const { error: saveErr } = await supabase
    .from('system_settings')
    .upsert({
      key: EVAL_SETTINGS_KEY,
      value: currentStore,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

  if (saveErr) {
    return { success: false, error: 'DB 저장 중 오류가 발생했습니다.' };
  }

  await logAuditAction({
    actor_name: profile.full_name || profile.username || '교사',
    action_type: 'STUDENT_BULK_UPDATE',
    target_name: `[인증제 예체능/대회] 예체능 및 교내외 대회 실적 일괄 등록 (${updatedCount}명 반영)`,
    details: { count: updatedCount }
  });

  revalidateTag('cert-eval');
  revalidateTag('cert-eval-grade-3');
  revalidateTag('cert-eval-grade-2');
  revalidateTag('cert-eval-grade-1');
  revalidatePath('/admin/certification');
  revalidatePath('/admin/certification/import');

  return {
    success: true,
    updatedCount,
  };
}

/**
 * 개별 실적 항목 삭제 서버 액션 (RBAC 및 작성자 본인 소유권 검증)
 * 관리자는 모든 데이터 삭제 가능, 일반 교사는 본인이 등록한 항목만 삭제 가능
 */
export async function deleteStudentEvaluationItemAction(
  studentId: string,
  category: 'contest' | 'arts_sports' | 'industry_edu' | 'career_course' | 'major_club' | 'field_training' | 'skills_contest' | 'apprenticeship' | 'employed_early' | 'all',
  subKeyOrId?: string
): Promise<{ success: boolean; error?: string }> {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { success: false, error: '로그인이 필요합니다.' };
  }

  const isAdmin = profile.role === 'admin';
  const currentUserId = profile.id;

  const supabase = createAdminClient();
  const currentStore = await getEvaluationsStore();
  const evalData = currentStore[studentId];

  if (!evalData) {
    return { success: false, error: '해당 학생의 평가 데이터가 존재하지 않습니다.' };
  }

  // 1. 카테고리별 소유권 검사 및 삭제
  if (category === 'contest' && subKeyOrId) {
    const list = evalData.arts_contest_details?.contest_list || [];
    const item = list.find(c => c.id === subKeyOrId);
    if (!item) {
      return { success: false, error: '삭제할 대회 실적을 찾을 수 없습니다.' };
    }

    if (!isAdmin && item.created_by?.userId && item.created_by.userId !== currentUserId) {
      return { success: false, error: `이 항목은 ${item.created_by.userName} 선생님이 등록한 데이터로, 본인 또는 관리자만 삭제할 수 있습니다.` };
    }

    const newList = list.filter(c => c.id !== subKeyOrId);
    const contestEval = evaluateContestList(newList);
    evalData.arts_contest_details = {
      ...evalData.arts_contest_details,
      contest_list: newList,
    };
    evalData.contest_award_count = contestEval.effectiveAwardCount;
    evalData.contest_participate_count = contestEval.effectivePartCount;

  } else if (category === 'arts_sports' && subKeyOrId) {
    const sportsMap = evalData.arts_contest_details?.arts_sports || {};
    const sportsMeta = evalData.arts_contest_details?.arts_sports_meta || {};
    const meta = sportsMeta[subKeyOrId];

    if (!isAdmin && meta?.userId && meta.userId !== currentUserId) {
      return { success: false, error: `이 항목은 ${meta.userName} 선생님이 등록한 데이터로, 본인 또는 관리자만 삭제할 수 있습니다.` };
    }

    delete sportsMap[subKeyOrId];
    delete sportsMeta[subKeyOrId];

    evalData.arts_contest_details = {
      ...evalData.arts_contest_details,
      arts_sports: sportsMap,
      arts_sports_meta: sportsMeta,
    };
    evalData.arts_sports_semesters = Object.keys(sportsMap).length;

  } else if (category === 'industry_edu' && subKeyOrId) {
    const list = evalData.employment_details?.industry_edu_list || [];
    const item = list.find(i => i.id === subKeyOrId);
    if (!item) {
      return { success: false, error: '삭제할 교육 이수 내역을 찾을 수 없습니다.' };
    }

    if (!isAdmin && item.created_by?.userId && item.created_by.userId !== currentUserId) {
      return { success: false, error: `이 항목은 ${item.created_by.userName} 선생님이 등록한 데이터로, 본인 또는 관리자만 삭제할 수 있습니다.` };
    }

    const newList = list.filter(i => i.id !== subKeyOrId);
    evalData.employment_details = {
      ...evalData.employment_details,
      industry_edu_list: newList,
    };
    evalData.industry_edu_count = newList.length;

  } else if (category === 'career_course' && subKeyOrId) {
    const coursesMap = evalData.employment_details?.career_courses || {};
    const coursesMeta = evalData.employment_details?.career_courses_meta || {};
    const meta = coursesMeta[subKeyOrId];

    if (!isAdmin && meta?.userId && meta.userId !== currentUserId) {
      return { success: false, error: `이 항목은 ${meta.userName} 선생님이 등록한 데이터로, 본인 또는 관리자만 삭제할 수 있습니다.` };
    }

    delete coursesMap[subKeyOrId];
    delete coursesMeta[subKeyOrId];

    evalData.employment_details = {
      ...evalData.employment_details,
      career_courses: coursesMap,
      career_courses_meta: coursesMeta,
    };
    evalData.career_course_semesters = Object.keys(coursesMap).length;

  } else if (category === 'major_club' && subKeyOrId) {
    const clubsMap = evalData.employment_details?.major_clubs || {};
    const clubsMeta = evalData.employment_details?.major_clubs_meta || {};
    const meta = clubsMeta[subKeyOrId];

    if (!isAdmin && meta?.userId && meta.userId !== currentUserId) {
      return { success: false, error: `이 항목은 ${meta.userName} 선생님이 등록한 데이터로, 본인 또는 관리자만 삭제할 수 있습니다.` };
    }

    delete clubsMap[subKeyOrId];
    delete clubsMeta[subKeyOrId];

    evalData.employment_details = {
      ...evalData.employment_details,
      major_clubs: clubsMap,
      major_clubs_meta: clubsMeta,
    };
    evalData.major_club_years = Object.keys(clubsMap).length;

  } else if (category === 'skills_contest') {
    const meta = evalData.employment_details?.skills_contest?.created_by;
    if (!isAdmin && meta?.userId && meta.userId !== currentUserId) {
      return { success: false, error: `이 항목은 ${meta.userName} 선생님이 등록한 데이터로, 본인 또는 관리자만 삭제할 수 있습니다.` };
    }

    if (evalData.employment_details) {
      delete evalData.employment_details.skills_contest;
    }
    evalData.skills_contest_level = 'none';

  } else if (category === 'field_training') {
    const meta = evalData.employment_details?.field_training?.created_by;
    if (!isAdmin && meta?.userId && meta.userId !== currentUserId) {
      return { success: false, error: `이 항목은 ${meta.userName} 선생님이 등록한 데이터로, 본인 또는 관리자만 삭제할 수 있습니다.` };
    }

    if (evalData.employment_details) {
      delete evalData.employment_details.field_training;
    }
    evalData.field_training_completed = false;

  } else if (category === 'apprenticeship' && subKeyOrId) {
    const appMap = evalData.employment_details?.apprenticeship || {};
    const appMeta = evalData.employment_details?.apprenticeship_meta || {};
    const meta = appMeta[subKeyOrId];

    if (!isAdmin && meta?.userId && meta.userId !== currentUserId) {
      return { success: false, error: `이 항목은 ${meta.userName} 선생님이 등록한 데이터로, 본인 또는 관리자만 삭제할 수 있습니다.` };
    }

    delete appMap[subKeyOrId];
    delete appMeta[subKeyOrId];

    evalData.employment_details = {
      ...evalData.employment_details,
      apprenticeship: appMap,
      apprenticeship_meta: appMeta,
    };
    evalData.apprenticeship_semesters = Object.keys(appMap).length;

  } else if (category === 'employed_early') {
    const meta = evalData.employment_details?.employed_early?.created_by;
    if (!isAdmin && meta?.userId && meta.userId !== currentUserId) {
      return { success: false, error: `이 항목은 ${meta.userName} 선생님이 등록한 데이터로, 본인 또는 관리자만 삭제할 수 있습니다.` };
    }

    if (evalData.employment_details) {
      delete evalData.employment_details.employed_early;
    }
    evalData.employed_early = false;

  } else if (category === 'all') {
    if (!isAdmin) {
      return { success: false, error: '전체 데이터 초기화는 관리자만 수행할 수 있습니다.' };
    }
    delete currentStore[studentId];
  }

  // 2. 저장 및 Audit Log 기록
  evalData.updated_by = {
    userId: profile.id,
    userName: profile.full_name || profile.username || '교사',
    role: profile.role,
    at: new Date().toISOString(),
  };

  const { error: saveErr } = await supabase
    .from('system_settings')
    .upsert({
      key: EVAL_SETTINGS_KEY,
      value: currentStore,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

  if (saveErr) {
    return { success: false, error: '삭제 후 DB 저장 중 오류가 발생했습니다.' };
  }

  await logAuditAction({
    actor_name: profile.full_name || profile.username || '교사',
    action_type: 'STUDENT_UPDATE',
    target_name: `[인증제 실적 항목 삭제] 학생ID: ${studentId} (${category}${subKeyOrId ? ` - ${subKeyOrId}` : ''})`,
    details: { studentId, category, subKeyOrId }
  });

  revalidateTag('cert-eval');
  revalidateTag('cert-eval-grade-3');
  revalidateTag('cert-eval-grade-2');
  revalidateTag('cert-eval-grade-1');
  revalidatePath('/admin/certification');
  revalidatePath('/admin/certification/import');

  return { success: true };
}

export interface MyImportedStudentItem {
  studentId: string;
  rowKey: string; // 항목별 고유 키 (studentId + 항목 식별자), 테이블 row key로 사용
  studentName: string;
  grade?: number;
  classInfo: string;
  major: string;
  studentNumber: string;
  summary: string[]; // 단일 항목 요약 (1개짜리 배열)
  registeredAt?: string;
  registeredByName?: string;
  canDelete: boolean;
  rawVocationalDetails?: any;
  rawVolunteerHours?: { school: number; outside: number };
  rawItemData?: any; // 해당 row의 원본 데이터 (수정 폼 초기값 세팅에 사용)
}

/**
 * 특정 일괄 등록 카테고리(봉사, 직기초, 취업역량, 예체능/대회)에서
 * 본인(또는 관리자)이 등록한 학생별 데이터 목록을 조회하는 서버 액션
 */
export async function getMyImportedRecordsAction(
  category: 'volunteer' | 'vocational' | 'employment' | 'arts_contest'
): Promise<{
  success: boolean;
  records: MyImportedStudentItem[];
  totalItemCount: number;
  error?: string;
}> {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { success: false, records: [], totalItemCount: 0, error: '로그인이 필요합니다.' };
  }

  const isAdmin = profile.role === 'admin';
  const currentUserId = profile.id;

  const settings = await getSystemSettings();
  const baseYear = settings.baseYear;

  const allStudents = await getAllStudentsForMatching();
  const studentMap = new Map<string, any>(allStudents.map(s => [s.id, s]));

  const currentStore = await getEvaluationsStore();
  const result: MyImportedStudentItem[] = [];
  let totalItemCount = 0;

  for (const [studentId, evalData] of Object.entries(currentStore)) {
    const student = studentMap.get(studentId);
    if (!student) continue;

    const gradYear = student.graduation_year;
    const grade = gradYear ? (baseYear + 4 - gradYear) : undefined;
    const rawClass = String(student.class_info || '').trim();
    const classInfo = rawClass ? (rawClass.endsWith('반') ? rawClass : `${rawClass}반`) : '';

    // 학생 기본 정보 (모든 항목 행에 공통)
    const base = {
      studentId,
      studentName: student.student_name,
      grade,
      classInfo,
      major: student.major,
      studentNumber: student.student_number,
      canDelete: true,
      rawVocationalDetails: evalData.vocational_details,
      rawVolunteerHours: {
        school: Number(evalData.volunteer_school_hours || 0),
        outside: Number(evalData.volunteer_outside_hours || 0),
      },
    };

    if (category === 'volunteer') {
      // 봉사활동: 학생당 1행
      const vMeta = evalData.volunteer_meta;
      const school = Number(evalData.volunteer_school_hours || 0);
      const outside = Number(evalData.volunteer_outside_hours || 0);
      const hours = school + outside;
      if (hours > 0 && (isAdmin || vMeta?.userId === currentUserId || (!vMeta && profile.role === 'teacher'))) {
        totalItemCount++;
        result.push({
          ...base,
          rowKey: `${studentId}_volunteer`,
          summary: [`봉사활동 총 ${hours}시간 (교내 ${school}h / 교외 ${outside}h)`],
          registeredAt: vMeta?.at,
          registeredByName: vMeta?.userName,
        });
      }

    } else if (category === 'vocational') {
      // 직업기초능력: 학년(grade)별로 1행씩
      const vDetails = evalData.vocational_details || {};
      for (const gradeKey of ['grade1', 'grade2', 'grade3', 'mock'] as const) {
        const gData = vDetails[gradeKey];
        if (gData?.isCompleted) {
          const gMeta = gData.created_by;
          if (isAdmin || gMeta?.userId === currentUserId || (!gMeta && profile.role === 'teacher')) {
            totalItemCount++;
            const label = gradeKey === 'mock' ? '3학년 모의평가' : `${gradeKey.replace('grade', '')}학년`;
            result.push({
              ...base,
              rowKey: `${studentId}_vocational_${gradeKey}`,
              summary: [`${label} 등급합: ${gData.gradeSum}등급 (국${gData.korean || 5}, 영${gData.english || 5}, 수${gData.math || 5}, 문${gData.problem || 5})`],
              registeredAt: gMeta?.at,
              registeredByName: gMeta?.userName,
            });
          }
        }
      }

    } else if (category === 'employment') {
      // 취업역량: 세부 항목별로 각각 1행
      const eDetails = evalData.employment_details || {};

      // 1. 산학교육 (배열 → 항목 하나당 1행)
      (eDetails.industry_edu_list || []).forEach((item: any, idx: number) => {
        if (isAdmin || item.created_by?.userId === currentUserId || (!item.created_by && profile.role === 'teacher')) {
          totalItemCount++;
          result.push({
            ...base,
            rowKey: `${studentId}_industry_edu_${idx}`,
            summary: [`산학교육: ${item.title}${item.dateOrTerm ? ` (${item.dateOrTerm})` : ''}`],
            registeredAt: item.created_by?.at,
            registeredByName: item.created_by?.userName,
            rawItemData: { type: 'industry_edu', title: item.title || '', dateOrTerm: item.dateOrTerm || '', idx },
          });
        }
      });

      // 2. 취업코스 (학기별 1행)
      Object.entries(eDetails.career_courses || {}).forEach(([term, course]) => {
        const meta = eDetails.career_courses_meta?.[term];
        if (isAdmin || meta?.userId === currentUserId || (!meta && profile.role === 'teacher')) {
          totalItemCount++;
          result.push({
            ...base,
            rowKey: `${studentId}_career_courses_${term}`,
            summary: [`취업코스: ${term}학기 [${course}]`],
            registeredAt: meta?.at,
            registeredByName: meta?.userName,
            rawItemData: { type: 'career_courses', course: String(course || ''), term },
          });
        }
      });

      // 3. 심화동아리 (학년별 1행)
      Object.entries(eDetails.major_clubs || {}).forEach(([g, club]) => {
        const meta = eDetails.major_clubs_meta?.[g];
        if (isAdmin || meta?.userId === currentUserId || (!meta && profile.role === 'teacher')) {
          totalItemCount++;
          result.push({
            ...base,
            rowKey: `${studentId}_major_clubs_${g}`,
            summary: [`심화동아리: ${g}학년 [${club}]`],
            registeredAt: meta?.at,
            registeredByName: meta?.userName,
            rawItemData: { type: 'major_clubs', club: String(club || ''), grade: g },
          });
        }
      });

      // 4. 기능경기대회 (1행)
      if (eDetails.skills_contest?.name) {
        const meta = eDetails.skills_contest.created_by;
        if (isAdmin || meta?.userId === currentUserId || (!meta && profile.role === 'teacher')) {
          totalItemCount++;
          result.push({
            ...base,
            rowKey: `${studentId}_skills_contest`,
            summary: [`기능대회: ${eDetails.skills_contest.name} (${eDetails.skills_contest.level === 'national' ? '전국' : '지방'})`],
            registeredAt: meta?.at,
            registeredByName: meta?.userName,
            rawItemData: { type: 'skills_contest', name: eDetails.skills_contest.name || '', level: eDetails.skills_contest.level || 'local' },
          });
        }
      }

      // 5. 현장실습 (1행)
      if (eDetails.field_training?.company) {
        const meta = eDetails.field_training.created_by;
        if (isAdmin || meta?.userId === currentUserId || (!meta && profile.role === 'teacher')) {
          totalItemCount++;
          result.push({
            ...base,
            rowKey: `${studentId}_field_training`,
            summary: [`현장실습: ${eDetails.field_training.company}`],
            registeredAt: meta?.at,
            registeredByName: meta?.userName,
            rawItemData: { type: 'field_training', company: eDetails.field_training.company || '' },
          });
        }
      }

      // 6. 도제 OJT (학기별 1행)
      Object.entries(eDetails.apprenticeship || {}).forEach(([term, comp]) => {
        const meta = eDetails.apprenticeship_meta?.[term];
        if (isAdmin || meta?.userId === currentUserId || (!meta && profile.role === 'teacher')) {
          totalItemCount++;
          result.push({
            ...base,
            rowKey: `${studentId}_apprenticeship_${term}`,
            summary: [`도제 OJT: ${term} [${comp}]`],
            registeredAt: meta?.at,
            registeredByName: meta?.userName,
            rawItemData: { type: 'apprenticeship', company: String(comp || ''), term },
          });
        }
      });

      // 7. 조기취업 (1행)
      if (eDetails.employed_early?.company) {
        const meta = eDetails.employed_early.created_by;
        if (isAdmin || meta?.userId === currentUserId || (!meta && profile.role === 'teacher')) {
          totalItemCount++;
          result.push({
            ...base,
            rowKey: `${studentId}_employed_early`,
            summary: [`조기취업: ${eDetails.employed_early.company}`],
            registeredAt: meta?.at,
            registeredByName: meta?.userName,
            rawItemData: { type: 'employed_early', company: eDetails.employed_early.company || '' },
          });
        }
      }

    } else if (category === 'arts_contest') {
      // 예체능/대회: 항목별 1행
      const aDetails = evalData.arts_contest_details || {};

      // 1. 대회 실적 (배열 → 항목 하나당 1행)
      (aDetails.contest_list || []).forEach((item: any, idx: number) => {
        if (isAdmin || item.created_by?.userId === currentUserId || (!item.created_by && profile.role === 'teacher')) {
          totalItemCount++;
          result.push({
            ...base,
            rowKey: `${studentId}_contest_${idx}`,
            summary: [`대회 실적: [${item.category || '교내'}] ${item.title} (${item.type === 'award' ? `입상 - ${item.award || '1점'}` : '참가 - 0.5점'})`],
            registeredAt: item.created_by?.at,
            registeredByName: item.created_by?.userName,
            rawItemData: { type: 'contest', category: item.category || '교내', title: item.title || '', contestType: item.type || 'award', award: item.award || '1점', idx },
          });
        }
      });

      // 2. 운동부/관악부 (학기별 1행)
      Object.entries(aDetails.arts_sports || {}).forEach(([term, dept]) => {
        const meta = aDetails.arts_sports_meta?.[term];
        if (isAdmin || meta?.userId === currentUserId || (!meta && profile.role === 'teacher')) {
          totalItemCount++;
          result.push({
            ...base,
            rowKey: `${studentId}_arts_sports_${term}`,
            summary: [`예체능: ${term}학기 [${dept}]`],
            registeredAt: meta?.at,
            registeredByName: meta?.userName,
            rawItemData: { type: 'arts_sports', dept: String(dept || ''), term },
          });
        }
      });
    }

  }

  // 등록 일시 내림차순 정렬 (최근 등록 순)
  result.sort((a, b) => {
    const dateA = a.registeredAt ? new Date(a.registeredAt).getTime() : 0;
    const dateB = b.registeredAt ? new Date(b.registeredAt).getTime() : 0;
    if (dateB !== dateA) return dateB - dateA;
    // 같은 시각이면 학년 > 반 > 번호 순
    if ((b.grade || 0) !== (a.grade || 0)) return (b.grade || 0) - (a.grade || 0);
    if (a.classInfo !== b.classInfo) return a.classInfo.localeCompare(b.classInfo);
    return Number(a.studentNumber) - Number(b.studentNumber);
  });

  return {
    success: true,
    records: result,
    totalItemCount,
  };
}

/**
 * 특정 일괄 등록 카테고리에서 개별 학생의 실적 데이터를 단건 직접 수정하는 서버 액션
 */
export async function updateSingleImportedRecordAction(
  category: 'volunteer' | 'vocational' | 'employment' | 'arts_contest',
  studentId: string,
  data: any
): Promise<{ success: boolean; error?: string }> {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { success: false, error: '로그인이 필요합니다.' };
  }

  if (profile.role !== 'admin' && profile.role !== 'teacher') {
    return { success: false, error: '수정 권한이 없습니다.' };
  }

  const supabase = createAdminClient();
  const settings = await getSystemSettings();
  const baseYear = settings.baseYear;
  const currentStore = await getEvaluationsStore();

  const prev = currentStore[studentId] || { student_id: studentId };

  const auditMeta = {
    userId: profile.id,
    userName: profile.full_name || profile.username || '교사',
    role: profile.role,
    at: new Date().toISOString(),
  };

  if (category === 'vocational') {
    const vocationalDetails = data.vocationalDetails || {};
    const updatedDetails: any = { ...(prev.vocational_details || {}) };

    (['grade1', 'grade2', 'grade3', 'mock'] as const).forEach((gk) => {
      const gItem = vocationalDetails[gk];
      if (gItem) {
        const kVal = gItem.korean && gItem.korean > 0 ? Number(gItem.korean) : 5;
        const eVal = gItem.english && gItem.english > 0 ? Number(gItem.english) : 5;
        const mVal = gItem.math && gItem.math > 0 ? Number(gItem.math) : 5;
        const pVal = gItem.problem && gItem.problem > 0 ? Number(gItem.problem) : 5;
        const gradeSum = gItem.isCompleted ? kVal + eVal + mVal + pVal : 20;

        updatedDetails[gk] = {
          korean: Number(gItem.korean || 0),
          english: Number(gItem.english || 0),
          math: Number(gItem.math || 0),
          problem: Number(gItem.problem || 0),
          gradeSum,
          isCompleted: Boolean(gItem.isCompleted),
          created_by: gItem.created_by || auditMeta,
        };
      }
    });

    currentStore[studentId] = {
      ...prev,
      student_id: studentId,
      academic_year: baseYear,
      vocational_details: updatedDetails,
      vocational_grade_1: updatedDetails.grade1?.isCompleted ? updatedDetails.grade1.gradeSum : undefined,
      vocational_grade_2: updatedDetails.grade2?.isCompleted ? updatedDetails.grade2.gradeSum : undefined,
      vocational_grade_3: updatedDetails.grade3?.isCompleted ? updatedDetails.grade3.gradeSum : undefined,
      vocational_mock_grade: updatedDetails.mock?.isCompleted ? updatedDetails.mock.gradeSum : undefined,
      updated_by: auditMeta,
    };
  } else if (category === 'volunteer') {
    currentStore[studentId] = {
      ...prev,
      student_id: studentId,
      academic_year: baseYear,
      volunteer_school_hours: Number(data.schoolHours || 0),
      volunteer_outside_hours: Number(data.outsideHours || 0),
      volunteer_meta: auditMeta,
      updated_by: auditMeta,
    };
  } else if (category === 'employment') {
    // rowKey로 어떤 세부 항목인지 파악 후 해당 필드만 수정
    const rowKey: string = data.rowKey || '';
    const eDetails = { ...(prev.employment_details || {}) };

    if (rowKey.includes('_industry_edu_')) {
      const idx = parseInt(rowKey.split('_industry_edu_')[1]);
      const list = [...(eDetails.industry_edu_list || [])];
      if (list[idx]) {
        list[idx] = { ...list[idx], title: data.title || list[idx].title, dateOrTerm: data.dateOrTerm ?? list[idx].dateOrTerm };
        eDetails.industry_edu_list = list;
      }
    } else if (rowKey.includes('_career_courses_')) {
      const term = rowKey.split('_career_courses_')[1];
      eDetails.career_courses = { ...(eDetails.career_courses || {}), [term]: data.course };
    } else if (rowKey.includes('_major_clubs_')) {
      const grade = rowKey.split('_major_clubs_')[1];
      eDetails.major_clubs = { ...(eDetails.major_clubs || {}), [grade]: data.club };
    } else if (rowKey.includes('_skills_contest')) {
      eDetails.skills_contest = { ...(eDetails.skills_contest || {}), name: data.name, level: data.level, created_by: eDetails.skills_contest?.created_by || auditMeta };
    } else if (rowKey.includes('_field_training')) {
      const existing = eDetails.field_training;
      eDetails.field_training = {
        completed: existing?.completed ?? false,
        company: data.company,
        period: existing?.period,
        created_by: existing?.created_by || auditMeta,
      };
    } else if (rowKey.includes('_apprenticeship_')) {
      const term = rowKey.split('_apprenticeship_')[1];
      eDetails.apprenticeship = { ...(eDetails.apprenticeship || {}), [term]: data.company };
    } else if (rowKey.includes('_employed_early')) {
      const existing = eDetails.employed_early;
      eDetails.employed_early = {
        confirmed: existing?.confirmed ?? false,
        company: data.company,
        date: existing?.date,
        created_by: existing?.created_by || auditMeta,
      };
    }

    currentStore[studentId] = { ...prev, student_id: studentId, academic_year: baseYear, employment_details: eDetails, updated_by: auditMeta };

  } else if (category === 'arts_contest') {
    // rowKey로 어떤 세부 항목인지 파악 후 해당 필드만 수정
    const rowKey: string = data.rowKey || '';
    const aDetails = { ...(prev.arts_contest_details || {}) };

    if (rowKey.includes('_contest_')) {
      const idx = parseInt(rowKey.split('_contest_')[1]);
      const list = [...(aDetails.contest_list || [])];
      if (list[idx]) {
        list[idx] = {
          ...list[idx],
          category: data.category || list[idx].category,
          title: data.title || list[idx].title,
          type: data.contestType || list[idx].type,
          award: data.contestType === 'award' ? (data.award || list[idx].award) : undefined,
        };
        aDetails.contest_list = list;
      }
    } else if (rowKey.includes('_arts_sports_')) {
      const term = rowKey.split('_arts_sports_')[1];
      aDetails.arts_sports = { ...(aDetails.arts_sports || {}), [term]: data.dept };
    }

    currentStore[studentId] = { ...prev, student_id: studentId, academic_year: baseYear, arts_contest_details: aDetails, updated_by: auditMeta };
  }

  const { error: saveErr } = await supabase
    .from('system_settings')
    .upsert(
      {
        key: EVAL_SETTINGS_KEY,
        value: currentStore,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

  if (saveErr) {
    return { success: false, error: 'DB 저장 중 오류가 발생했습니다.' };
  }

  await logAuditAction({
    actor_name: profile.full_name || profile.username || '교사',
    action_type: 'STUDENT_UPDATE',
    target_name: `[인증제 등록 내역 수정] (${category}) 학생ID: ${studentId}`,
    details: { category, studentId, data },
  });

  revalidateTag('cert-eval');
  revalidateTag(`cert-eval-grade-3`);
  revalidateTag(`cert-eval-grade-2`);
  revalidateTag(`cert-eval-grade-1`);
  revalidatePath('/admin/certification');
  revalidatePath('/admin/certification/import');

  return { success: true };
}

/**
 * 특정 일괄 등록 카테고리에서 내가 등록한 학생 데이터(또는 선택한 학생들의 데이터)를 일괄 삭제하는 서버 액션
 */
export async function deleteMyImportedRecordsAction(
  category: 'volunteer' | 'vocational' | 'employment' | 'arts_contest',
  targetStudentIds?: string[]
): Promise<{
  success: boolean;
  deletedStudentsCount: number;
  deletedItemsCount: number;
  error?: string;
}> {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { success: false, deletedStudentsCount: 0, deletedItemsCount: 0, error: '로그인이 필요합니다.' };
  }

  const isAdmin = profile.role === 'admin';
  const currentUserId = profile.id;

  const supabase = createAdminClient();
  const currentStore = await getEvaluationsStore();

  const studentIdsToProcess = targetStudentIds && targetStudentIds.length > 0
    ? targetStudentIds
    : Object.keys(currentStore);

  let deletedStudentsCount = 0;
  let deletedItemsCount = 0;

  for (const studentId of studentIdsToProcess) {
    const evalData = currentStore[studentId];
    if (!evalData) continue;

    let modified = false;

    if (category === 'volunteer') {
      const vMeta = evalData.volunteer_meta;
      if (isAdmin || vMeta?.userId === currentUserId || (!vMeta && profile.role === 'teacher')) {
        evalData.volunteer_school_hours = 0;
        evalData.volunteer_outside_hours = 0;
        evalData.volunteer_meta = undefined;
        modified = true;
        deletedItemsCount++;
      }
    } else if (category === 'vocational') {
      const vDetails = evalData.vocational_details;
      if (vDetails) {
        for (const gradeKey of ['grade1', 'grade2', 'grade3', 'mock'] as const) {
          const gData = vDetails[gradeKey];
          if (gData) {
            const gMeta = gData.created_by;
            if (isAdmin || gMeta?.userId === currentUserId || (!gMeta && profile.role === 'teacher')) {
              delete vDetails[gradeKey];
              if (gradeKey === 'grade1') evalData.vocational_grade_1 = 0;
              if (gradeKey === 'grade2') evalData.vocational_grade_2 = 0;
              if (gradeKey === 'grade3') evalData.vocational_grade_3 = 0;
              if (gradeKey === 'mock') evalData.vocational_mock_grade = 0;
              modified = true;
              deletedItemsCount++;
            }
          }
        }
      }
    } else if (category === 'employment') {
      const eDetails = evalData.employment_details;
      if (eDetails) {
        // 산학교육
        if (eDetails.industry_edu_list) {
          const initialLen = eDetails.industry_edu_list.length;
          eDetails.industry_edu_list = eDetails.industry_edu_list.filter(item => {
            const canDel = isAdmin || item.created_by?.userId === currentUserId || (!item.created_by && profile.role === 'teacher');
            if (canDel) {
              modified = true;
              deletedItemsCount++;
              return false;
            }
            return true;
          });
          evalData.industry_edu_count = eDetails.industry_edu_list.length;
        }

        // 취업코스
        if (eDetails.career_courses) {
          Object.keys(eDetails.career_courses).forEach(term => {
            const meta = eDetails.career_courses_meta?.[term];
            if (isAdmin || meta?.userId === currentUserId || (!meta && profile.role === 'teacher')) {
              delete eDetails.career_courses![term];
              if (eDetails.career_courses_meta) delete eDetails.career_courses_meta[term];
              modified = true;
              deletedItemsCount++;
            }
          });
          evalData.career_course_semesters = Object.keys(eDetails.career_courses).length;
        }

        // 전공동아리
        if (eDetails.major_clubs) {
          Object.keys(eDetails.major_clubs).forEach(grade => {
            const meta = eDetails.major_clubs_meta?.[grade];
            if (isAdmin || meta?.userId === currentUserId || (!meta && profile.role === 'teacher')) {
              delete eDetails.major_clubs![grade];
              if (eDetails.major_clubs_meta) delete eDetails.major_clubs_meta[grade];
              modified = true;
              deletedItemsCount++;
            }
          });
          evalData.major_club_years = Object.keys(eDetails.major_clubs).length;
        }

        // 기능경기대회
        if (eDetails.skills_contest) {
          const meta = eDetails.skills_contest.created_by;
          if (isAdmin || meta?.userId === currentUserId || (!meta && profile.role === 'teacher')) {
            delete eDetails.skills_contest;
            evalData.skills_contest_level = 'none';
            modified = true;
            deletedItemsCount++;
          }
        }

        // 현장실습
        if (eDetails.field_training) {
          const meta = eDetails.field_training.created_by;
          if (isAdmin || meta?.userId === currentUserId || (!meta && profile.role === 'teacher')) {
            delete eDetails.field_training;
            evalData.field_training_completed = false;
            modified = true;
            deletedItemsCount++;
          }
        }

        // 도제 OJT
        if (eDetails.apprenticeship) {
          Object.keys(eDetails.apprenticeship).forEach(term => {
            const meta = eDetails.apprenticeship_meta?.[term];
            if (isAdmin || meta?.userId === currentUserId || (!meta && profile.role === 'teacher')) {
              delete eDetails.apprenticeship![term];
              if (eDetails.apprenticeship_meta) delete eDetails.apprenticeship_meta[term];
              modified = true;
              deletedItemsCount++;
            }
          });
          evalData.apprenticeship_semesters = Object.keys(eDetails.apprenticeship).length;
        }

        // 조기취업
        if (eDetails.employed_early) {
          const meta = eDetails.employed_early.created_by;
          if (isAdmin || meta?.userId === currentUserId || (!meta && profile.role === 'teacher')) {
            delete eDetails.employed_early;
            evalData.employed_early = false;
            modified = true;
            deletedItemsCount++;
          }
        }
      }
    } else if (category === 'arts_contest') {
      const aDetails = evalData.arts_contest_details;
      if (aDetails) {
        // 대회 실적
        if (aDetails.contest_list) {
          aDetails.contest_list = aDetails.contest_list.filter(item => {
            const canDel = isAdmin || item.created_by?.userId === currentUserId || (!item.created_by && profile.role === 'teacher');
            if (canDel) {
              modified = true;
              deletedItemsCount++;
              return false;
            }
            return true;
          });
          evalData.contest_award_count = aDetails.contest_list.filter(c => c.type === 'award').length;
          evalData.contest_participate_count = aDetails.contest_list.filter(c => c.type === 'participate').length;
        }

        // 운동부/관악부
        if (aDetails.arts_sports) {
          Object.keys(aDetails.arts_sports).forEach(term => {
            const meta = aDetails.arts_sports_meta?.[term];
            if (isAdmin || meta?.userId === currentUserId || (!meta && profile.role === 'teacher')) {
              delete aDetails.arts_sports![term];
              if (aDetails.arts_sports_meta) delete aDetails.arts_sports_meta[term];
              modified = true;
              deletedItemsCount++;
            }
          });
          evalData.arts_sports_semesters = Object.keys(aDetails.arts_sports).length;
        }
      }
    }

    if (modified) {
      evalData.updated_by = {
        userId: profile.id,
        userName: profile.full_name || profile.username || '교사',
        role: profile.role,
        at: new Date().toISOString(),
      };
      deletedStudentsCount++;
    }
  }

  if (deletedStudentsCount > 0) {
    const { error: saveErr } = await supabase
      .from('system_settings')
      .upsert({
        key: EVAL_SETTINGS_KEY,
        value: currentStore,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    if (saveErr) {
      return { success: false, deletedStudentsCount: 0, deletedItemsCount: 0, error: '삭제 후 DB 저장 중 오류가 발생했습니다.' };
    }

    await logAuditAction({
      actor_name: profile.full_name || profile.username || '교사',
      action_type: 'STUDENT_BULK_UPDATE',
      target_name: `[인증제 일괄 등록 데이터 삭제] 부문: ${category} (${deletedStudentsCount}명, ${deletedItemsCount}건 실적 삭제)`,
      details: { category, deletedStudentsCount, deletedItemsCount }
    });

    revalidateTag('cert-eval');
    revalidateTag('cert-eval-grade-3');
    revalidateTag('cert-eval-grade-2');
    revalidateTag('cert-eval-grade-1');
    revalidatePath('/admin/certification');
    revalidatePath('/admin/certification/import');
  }

  return {
    success: true,
    deletedStudentsCount,
    deletedItemsCount,
  };
}



